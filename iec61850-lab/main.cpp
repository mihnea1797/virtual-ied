#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <nlohmann/json.hpp>
#include "third_party/httplib.h"
#include "index_html.h"
#include "logger.h"
#include "dependencies/libiec61850/src/sampled_values/sv_publisher.h" // from libiec61850
#include "dependencies/libiec61850/src/goose/goose_receiver.h"        // R-GOOSE receiver
#include "dependencies/libiec61850/src/goose/goose_subscriber.h"      // R-GOOSE subscriber
#include "dependencies/libiec61850/src/r_session/r_session.h"         // R-Session

using json = nlohmann::json;

struct KeyConfig
{
  int         id    = 1;
  std::string value = "";
};

struct GooseSubConfig
{
  std::string            localIP    = "0.0.0.0";
  int                    localPort  = 102;
  std::string            remoteIP   = "10.10.30.2";
  int                    remotePort = 102;
  std::string            goCbRef    = ""; // empty = observer mode (match any)
  std::vector<KeyConfig> keys       = {{1, "0123456789ABCDEF"}, {2, "FEDCBA9876543210"}};
};

struct Config
{
  std::string    iface      = "eth0";
  double         freq       = 50.0;
  double         amp1       = 210.0;
  double         amp2       = 250.0;
  double         stepTime   = 10.0; // seconds
  double         threshold  = 230.0;
  int            sampleRate = 4000; // 80 smp/cyc @ 50 Hz
  std::string    svLocalIP  = "10.10.40.2";
  std::string    remoteIP   = "10.10.30.2";
  int            remotePort = 102;
  // R-SV stream identity — ONE stream per publisher process. For multiple SV streams
  // (e.g. line-differential from several line ends) deploy one merging-unit container per
  // stream, each with its own appId/svID/svLocalIP; the vIED demuxes them by appId.
  uint16_t       appId      = 0x4000;
  std::string    svID       = "sv1";
  std::string    dataset    = "dataset1";
  uint32_t       confRev    = 1;
  int            httpPort   = 8080; // control/UI port; distinct per process when several
                                    // publishers share one container (boundary sweep)
  GooseSubConfig goose;
};

struct State
{
  std::mutex m;
  Config cfg;
  std::atomic<bool> running{false};
  Logger logger;
  Clock::time_point tStart{};

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

// ---------------- R-GOOSE callback (called by GooseReceiver's thread) ----------------
static void rgoose_listener_cb(GooseSubscriber /*subscriber*/, void * /*parameter*/)
{
  // Compute latencies once, on first received R-GOOSE
  if (!g.gooseSeen.load() && (g.stepOccurred.load() || g.thresholdCrossed.load()))
  {
    g.tGoose = Clock::now();

    // Get absolute reception timestamp for console
    auto now_sys = std::chrono::system_clock::now();
    auto tt      = std::chrono::system_clock::to_time_t(now_sys);
    auto sysMs   = std::chrono::duration_cast<std::chrono::milliseconds>(
                     now_sys.time_since_epoch()) % 1000;
    std::tm tm_buf;
    gmtime_r(&tt, &tm_buf);
    char tsBuf[32];
    std::strftime(tsBuf, sizeof(tsBuf), "%Y-%m-%dT%H:%M:%S", &tm_buf);
    std::cout << "[R-GOOSE] received at " << tsBuf
              << '.' << std::setfill('0') << std::setw(3) << sysMs.count() << 'Z' << '\n';

    double msStep   = -1.0;
    double msThresh = -1.0;

    if (g.stepOccurred.load())
    {
      msStep = std::chrono::duration<double, std::milli>(g.tGoose - g.tStep).count();
      g.latencyFromStepMs.store(msStep);
      std::cout << "[R-GOOSE] latency step      -> GOOSE = "
                << std::fixed << std::setprecision(3) << msStep << " ms\n";
    }

    if (g.thresholdCrossed.load())
    {
      msThresh = std::chrono::duration<double, std::milli>(g.tGoose - g.tThreshold).count();
      g.latencyFromThresholdMs.store(msThresh);
      std::cout << "[R-GOOSE] latency threshold -> GOOSE = "
                << std::fixed << std::setprecision(3) << msThresh << " ms\n";
    }

    g.logger.log_goose(msStep, msThresh);
    g.gooseSeen.store(true);
  }
}

// ---------------- R-GOOSE sniffer thread ----------------
void goose_sniffer(Config cfg)
{
  RSession rxSession = RSession_create();
  if (!rxSession)
  {
    std::cerr << "RSession_create failed for R-GOOSE receiver\n";
    return;
  }

  RSession_setLocalAddress(rxSession, cfg.goose.localIP.c_str(), cfg.goose.localPort);
  RSession_setRemoteAddress(rxSession, cfg.goose.remoteIP.c_str(), cfg.goose.remotePort);

  for (const auto &k : cfg.goose.keys)
    RSession_addKey(rxSession, k.id,
                    reinterpret_cast<uint8_t *>(const_cast<char *>(k.value.data())),
                    static_cast<int>(k.value.size()),
                    R_SESSION_SEC_ALGO_AES_128_GCM, R_SESSION_SIG_ALGO_NONE);

  GooseReceiver receiver = GooseReceiver_createRemote(rxSession);
  if (!receiver)
  {
    std::cerr << "GooseReceiver_createRemote failed\n";
    RSession_destroy(rxSession);
    return;
  }

  GooseSubscriber subscriber = GooseSubscriber_create(const_cast<char *>(cfg.goose.goCbRef.c_str()), nullptr);
  if (cfg.goose.goCbRef.empty())
    GooseSubscriber_setObserver(subscriber); // match any R-GOOSE message
  GooseSubscriber_setListener(subscriber, rgoose_listener_cb, nullptr);
  GooseReceiver_addSubscriber(receiver, subscriber);

  // GooseReceiver_start calls RSession_start internally; do NOT call it here.
  // Retry the start: on a /stop -> /start rearm the previous sniffer instance may not
  // have released UDP :102 yet, and a single failed bind would otherwise silently kill
  // GOOSE reception (and t_trip) for the whole run.
  GooseReceiver_start(receiver);
  for (int tries = 0; !GooseReceiver_isRunning(receiver) && g.running.load() && tries < 30; ++tries)
  {
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    GooseReceiver_start(receiver);
  }

  if (!GooseReceiver_isRunning(receiver))
  {
    std::cerr << "R-GOOSE receiver failed to start (after retries)\n";
    GooseReceiver_destroy(receiver); // also destroys subscriber
    RSession_stop(rxSession);
    RSession_destroy(rxSession);
    return;
  }
  std::cout << "[R-GOOSE] receiver listening on " << cfg.goose.localIP << ':' << cfg.goose.localPort << '\n';

  while (g.running.load())
    std::this_thread::sleep_for(std::chrono::milliseconds(100));

  GooseReceiver_stop(receiver);
  GooseReceiver_destroy(receiver); // also destroys subscriber
  RSession_stop(rxSession);
  RSession_destroy(rxSession);
}

// ---------------- R-SV publisher thread (one stream) ----------------
// Publishes ONE R-SV stream, its identity (appId/svID/dataset) taken from config so each
// merging-unit container is distinct. Multiple SV streams = multiple containers, one
// publisher each — the vIED demuxes them by appId. (One stream per process reaches the
// full sample rate; multiplexing N streams in one process shares a single send thread and
// falls short.)
static const int SV_NCH = 4; // channels per stream (bump to 8 for 4I+4V later)

void sv_publisher_run(Config cfg)
{
  RSession rSession = RSession_create();
  if (!rSession)
  {
    std::cerr << "RSession_create failed\n";
    g.running.store(false);
    return;
  }

  RSession_setLocalAddress(rSession, cfg.svLocalIP.c_str(), -1);
  RSession_setRemoteAddress(rSession, cfg.remoteIP.c_str(), cfg.remotePort);

  const char *key1 = "0123456789ABCDEF";
  const char *key2 = "FEDCBA9876543210";
  RSession_addKey(rSession, 1, (uint8_t *)key1, 16, R_SESSION_SEC_ALGO_AES_128_GCM, R_SESSION_SIG_ALGO_NONE);
  RSession_addKey(rSession, 2, (uint8_t *)key2, 16, R_SESSION_SEC_ALGO_AES_128_GCM, R_SESSION_SIG_ALGO_NONE);
  uint32_t activeKeyId = 1;
  RSession_setActiveKey(rSession, activeKeyId);

  SVPublisher rPub = SVPublisher_createRemote(rSession, cfg.appId);
  if (!rPub)
  {
    std::cerr << "SVPublisher_createRemote failed\n";
    RSession_destroy(rSession);
    g.running.store(false);
    return;
  }

  SVPublisher_ASDU rAsdu = SVPublisher_addASDU(rPub, cfg.svID.c_str(), cfg.dataset.c_str(), cfg.confRev);
  if (!rAsdu)
  {
    std::cerr << "SVPublisher_addASDU failed\n";
    SVPublisher_destroy(rPub);
    RSession_destroy(rSession);
    g.running.store(false);
    return;
  }

  int floatIdx[SV_NCH], qualIdx[SV_NCH];
  for (int i = 0; i < SV_NCH; ++i)
  {
    floatIdx[i] = SVPublisher_ASDU_addFLOAT(rAsdu);
    qualIdx[i]  = SVPublisher_ASDU_addQuality(rAsdu);
  }
  int rTsIdx = SVPublisher_ASDU_addTimestamp(rAsdu);

  // RefrTm (9-2 header field, wall-clock ms) lets the subscriber compute one-way
  // delay per sample: OWD = arrival_walltime - RefrTm. Pub/sub containers share the
  // host kernel clock, so this is a true one-way measurement, not RTT/2.
  SVPublisher_ASDU_enableRefrTm(rAsdu);

  SVPublisher_setupComplete(rPub);
  RSession_start(rSession);
  std::cout << "[R-SV] publishing appId=0x" << std::hex << cfg.appId << std::dec
            << " svID=" << cfg.svID << " dataset=" << cfg.dataset
            << " (" << SV_NCH << " ch) @ " << cfg.sampleRate << " sa/s\n";

  uint64_t nextKeyChangeTime = Hal_getTimeInMs() + 5000;
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

  size_t n = 0;
  while (g.running.load())
  {
    const double t = n * Ts;

    const double elapsed = std::chrono::duration<double>(Clock::now() - appStart).count();
    const bool stepped = (elapsed >= cfg.stepTime);
    const double amp = (stepped ? cfg.amp2 : cfg.amp1) * M_SQRT2;

    if (stepped && !g.stepOccurred.exchange(true))
    {
      g.tStep = Clock::now();
      g.logger.log("step");
      std::cout << "[R-SV] Step occurred (elapsed " << elapsed << " s)\n";
    }

    const double val = amp * std::sin(w * t);

    if (g.thresholdArmed.load() && !g.thresholdCrossed.load() && val > cfg.threshold * M_SQRT2)
    {
      g.thresholdCrossed.store(true);
      g.tThreshold = Clock::now();
      g.logger.log("threshold");
      std::cout << "[R-SV] Threshold crossed: Ua=" << val << " (elapsed " << elapsed << " s)\n";
    }

    Quality q = 0;
    Quality_setValidity(&q, QUALITY_VALIDITY_GOOD);

    const float fval = static_cast<float>(val);
    for (int ch = 0; ch < SV_NCH; ++ch)
    {
      SVPublisher_ASDU_setFLOAT(rAsdu, floatIdx[ch], fval);
      SVPublisher_ASDU_setQuality(rAsdu, qualIdx[ch], q);
    }

    Timestamp rTs_val;
    Timestamp_clearFlags(&rTs_val);
    uint64_t nowMs = Hal_getTimeInMs();
    Timestamp_setTimeInMilliseconds(&rTs_val, nowMs);
    SVPublisher_ASDU_setTimestamp(rAsdu, rTsIdx, rTs_val);
    SVPublisher_ASDU_setRefrTm(rAsdu, nowMs); // for subscriber-side one-way delay

    SVPublisher_ASDU_increaseSmpCnt(rAsdu);
    SVPublisher_publish(rPub);

    if (Hal_getTimeInMs() >= nextKeyChangeTime)
    {
      activeKeyId = (activeKeyId == 1) ? 2 : 1;
      RSession_setActiveKey(rSession, activeKeyId);
      g.logger.log("key_change");
      nextKeyChangeTime = Hal_getTimeInMs() + 5000;
    }

    ++n;
    std::this_thread::sleep_until(appStart + std::chrono::duration<double>(n * Ts));
  }

  SVPublisher_destroy(rPub);
  RSession_stop(rSession);
  RSession_destroy(rSession);
}

// ---------------- HTTP server (UI + control) ----------------

static void load_config_file(const std::string &path)
{
  std::ifstream f(path);
  if (!f.is_open()) {
    std::cout << "[CFG] No config file found at '" << path << "', using defaults.\n";
    return;
  }
  auto j = json::parse(f, nullptr, false);
  if (j.is_discarded()) {
    std::cerr << "[CFG] Failed to parse '" << path << "', using defaults.\n";
    return;
  }
  bool autoStart = j.value("autoStart", false);
  {
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
    g.cfg.svLocalIP  = j.value("svLocalIP",  g.cfg.svLocalIP);
    g.cfg.appId   = static_cast<uint16_t>(j.value("appId", static_cast<int>(g.cfg.appId)));
    g.cfg.svID    = j.value("svID",    g.cfg.svID);
    g.cfg.dataset = j.value("dataset", g.cfg.dataset);
    g.cfg.confRev = j.value("confRev", g.cfg.confRev);
    g.cfg.httpPort = j.value("httpPort", g.cfg.httpPort);
    if (j.contains("goose") && j["goose"].is_object()) {
      const auto &jg = j["goose"];
      g.cfg.goose.localIP    = jg.value("localIP",    g.cfg.goose.localIP);
      g.cfg.goose.localPort  = jg.value("localPort",  g.cfg.goose.localPort);
      g.cfg.goose.remoteIP   = jg.value("remoteIP",   g.cfg.goose.remoteIP);
      g.cfg.goose.remotePort = jg.value("remotePort", g.cfg.goose.remotePort);
      g.cfg.goose.goCbRef    = jg.value("goCbRef",    g.cfg.goose.goCbRef);
      if (jg.contains("keys") && jg["keys"].is_array()) {
        g.cfg.goose.keys.clear();
        for (const auto &k : jg["keys"]) {
          if (k.contains("id") && k.contains("value"))
            g.cfg.goose.keys.push_back({k["id"].get<int>(), k["value"].get<std::string>()});
        }
      }
    }
  }
  std::cout << "[CFG] Loaded config from '" << path << "'.\n";

  if (autoStart) {
    std::cout << "[CFG] autoStart=true — starting simulation immediately.\n";
    g.running.store(true);
    g.thresholdArmed.store(true);
    g.stepOccurred.store(false);
    g.thresholdCrossed.store(false);
    g.tStart = Clock::now();
    g.logger.open(g.tStart);
    g.logger.log("start");
    Config cfgSnapshot;
    { std::lock_guard<std::mutex> lk(g.m); cfgSnapshot = g.cfg; }
    std::thread(sv_publisher_run, cfgSnapshot).detach();
    std::thread(goose_sniffer, cfgSnapshot).detach();
  }
}

int main(int argc, char **argv)
{
  const std::string cfgPath = (argc >= 2) ? argv[1] : "config.json";
  load_config_file(cfgPath);

  httplib::Server svr;

  // UI
  svr.Get("/", [](const httplib::Request &, httplib::Response &res)
          { res.set_content(INDEX_HTML, "text/html; charset=utf-8"); });

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
    g.cfg.svLocalIP  = j.value("svLocalIP",  g.cfg.svLocalIP);
    g.cfg.appId   = static_cast<uint16_t>(j.value("appId", static_cast<int>(g.cfg.appId)));
    g.cfg.svID    = j.value("svID",    g.cfg.svID);
    g.cfg.dataset = j.value("dataset", g.cfg.dataset);
    g.cfg.confRev = j.value("confRev", g.cfg.confRev);
    if (j.contains("goose") && j["goose"].is_object()) {
      const auto &jg = j["goose"];
      g.cfg.goose.localIP    = jg.value("localIP",    g.cfg.goose.localIP);
      g.cfg.goose.localPort  = jg.value("localPort",  g.cfg.goose.localPort);
      g.cfg.goose.remoteIP   = jg.value("remoteIP",   g.cfg.goose.remoteIP);
      g.cfg.goose.remotePort = jg.value("remotePort", g.cfg.goose.remotePort);
      g.cfg.goose.goCbRef    = jg.value("goCbRef",    g.cfg.goose.goCbRef);
      if (jg.contains("keys") && jg["keys"].is_array()) {
        g.cfg.goose.keys.clear();
        for (const auto &k : jg["keys"]) {
          if (k.contains("id") && k.contains("value"))
            g.cfg.goose.keys.push_back({k["id"].get<int>(), k["value"].get<std::string>()});
        }
      }
    }

    res.set_content("{}", "application/json"); });

  // Start
  svr.Post("/start", [](const httplib::Request &, httplib::Response &res)
           {
    if (g.running.exchange(true)) { res.set_content("{}", "application/json"); return; }

    Config cfgSnapshot;
    { std::lock_guard<std::mutex> lk(g.m); cfgSnapshot = g.cfg; }

    g.tStart = Clock::now();
    g.logger.open(g.tStart);
    g.logger.log("start");

    std::thread(sv_publisher_run, cfgSnapshot).detach();
    std::thread(goose_sniffer, cfgSnapshot).detach();

    res.set_content("{}", "application/json"); });

  // Stop
  svr.Post("/stop", [](const httplib::Request &, httplib::Response &res)
           {
    g.logger.log("stop");
    g.running.store(false);
    g.logger.close();
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

  int httpPort;
  { std::lock_guard<std::mutex> lk(g.m); httpPort = g.cfg.httpPort; }
  std::cout << "Listening on 0.0.0.0:" << httpPort << "\n";
  if (!svr.listen("0.0.0.0", httpPort))
    std::cerr << "HTTP listen on port " << httpPort << " failed (port in use?)\n";
  return 0;
}
