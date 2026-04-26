#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <pcap.h>
#include <nlohmann/json.hpp>
#include "third_party/httplib.h"      // third_party/httplib.h (cpp-httplib single header)
#include "dependencies/libiec61850/src/sampled_values/sv_subscriber.h" // from libiec61850
#include "dependencies/libiec61850/src/sampled_values/sv_publisher.h" // from libiec61850
#include "dependencies/libiec61850/src/r_session/r_session.h" // for R-SV

using json = nlohmann::json;
using Clock = std::chrono::steady_clock;

struct Config
{
  std::string iface = "eth0";
  double freq = 50.0;
  double amp1 = 210.0;
  double amp2 = 250.0;
  double stepTime = 10.0; // seconds
  double threshold = 230.0;
  int sampleRate = 4000; // 80 smp/cyc @ 50 Hz
  std::string remoteIP = "10.10.30.2";
  int remotePort = 102;
};

struct State
{
  std::mutex m;
  Config cfg;
  std::atomic<bool> running{false};

  // --- Step tracking ---
  std::atomic<bool> stepOccurred{false}; // set true when elapsed >= stepTime (first time only)
  Clock::time_point tStep{};

  // --- Threshold tracking ---
  std::atomic<bool> thresholdArmed{true};    // arm at /start
  std::atomic<bool> thresholdCrossed{false}; // set true when val > threshold (first time only)
  Clock::time_point tThreshold{};

  // --- GOOSE tracking ---
  std::atomic<bool> gooseSeen{false}; // first goose after start
  Clock::time_point tGoose{};

  // Latencies to first observed GOOSE
  std::atomic<double> latencyFromStepMs{-1.0};
  std::atomic<double> latencyFromThresholdMs{-1.0};

  // Live timers for UI
  double elapsedSinceStepMs() const
  {
    if (!stepOccurred.load())
      return -1.0;
    auto now = Clock::now();
    return std::chrono::duration<double, std::milli>(now - tStep).count();
  }

  double elapsedSinceThresholdMs() const
  {
    if (!thresholdCrossed.load())
      return -1.0;
    auto now = Clock::now();
    return std::chrono::duration<double, std::milli>(now - tThreshold).count();
  }
} g;

// ---------------- GOOSE sniffer thread ----------------
void goose_sniffer(const std::string &iface)
{
  char errbuf[PCAP_ERRBUF_SIZE]{0};
  pcap_t *h = pcap_open_live(iface.c_str(), 65535, 1, 1, errbuf);
  if (!h)
  {
    std::cerr << "pcap_open_live failed: " << errbuf << "\n";
    return;
  }

  bpf_program fp{};
  if (pcap_compile(h, &fp, "ether proto 0x88b8", 1, PCAP_NETMASK_UNKNOWN) == -1)
  {
    std::cerr << "pcap_compile failed: " << pcap_geterr(h) << "\n";
    pcap_close(h);
    return;
  }
  if (pcap_setfilter(h, &fp) == -1)
  {
    std::cerr << "pcap_setfilter failed: " << pcap_geterr(h) << "\n";
    pcap_freecode(&fp);
    pcap_close(h);
    return;
  }
  pcap_freecode(&fp);

  while (g.running.load())
  {
    pcap_pkthdr *hdr;
    const u_char *data;
    int r = pcap_next_ex(h, &hdr, &data);
    if (r <= 0)
      continue;

    // Compute latencies once, on first received GOOSE
    if (!g.gooseSeen.load() && (g.stepOccurred.load() || g.thresholdCrossed.load()))
    {
      g.tGoose = Clock::now();

      if (g.stepOccurred.load())
      {
        double msStep = std::chrono::duration<double, std::milli>(g.tGoose - g.tStep).count();
        g.latencyFromStepMs.store(msStep);
        std::cout << "[GOOSE] latency step -> GOOSE = " << msStep << " ms\n";
      }

      if (g.thresholdCrossed.load())
      {
        double msThresh = std::chrono::duration<double, std::milli>(g.tGoose - g.tThreshold).count();
        g.latencyFromThresholdMs.store(msThresh);
        std::cout << "[GOOSE] latency threshold -> GOOSE = " << msThresh << " ms\n";
      }

      g.gooseSeen.store(true);
      // keep running; user might stop manually
    }
  }

  pcap_close(h);
}

// ---------------- SV publisher thread ----------------
void sv_publisher_run(Config cfg)
{
  // Create local publisher
  SVPublisher pub = SVPublisher_create(nullptr, cfg.iface.c_str());
  if (!pub)
  {
    std::cerr << "SVPublisher_create failed on " << cfg.iface << "\n";
    g.running.store(false);
    return;
  }

  // One ASDU, 8x (FLOAT + Quality)
  SVPublisher_ASDU asdu = SVPublisher_addASDU(pub, "sv1", "dataset1", 1);
  if (!asdu)
  {
    std::cerr << "SVPublisher_addASDU failed\n";
    SVPublisher_destroy(pub);
    g.running.store(false);
    return;
  }

  for (int i = 0; i < 8; ++i)
  {
    SVPublisher_ASDU_addFLOAT(asdu);
    SVPublisher_ASDU_addQuality(asdu);
  }

  SVPublisher_setupComplete(pub);

  // Create R-SV publisher
  RSession rSession = RSession_create();
  SVPublisher rPub = nullptr;
  SVPublisher_ASDU rAsdu = nullptr;
  uint32_t activeKeyId = 1;
  uint64_t nextKeyChangeTime = 0; // will set later
  if (rSession)
  {
    RSession_setLocalAddress(rSession, "10.10.40.2", -1);
    RSession_setRemoteAddress(rSession, cfg.remoteIP.c_str(), cfg.remotePort);

    nextKeyChangeTime = Hal_getTimeInMs() + 5000;
    char* key1 = "0123456789ABCDEF";
    char* key2 = "FEDCBA9876543210";
    RSession_addKey(rSession, 1, (uint8_t*)key1, 16, R_SESSION_SEC_ALGO_AES_128_GCM, R_SESSION_SIG_ALGO_NONE);
    RSession_addKey(rSession, 2, (uint8_t*)key2, 16, R_SESSION_SEC_ALGO_AES_128_GCM, R_SESSION_SIG_ALGO_NONE);
    RSession_setActiveKey(rSession, activeKeyId);

    rPub = SVPublisher_createRemote(rSession, 0x4000);
    if (rPub)
    {
      rAsdu = SVPublisher_addASDU(rPub, "sv1", "dataset1", 1);
      if (rAsdu)
      {
        for (int i = 0; i < 8; ++i)
        {
          SVPublisher_ASDU_addFLOAT(rAsdu);
          SVPublisher_ASDU_addQuality(rAsdu);
        }
        int rTs = SVPublisher_ASDU_addTimestamp(rAsdu);
        SVPublisher_setupComplete(rPub);
        RSession_start(rSession);
      }
    }
  }

  const double Ts = 1.0 / static_cast<double>(cfg.sampleRate);
  const double w = 2.0 * M_PI * cfg.freq;
  auto appStart = Clock::now();

  // Reset/arm tracking
  g.stepOccurred.store(false);
  g.thresholdArmed.store(true);
  g.thresholdCrossed.store(false);
  g.gooseSeen.store(false);
  g.latencyFromStepMs.store(-1.0);
  g.latencyFromThresholdMs.store(-1.0);

  int32_t smpCnt = 0; // for local, though not used, but to match

  size_t n = 0;

  while (g.running.load())
  {
    const double t = n * Ts;

    // step amplitude after stepTime seconds (wall-clock)
    const double elapsed = std::chrono::duration<double>(Clock::now() - appStart).count();
    const bool stepped = (elapsed >= cfg.stepTime);
    const double amp = stepped ? cfg.amp2 : cfg.amp1;

    // Start STEP timer (first time only)
    if (stepped && !g.stepOccurred.exchange(true))
    {
      g.tStep = Clock::now();
      std::cout << "[SV] Step occurred (elapsed " << elapsed << " s)\n";
    }

    const double val = amp * std::sin(w * t);
    const float fval = static_cast<float>(val);

    // threshold detection (first crossing only)
    if (g.thresholdArmed.load() && !g.thresholdCrossed.load() && val > cfg.threshold)
    {
      g.thresholdCrossed.store(true);
      g.tThreshold = Clock::now();
      std::cout << "[SV] Threshold crossed: Ua=" << val << " (elapsed " << elapsed << " s)\n";
    }

    Quality q = 0;
    Quality_setValidity(&q, QUALITY_VALIDITY_GOOD);

    // Publish local SV
    for (int ch = 0; ch < 8; ++ch)
    {
      SVPublisher_ASDU_setFLOAT(asdu, ch * 2, fval);
      SVPublisher_ASDU_setQuality(asdu, ch * 2 + 1, q);
    }
    SVPublisher_ASDU_increaseSmpCnt(asdu);
    SVPublisher_publish(pub);

    // Publish R-SV
    if (rPub && rAsdu)
    {
      for (int ch = 0; ch < 8; ++ch)
      {
        SVPublisher_ASDU_setFLOAT(rAsdu, ch * 2, fval);
        SVPublisher_ASDU_setQuality(rAsdu, ch * 2 + 1, q);
      }
      Timestamp rTs_val;
      Timestamp_clearFlags(&rTs_val);
      Timestamp_setTimeInMilliseconds(&rTs_val, Hal_getTimeInMs());
      SVPublisher_ASDU_setTimestamp(rAsdu, 16, rTs_val);
      SVPublisher_ASDU_increaseSmpCnt(rAsdu);
      SVPublisher_publish(rPub);

      if (Hal_getTimeInMs() >= nextKeyChangeTime)
      {
        if (activeKeyId == 1)
          activeKeyId = 2;
        else
          activeKeyId = 1;
        RSession_setActiveKey(rSession, activeKeyId);
        nextKeyChangeTime = Hal_getTimeInMs() + 5000;
      }
    }

    ++n;
    std::this_thread::sleep_until(appStart + std::chrono::duration<double>(n * Ts));
  }

  SVPublisher_destroy(pub);
  if (rPub) SVPublisher_destroy(rPub);
  if (rSession) RSession_destroy(rSession);
}

// ---------------- HTTP server (UI + control) ----------------
std::string index_html()
{
  return R"HTML(<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>SV–GOOSE Latency</title>
<style>
  body{font-family:system-ui,Arial,sans-serif;margin:24px;}
  fieldset{margin-bottom:16px;padding:12px;border-radius:8px;}
  label{display:block;margin:6px 0 2px;}
  input{padding:6px;width:220px;}
  .row{display:flex;gap:24px;flex-wrap:wrap;}
  .card{border:1px solid #ddd;border-radius:10px;padding:16px;min-width:320px;}
  .big{font-size:22px;font-weight:700}
  button{padding:8px 12px;margin-right:8px;}
  code{background:#f5f5f5;padding:2px 6px;border-radius:6px}
  .muted{color:#666}
</style>
</head>
<body>
<h2>SV → GOOSE Latency Lab</h2>

<div class="row">
  <div class="card">
    <fieldset>
      <legend>Signal</legend>
      <label>Interface</label><input id="iface" value="eth0">
      <label>Frequency (Hz)</label><input id="freq" type="number" value="50">
      <label>Amplitude 1 (V)</label><input id="amp1" type="number" value="70">
      <label>Amplitude 2 (V)</label><input id="amp2" type="number" value="100">
      <label>Step time (s)</label><input id="stepTime" type="number" value="10">
      <label>Threshold (V)</label><input id="threshold" type="number" value="90">
      <label>Sample rate (sps)</label><input id="srate" type="number" value="4000">
      <label>Remote IP</label><input id="remoteIP" value="230.0.10.10">
      <label>Remote Port</label><input id="remotePort" type="number" value="102">
    </fieldset>
    <div>
      <button id="apply">Apply</button>
      <button id="start">Start</button>
      <button id="stop">Stop</button>
    </div>
    <p class="muted" style="margin-top:12px">
      Two timers are shown:
      <br>• <b>Since step</b>: starts when <code>elapsed >= stepTime</code> for the first time.
      <br>• <b>Since threshold</b>: starts when <code>Ua(t) > threshold</code> for the first time.
    </p>
  </div>

  <div class="card">
    <div>Status: <span id="status">idle</span></div>

    <div style="margin-top:14px;">Since step:</div>
    <div id="stepTimer" class="big">–</div>

    <div style="margin-top:14px;">Since threshold:</div>
    <div id="thTimer" class="big">–</div>

    <div style="margin-top:14px;">Latency step → first GOOSE:</div>
    <div id="latStep">–</div>

    <div style="margin-top:14px;">Latency threshold → first GOOSE:</div>
    <div id="latThresh">–</div>
  </div>
</div>

<p>
  GOOSE is detected by sniffing Ethertype <code>0x88b8</code>.
  Latencies are computed on the <b>first</b> received GOOSE after start.
</p>

<script>
async function post(url, body){
  const r = await fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body||{})
  });
  if(!r.ok) throw new Error('HTTP ' + r.status);
  return r.json().catch(()=> ({}));
}

document.getElementById('apply').onclick = async ()=>{
  const body = {
    iface: document.getElementById('iface').value,
    freq: parseFloat(document.getElementById('freq').value),
    amp1: parseFloat(document.getElementById('amp1').value),
    amp2: parseFloat(document.getElementById('amp2').value),
    stepTime: parseFloat(document.getElementById('stepTime').value),
    threshold: parseFloat(document.getElementById('threshold').value),
    sampleRate: parseInt(document.getElementById('srate').value),
    remoteIP: document.getElementById('remoteIP').value,
    remotePort: parseInt(document.getElementById('remotePort').value)
  };
  try { await post('/configure', body); alert('Config applied'); }
  catch(e){ alert(e); }
};

document.getElementById('start').onclick = async ()=>{
  try { await post('/start', {}); }
  catch(e){ alert(e); }
};

document.getElementById('stop').onclick = async ()=>{
  try { await post('/stop', {}); }
  catch(e){ alert(e); }
};

const statusEl = document.getElementById('status');
const stepEl = document.getElementById('stepTimer');
const thEl   = document.getElementById('thTimer');
const latStepEl = document.getElementById('latStep');
const latThreshEl = document.getElementById('latThresh');

const es = new EventSource('/events');
es.onmessage = (ev)=>{
  const m = JSON.parse(ev.data);

  if(m.type === 'status'){
    statusEl.textContent = m.running ? 'running' : 'idle';
  }

  if(m.type === 'timer'){
    stepEl.textContent =
      (m.elapsedStepMs >= 0) ? (m.elapsedStepMs/1000).toFixed(3) + ' s' : '–';

    thEl.textContent =
      (m.elapsedThresholdMs >= 0) ? (m.elapsedThresholdMs/1000).toFixed(3) + ' s' : '–';

    latStepEl.textContent =
      (m.latStepMs >= 0) ? m.latStepMs.toFixed(3) + ' ms' : '–';

    latThreshEl.textContent =
      (m.latThresholdMs >= 0) ? m.latThresholdMs.toFixed(3) + ' ms' : '–';
  }
};
</script>
</body>
</html>)HTML";
}

int main(int argc, char **argv)
{
  httplib::Server svr;

  // UI
  svr.Get("/", [](const httplib::Request &, httplib::Response &res)
          { res.set_content(index_html(), "text/html; charset=utf-8"); });

  // Configure
  svr.Post("/configure", [](const httplib::Request &req, httplib::Response &res)
           {
    auto j = json::parse(req.body, nullptr, false);
    if (j.is_discarded()) { res.status = 400; return; }

    std::lock_guard<std::mutex> lk(g.m);
    g.cfg.iface      = j.value("iface",      g.cfg.iface);
    g.cfg.freq       = j.value("freq",       g.cfg.freq);
    g.cfg.amp1       = j.value("amp1",       g.cfg.amp1);
    g.cfg.amp2       = j.value("amp2",       g.cfg.amp2);
    g.cfg.stepTime   = j.value("stepTime",   g.cfg.stepTime);
    g.cfg.threshold  = j.value("threshold",  g.cfg.threshold);
    g.cfg.sampleRate = j.value("sampleRate", g.cfg.sampleRate);
    g.cfg.remoteIP   = j.value("remoteIP",   g.cfg.remoteIP);
    g.cfg.remotePort = j.value("remotePort", g.cfg.remotePort);

    res.set_content("{}", "application/json"); });

  // Start
  svr.Post("/start", [](const httplib::Request &, httplib::Response &res)
           {
    if (g.running.exchange(true)) { res.set_content("{}", "application/json"); return; }

    Config cfgSnapshot;
    { std::lock_guard<std::mutex> lk(g.m); cfgSnapshot = g.cfg; }

    std::thread(sv_publisher_run, cfgSnapshot).detach();
    std::thread(goose_sniffer, cfgSnapshot.iface).detach();

    res.set_content("{}", "application/json"); });

  // Stop
  svr.Post("/stop", [](const httplib::Request &, httplib::Response &res)
           {
    g.running.store(false);
    res.set_content("{}", "application/json"); });

  // SSE events: status + both live timers + both latencies
  svr.Get("/events", [](const httplib::Request &, httplib::Response &res)
          {
    res.set_header("Content-Type", "text/event-stream");
    res.set_header("Cache-Control", "no-cache");

    res.set_chunked_content_provider("text/event-stream",
      [](size_t, httplib::DataSink& sink) {
        auto send = [&](const json& j){
          std::string line = "data: " + j.dump() + "\n\n";
          sink.write(line.data(), line.size());
        };

        while (true) {
          send({{"type","status"}, {"running", g.running.load()}});

          send({
            {"type","timer"},
            {"elapsedStepMs", g.elapsedSinceStepMs()},
            {"elapsedThresholdMs", g.elapsedSinceThresholdMs()},
            {"latStepMs", g.latencyFromStepMs.load()},
            {"latThresholdMs", g.latencyFromThresholdMs.load()}
          });

          std::this_thread::sleep_for(std::chrono::milliseconds(200));
        }
        return true;
      }
    ); });

  std::cout << "Listening on 0.0.0.0:8080\n";
  svr.listen("0.0.0.0", 8080);
  return 0;
}
