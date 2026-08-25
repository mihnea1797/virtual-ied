#!/usr/bin/env python3
"""
rsv_sweep.py - network-impairment campaign for the vMU/vIED rSV/rGOOSE loop.

Top-level axis = the 3 operating points from the CIRED paper (amplitude steps).
For each: baseline + delay (<=15) + loss + jitter + rate sweeps.
Plus a delay x loss 2D envelope and an iperf-driven congestion phase (one scenario each).

t_trip is read from the harness CSV log (the 'goose' row's latency_step_ms), not
the /events SSE stream (which leaks worker threads). Run ON THE VM with the lab UP,
the vIED running/subscribed, and the harness serving on :8080.
"""

import csv
import json
import statistics
import subprocess
import time
import urllib.request
from collections import OrderedDict, defaultdict

# ----------------------------- CONFIG -----------------------------
BASE_URL    = "http://127.0.0.1:8080"
ROUTER      = "clab-vied-lab-router"
VMU         = "clab-vied-lab-vmu1"
VIED        = "clab-vied-lab-vied"
HARNESS_CWD = "/home/root/iec61850-lab"   # where sv_goose_*.csv land
VIED_IP     = "10.10.30.1"                # vIED data-plane IP (for iperf target)

IMPAIR_IFACES = ["eth1", "eth2"]          # both directions (loop sees ~2x delay)
N_RUNS         = 10
TRIP_TIMEOUT_S = 4.0
SETTLE_S       = 0.4
BUDGET_MS      = 20.0
OUT_CSV        = "rsv_sweep_results.csv"

# The three operating points (RMS volts; threshold 230). stepTime short for fast runs.
SCENARIOS = OrderedDict([
    ("min_latency",   {"amp1": 180.0, "amp2": 400.0, "threshold": 230.0, "stepTime": 1.0}),
    ("baseline_fast", {"amp1": 180.0, "amp2": 260.0, "threshold": 230.0, "stepTime": 1.0}),
    ("worst_case",    {"amp1": 210.0, "amp2": 235.0, "threshold": 230.0, "stepTime": 1.0}),
])

SWEEPS = OrderedDict([
    ("delay_ms",  [0, 1, 2, 5, 8, 12, 15]),   # hard stop at 15
    ("loss_pct",  [0.1, 0.5, 1, 2, 5, 10]),
    ("jitter_ms", [0.5, 1, 2, 4]),
    ("rate_mbit", [50, 20, 10, 5, 2]),
])
JITTER_BASE_MS = 1

# delay x loss 2D envelope
RUN_2D         = True
TWO_D_SCENARIO = "min_latency"
TWO_D_DELAY    = [0, 2, 5, 8]
TWO_D_LOSS     = [0, 1, 5]

# iperf congestion: fixed bottleneck on the R-SV path + growing background UDP
RUN_CONGESTION = True
CONG_SCENARIO  = "min_latency"
CONG_IFACE     = "eth2"            # bottleneck on the path toward the vIED
CONG_CAP_MBIT  = 15               # set ABOVE your measured SV stream bitrate
CONG_BG_MBIT   = [0, 5, 10, 14, 18]
IPERF_PORT     = 5201

def netem_spec(dimension, level):
    if dimension == "delay_ms":  return f"delay {level}ms"
    if dimension == "jitter_ms": return f"delay {JITTER_BASE_MS}ms {level}ms distribution normal"
    if dimension == "loss_pct":  return f"loss {level}%"
    if dimension == "rate_mbit": return f"rate {level}mbit"
    raise ValueError(dimension)

# ----------------------------- shell / tc -----------------------------
def _sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)

def tc_apply(spec, ifaces=None):
    for ifc in (ifaces or IMPAIR_IFACES):
        _sh(f"docker exec {ROUTER} tc qdisc replace dev {ifc} root netem {spec}")

def tc_clear(ifaces=None):
    for ifc in (ifaces or IMPAIR_IFACES):
        _sh(f"docker exec {ROUTER} tc qdisc del dev {ifc} root")

# ----------------------------- harness HTTP + CSV result -----------------------------
def post(path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else b""
    req = urllib.request.Request(BASE_URL + path, data=data, method="POST",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as r:
        r.read()

def _newest_csv():
    r = _sh(f"docker exec {VMU} sh -c 'ls -t {HARNESS_CWD}/sv_goose_*.csv 2>/dev/null | head -1'")
    return r.stdout.strip() or None

def read_trip(timeout):
    deadline = time.time() + timeout
    time.sleep(min(1.0, timeout))   # the trip cannot precede the step
    while time.time() < deadline:
        path = _newest_csv()
        if path:
            r = _sh(f"docker exec {VMU} sh -c \"grep ',goose,' '{path}' | head -1\"")
            line = r.stdout.strip()
            if line:
                f = line.split(',')
                if len(f) >= 4 and f[3] != "":
                    lat = float(f[3])
                    thr = float(f[4]) if len(f) >= 5 and f[4] != "" else -1.0
                    return lat, thr
        time.sleep(0.15)
    return None, None

def run_once():
    post("/start")
    lat, thr = read_trip(TRIP_TIMEOUT_S)
    post("/stop")
    time.sleep(SETTLE_S)
    return lat, thr

def classify(lat):
    if lat is None:     return "missed"
    if lat > BUDGET_MS: return "timing_fail"
    return "ok"

def set_scenario(name):
    post("/configure", SCENARIOS[name])

def collect(rows, scenario, dimension, level, label=None):
    print(f"\n[{scenario} | {dimension}={label if label is not None else level}]")
    for run in range(1, N_RUNS + 1):
        lat, thr = run_once()
        oc = classify(lat)
        rows.append({"scenario": scenario, "dimension": dimension,
                     "level": label if label is not None else level, "run": run,
                     "t_trip_ms": "" if lat is None else round(lat, 3),
                     "lat_threshold_ms": "" if thr in (None, -1.0) else round(thr, 3),
                     "outcome": oc})
        print(f"  run {run:2d}: {'MISS' if lat is None else f'{lat:7.3f} ms'}  [{oc}]")

# ----------------------------- phases -----------------------------
def run_matrix(rows):
    for scen in SCENARIOS:
        set_scenario(scen)
        tc_clear()
        collect(rows, scen, "baseline", 0)
        for dim, levels in SWEEPS.items():
            for level in levels:
                tc_apply(netem_spec(dim, level))
                collect(rows, scen, dim, level)
                tc_clear()

def run_2d(rows):
    set_scenario(TWO_D_SCENARIO)
    for d in TWO_D_DELAY:
        for l in TWO_D_LOSS:
            tc_apply(f"delay {d}ms loss {l}%")
            collect(rows, TWO_D_SCENARIO, "delay_x_loss", None, label=f"d{d}_l{l}")
            tc_clear()

def run_congestion(rows):
    set_scenario(CONG_SCENARIO)
    _sh(f"docker exec -d {VIED} iperf3 -s -p {IPERF_PORT}")
    time.sleep(1.0)
    try:
        for bg in CONG_BG_MBIT:
            tc_apply(f"rate {CONG_CAP_MBIT}mbit", ifaces=[CONG_IFACE])
            if bg > 0:
                _sh(f"docker exec -d {VMU} iperf3 -c {VIED_IP} -u -b {bg}M "
                    f"-t 100000 -p {IPERF_PORT}")
                time.sleep(0.5)
            collect(rows, CONG_SCENARIO, "congestion_bg_mbit", bg)
            _sh(f"docker exec {VMU} pkill -f 'iperf3 -c'")
            tc_clear(ifaces=[CONG_IFACE])
    finally:
        _sh(f"docker exec {VMU} pkill -f 'iperf3 -c'")
        _sh(f"docker exec {VIED} pkill -f 'iperf3 -s'")
        tc_clear(ifaces=[CONG_IFACE])

# ----------------------------- summary -----------------------------
def summarize(rows):
    groups = OrderedDict()
    for r in rows:
        groups.setdefault((r["scenario"], r["dimension"], r["level"]), []).append(r)

    def stats(rs):
        good = [float(r["t_trip_ms"]) for r in rs if r["t_trip_ms"] != ""]
        miss = sum(1 for r in rs if r["outcome"] == "missed")
        ok   = sum(1 for r in rs if r["outcome"] == "ok")
        med  = statistics.median(good) if good else float("nan")
        p95  = statistics.quantiles(good, n=20)[-1] if len(good) >= 2 else (good[0] if good else float("nan"))
        return med, p95, ok, miss

    print("\n=== full table (scenario | dimension | level : median / p95 / pass% / miss) ===")
    for (scen, dim, lvl), rs in groups.items():
        med, p95, ok, miss = stats(rs)
        print(f"  {scen:13s} {dim:18s} {str(lvl):>7s}: "
              f"median {med:7.2f} | p95 {p95:7.2f} | pass {ok}/{len(rs)} | miss {miss}")

    print("\n=== tolerance per scenario (max level with median <= 20 ms and no miss) ===")
    for scen in SCENARIOS:
        for dim, levels in SWEEPS.items():
            tolerable, broke_at = None, None
            for level in levels:
                rs = groups.get((scen, dim, level))
                if not rs:
                    continue
                med, _, _, miss = stats(rs)
                broke = (med > BUDGET_MS) or (miss > 0)
                if broke:
                    broke_at = level
                    break
                tolerable = level
            verdict = (f"max tolerable = {tolerable} (breaks at {broke_at})"
                       if broke_at is not None else f"survives entire range (<= {levels[-1]})")
            print(f"  {scen:13s} {dim:10s}: {verdict}")

if __name__ == "__main__":
    rows = []
    try:
#        run_matrix(rows)
#        if RUN_2D:
#            run_2d(rows)
        if RUN_CONGESTION:
            run_congestion(rows)
    finally:
        tc_clear()
        with open(OUT_CSV, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["scenario", "dimension", "level", "run",
                                              "t_trip_ms", "lat_threshold_ms", "outcome"])
            w.writeheader()
            w.writerows(rows)
        print(f"\nWrote {len(rows)} rows to {OUT_CSV}")
        summarize(rows)
