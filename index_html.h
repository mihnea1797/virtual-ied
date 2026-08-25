#pragma once

// Auto-extracted from main.cpp – edit HTML here, then recompile.
inline constexpr const char* INDEX_HTML = R"HTML(<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>IEC61850-Lab</title>
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
<h2>IEC61850-Lab</h2>

<div class="row">
  <div class="card">
    <fieldset>
      <legend>Signal</legend>
      <label>Interface</label><input id="iface" value="eth0">
      <label>Frequency (Hz)</label><input id="freq" type="number" value="50">
      <label>Amplitude 1 (Vrms)</label><input id="amp1" type="number" value="70">
      <label>Amplitude 2 (Vrms)</label><input id="amp2" type="number" value="100">
      <label>Step time (s)</label><input id="stepTime" type="number" value="10">
      <label>Threshold (Vrms)</label><input id="threshold" type="number" value="90">
      <label>Sample rate (sps)</label><input id="srate" type="number" value="4000">
      <label>SV Local IP</label><input id="svLocalIP" value="10.10.40.2">
      <label>Remote IP (vIED)</label><input id="remoteIP" value="10.10.30.2">
      <label>Remote Port</label><input id="remotePort" type="number" value="102">
    </fieldset>
    <fieldset>
      <legend>R-GOOSE Subscriber</legend>
      <label>Local IP</label><input id="gLocalIP" value="0.0.0.0">
      <label>Local Port</label><input id="gLocalPort" type="number" value="102">
      <label>Remote IP (vIED)</label><input id="gRemoteIP" value="10.10.30.2">
      <label>Remote Port</label><input id="gRemotePort" type="number" value="102">
      <label>GoCbRef (empty = any)</label><input id="goCbRef" value="">
      <p class="muted" style="margin:6px 0 0">Security keys can only be set via <code>config.json</code>.</p>
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
    svLocalIP: document.getElementById('svLocalIP').value,
    remoteIP: document.getElementById('remoteIP').value,
    remotePort: parseInt(document.getElementById('remotePort').value),
    goose: {
      localIP:    document.getElementById('gLocalIP').value,
      localPort:  parseInt(document.getElementById('gLocalPort').value),
      remoteIP:   document.getElementById('gRemoteIP').value,
      remotePort: parseInt(document.getElementById('gRemotePort').value),
      goCbRef:    document.getElementById('goCbRef').value
    }
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
