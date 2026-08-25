#!/usr/bin/env python3
"""
qos_sweep.py — converged QoS/contention sweep for the vied-lab (EnergyCon driver).

Merges the two earlier tools:
  - sweep.sh      : QoS on/off x background-load sweep, delivery/jitter/darkness metrics
  - rsv_sweep.py  : netem impairment machinery on the router + t_trip (step -> R-GOOSE)

Per condition it drives N R-SV publishers (one merging-unit container each, distinct
APPID — multi-stream = multi-container by design), reads PER-STREAM metrics from the
vIED subscriber's decrypted view (/tmp/mu-stats.jsonl deltas — tcpdump can't demux
streams sharing one encrypted R-session 5-tuple, and is blind on OVS datapath ports),
and logs the network parameters reviewers asked for: link bandwidth (read live from
the HTB ceiling), netem propagation delay (configured AND read back), measured one-way
delay per stream (RefrTm-based, shared host clock), and a ping RTT baseline.

Run on the VM with the lab up (lab-up.sh / clab-vied-lab.service).
"""

import csv
import json
import re
import subprocess
import sys
import time

# ----------------------------- lab layout -----------------------------
OVS     = "clab-vied-lab-ovs-core"
# 3-hop WAN: access (ovs-core, cap + edge marking) -> aggregation -> core.
# Each router hop carries the identical DSCP->EF PHB + its propagation-delay share,
# installed statically by wan-qos.sh; the driver only VERIFIES and logs it.
ROUTERS = ["clab-vied-lab-router1", "clab-vied-lab-router2"]
SUB     = "clab-vied-lab-vied"
LOAD    = "clab-vied-lab-load-src"

SINK_IP  = "10.10.30.1"
SV_PORTS = [102, 103]   # one UDP port per merging-unit R-session (parallel decrypt at vIED)

# One R-SV publisher per merging-unit container (multi-stream = multi-container),
# each on its own R-session port. "cwd" controls where the harness drops its
# loggerOutput/ CSVs: the repo dir is bind-mounted into EVERY vmu container, so only
# vmu1 (the t_trip node — vied's GOOSE goes to 10.10.40.1 alone) may write there;
# the others use a container-local dir or they'd shadow vmu1's CSV as "newest"
# (and same-second starts collide on one filename, which the logger truncates).
PUB_DIR    = "/home/root/iec61850-lab"
PUBLISHERS = [
    {"cont": "clab-vied-lab-vmu1", "cfg": "config.json",      "ip": "10.10.40.1", "appid": 16384, "port": 102,
     "cwd": PUB_DIR},
    {"cont": "clab-vied-lab-vmu2", "cfg": "config-vmu2.json", "ip": "10.10.40.2", "appid": 16385, "port": 103,
     "cwd": "/tmp"},
]
LOGGER_DIR = PUB_DIR + "/loggerOutput"      # harness CSVs (t_trip source, vmu1 only)
MU_BIN     = "/opt/virtual-merging-unit/merging-unit"
MU_STATS   = "/tmp/mu-stats.jsonl"

# ----------------------------- experiment -----------------------------
DUR        = 30          # measured seconds per condition
SETTLE_S   = 4           # after (re)arming publishers, before the t0 snapshot
REPS       = 3           # repetitions per condition (small-N runs gave noisy counts)
# Background loads: cap is 20M, aggregate R-SV ~12M -> offered totals 90/105/120/140% of cap.
LOADS      = ["6M", "9M", "12M", "16M"]
SV_PPS_MIN, SV_PPS_MAX = 3500, 4500   # per-publisher guard band around 4000 sa/s

STAMP  = time.strftime("%Y%m%d_%H%M%S")
OUTCSV = f"qos_sweep_{STAMP}.csv"

COLS = ["cond", "qos", "bg_mbps", "appid", "svid",
        "rx", "rate_sas", "lost", "loss_pct", "dup",
        "jit_mean_ms", "jit_max_ms", "stalls_5ms", "dark_16ms",
        "owd_mean_ms", "owd_max_ms", "t_trip_ms",
        "link_bw_mbps", "netem_ms", "ping_rtt_ms",
        "rep", "netem_hops"]     # appended: repetition idx, per-hop delay breakdown

# ----------------------------- helpers -----------------------------
def sh(cmd, timeout=90):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)

def dx(cont, cmd, timeout=90):
    # list-argv, no host shell: $(...)/$((...)) must expand INSIDE the container,
    # never on the host (host expansion silently runs tcpdump etc. on the wrong netns)
    return subprocess.run(["docker", "exec", cont, "sh", "-c", cmd],
                          capture_output=True, text=True, timeout=timeout)

def dxd(cont, cmd):
    return subprocess.run(["docker", "exec", "-d", cont, "bash", "-lc", cmd],
                          capture_output=True, text=True, timeout=30)

def die(msg):
    print(f"[ABORT] {msg}")
    sys.exit(1)

# ----------------------------- infrastructure -----------------------------
def link_bw_mbps():
    """Read the actual HTB ceiling on the capped uplink — never hardcode the cap."""
    out = dx(OVS, "tc class show dev eth5").stdout
    m = re.search(r"1:fffe root rate (\d+)([KMG])bit", out)
    if not m:
        die("no HTB root class on ovs eth5 — run lab-up.sh / ovs-restore.sh first")
    mult = {"K": 1e-3, "M": 1.0, "G": 1e3}[m.group(2)]
    return float(m.group(1)) * mult

def netem_readback():
    """Per-hop propagation delay actually installed (wan-qos.sh owns installation).
    Reads the netem under the forward-egress HTB leaves on each router hop; returns
    (total_one_way_ms, "2.5+2.5" breakdown). Dies if any hop is missing its delay —
    a silently absent netem would report WAN results measured on a zero-delay path."""
    per_hop = []
    for r in ROUTERS:
        out = dx(r, "tc qdisc show dev eth2").stdout
        m = re.search(r"netem .*delay ([\d.]+)ms", out)
        if not m:
            die(f"{r}: no netem on eth2 — run wan-qos.sh (lab-up.sh does)")
        per_hop.append(float(m.group(1)))
    return sum(per_hop), "+".join(str(d) for d in per_hop)

def flow_on():
    """DiffServ EF: mark R-SV with DSCP 46 (TOS 184) at the edge + priority queue on
    this hop; bleach every other IP flow (trust boundary). Downstream hops classify by
    DSCP alone — the 'mark once, honored end-to-end' model."""
    for p in SV_PORTS:
        dx(OVS, f"ovs-ofctl add-flow br0 'priority=300,udp,tp_dst={p},actions=mod_nw_tos:184,set_queue:1,NORMAL'")
    dx(OVS, "ovs-ofctl add-flow br0 'priority=100,ip,actions=mod_nw_tos:0,NORMAL'")

def flow_off():
    """Single queue, no marking: without EF marks no downstream hop matches either,
    so one delete makes the whole path best-effort. The bandwidth caps stay."""
    dx(OVS, "ovs-ofctl del-flows br0 'ip'")

def bg_server_start():
    dx(SUB, "pkill iperf3 || true")
    time.sleep(1)
    dxd(SUB, "iperf3 -s -p 5201 >/dev/null 2>&1")
    time.sleep(1)

def bg_start(rate):
    dxd(LOAD, f"iperf3 -c {SINK_IP} -p 5201 -u -b {rate} -l 1200 -t {DUR + 15} >/tmp/iperf_bg.log 2>&1")
    time.sleep(2)
    # iperf3 exits immediately if the server is unreachable — a silently dead load
    # generator turns every "load" condition into an unloaded baseline.
    if dx(LOAD, "pgrep -c iperf3 || true").stdout.strip() in ("", "0"):
        err = dx(LOAD, "tail -2 /tmp/iperf_bg.log 2>/dev/null").stdout.strip()
        die(f"background load died at start ({rate}): {err}")

def bg_stop():
    dx(LOAD, "pkill iperf3 || true")

def ping_baseline():
    out = dx(PUBLISHERS[0]["cont"], f"ping -c 10 -i 0.2 {SINK_IP}").stdout
    m = re.search(r"= [\d.]+/([\d.]+)/", out)
    return float(m.group(1)) if m else None

# ----------------------------- publishers -----------------------------
def pub_alive(cont):
    r = dx(cont, "ps -eo stat,args | grep '[s]v_goose_latency_web' | grep -v 'bash -lc' | grep -vc '^Z'")
    try:
        return int(r.stdout.strip())
    except ValueError:
        return 0

def src_pps(cont, port):
    r = dx(cont, f"n=$(timeout 3 tcpdump -i eth1 -nn 'udp port {port}' 2>/dev/null | wc -l); echo $((n/3))",
           timeout=20)
    try:
        return int(r.stdout.strip())
    except ValueError:
        return 0

def pub_ctl(cont, verb):
    # NB: explicit empty body — this httplib server 400s on a bodyless POST.
    return dx(cont, f'curl -fs -X POST --data "" http://localhost:8080/{verb} >/dev/null && echo ok').stdout.strip() == "ok"

def publishers_start():
    for p in PUBLISHERS:
        dx(p["cont"], "pkill -9 -f sv_goose_latency_web || true")
    time.sleep(2)
    # fresh t_trip source: stale harness CSVs must never win the "newest" race
    dx(PUBLISHERS[0]["cont"], f"rm -f {LOGGER_DIR}/sv_goose_*.csv")
    for p in PUBLISHERS:
        dxd(p["cont"], f"cd {p['cwd']} && {PUB_DIR}/build/sv_goose_latency_web {PUB_DIR}/{p['cfg']} >/dev/null 2>&1")
    time.sleep(3)

def publishers_guard():
    """Exactly one live publisher per container, each at ~4000 pps at its source."""
    for p in PUBLISHERS:
        n = pub_alive(p["cont"])
        if n != 1:
            die(f"{p['cont']}: expected 1 live publisher, found {n} (stacking inflates R-SV)")
    for p in PUBLISHERS:
        pps = src_pps(p["cont"], p["port"])
        if not (SV_PPS_MIN <= pps <= SV_PPS_MAX):
            die(f"{p['cont']}: source rate {pps} pps outside [{SV_PPS_MIN},{SV_PPS_MAX}]")
        print(f"  [guard] {p['cont']}: 1 live publisher @ {pps} pps (udp/{p['port']})")

def publishers_rearm():
    """Stop + start the sim on every publisher: re-arms step/threshold so each
    condition produces a fresh t_trip; smpCnt discontinuity lands before t0."""
    for p in PUBLISHERS:
        pub_ctl(p["cont"], "stop")
    time.sleep(1.5)
    for p in PUBLISHERS:
        if not pub_ctl(p["cont"], "start"):
            die(f"{p['cont']}: POST /start failed")

def t_trip_ms():
    """step -> R-GOOSE latency from the newest harness CSV on vmu1 (GOOSE returns
    to vmu1 only). Includes the netem RTT by design — report it as measured."""
    cont = PUBLISHERS[0]["cont"]
    path = dx(cont, f"ls -t {LOGGER_DIR}/sv_goose_*.csv 2>/dev/null | head -1").stdout.strip()
    if not path:
        return None
    line = dx(cont, f"grep ',goose,' '{path}' 2>/dev/null | head -1").stdout.strip()
    if not line:
        return None
    try:
        return float(line.split(",")[3])
    except (IndexError, ValueError):
        return None

# ----------------------------- subscriber stats -----------------------------
def subscriber_start():
    dx(SUB, "pkill -9 -f merging-unit || true")
    time.sleep(1)
    dx(SUB, f"rm -f {MU_STATS}")
    dxd(SUB, f"cd /tmp && {MU_BIN} >/tmp/mu.log 2>&1")
    time.sleep(3)
    if dx(SUB, "pgrep -fc merging-unit").stdout.strip() in ("", "0"):
        die("merging-unit did not start — check /tmp/mu.log in vied")

def stats_lines():
    out = dx(SUB, f"cat {MU_STATS} 2>/dev/null").stdout
    lines = []
    for ln in out.splitlines():
        try:
            lines.append(json.loads(ln))
        except json.JSONDecodeError:
            continue
    return lines

def snapshot():
    """Newest cumulative record per appid."""
    snap = {}
    for rec in stats_lines():
        snap[rec["appid"]] = rec
    return snap

def wait_streams_live(timeout_s=60):
    want = {p["appid"] for p in PUBLISHERS}
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        snap = snapshot()
        live = {a for a, r in snap.items() if r.get("rate", 0) > SV_PPS_MIN}
        if want <= live:
            return
        time.sleep(2)
    die(f"streams never came up: want appids {sorted(want)}, live {sorted(live)}")

def measure_window(t0_snap, t1_snap, window_recs):
    """Per-stream deltas between snapshots + maxima over the spanned windows."""
    rows = {}
    for appid, s1 in t1_snap.items():
        s0 = t0_snap.get(appid)
        if s0 is None:
            continue
        drx   = s1["rx"] - s0["rx"]
        dlost = s1["lost"] - s0["lost"]
        ddup  = s1["dup"] - s0["dup"]
        djs   = s1["jit_sum_ms"] - s0["jit_sum_ms"]
        djn   = s1["jit_n"] - s0["jit_n"]
        dos   = s1["owd_sum_ms"] - s0["owd_sum_ms"]
        don   = s1["owd_n"] - s0["owd_n"]
        dt    = (s1["ts_ms"] - s0["ts_ms"]) / 1000.0
        wins  = [r for r in window_recs
                 if r["appid"] == appid and s0["ts_ms"] < r["ts_ms"] <= s1["ts_ms"]]
        rows[appid] = {
            "svid":        s1.get("svid", ""),
            "rx":          drx,
            "rate_sas":    round(drx / dt, 1) if dt > 0 else 0.0,
            "lost":        dlost,
            "loss_pct":    round(100.0 * dlost / (drx + dlost), 3) if (drx + dlost) > 0 else 0.0,
            "dup":         ddup,
            "jit_mean_ms": round(djs / djn, 4) if djn > 0 else 0.0,
            "jit_max_ms":  round(max((r["win_jmax_ms"] for r in wins), default=0.0), 3),
            "stalls_5ms":  s1["stalls_5ms"] - s0["stalls_5ms"],
            "dark_16ms":   s1["dark_16ms"] - s0["dark_16ms"],
            "owd_mean_ms": round(dos / don, 2) if don > 0 else -1.0,
            "owd_max_ms":  round(max((r["win_owdmax_ms"] for r in wins), default=0.0), 2),
        }
    return rows

# ----------------------------- one condition -----------------------------
def run_condition(cond, qos, bg, rep, writer, csvf, globals_):
    (flow_on if qos == "on" else flow_off)()
    if bg != "none":
        bg_start(bg)
    publishers_rearm()
    time.sleep(SETTLE_S)               # absorb rearm smpCnt discontinuity pre-t0

    t0 = snapshot()
    time.sleep(DUR)
    all_recs = stats_lines()
    t1 = snapshot()
    trip = t_trip_ms()
    if bg != "none":
        bg_stop()

    for appid, m in sorted(measure_window(t0, t1, all_recs).items()):
        row = {"cond": cond, "qos": qos,
               "bg_mbps": bg.rstrip("M") if bg != "none" else 0,
               "appid": appid, "rep": rep,
               "t_trip_ms": trip if trip is not None else "NA",
               **m, **globals_}
        writer.writerow(row)
        csvf.flush()
        print(f"  [{cond} qos={qos} bg={bg} rep={rep}] appid={appid} rate={m['rate_sas']} sa/s "
              f"loss={m['loss_pct']}% jmax={m['jit_max_ms']}ms dark={m['dark_16ms']} "
              f"owd={m['owd_mean_ms']}/{m['owd_max_ms']}ms trip={trip}")

# ----------------------------- main -----------------------------
def main():
    print(f"== qos_sweep {STAMP}: {len(PUBLISHERS)} R-SV streams, {DUR}s/condition ==")

    if "min-rate" not in dx(OVS, "ovs-vsctl list queue 2>/dev/null").stdout:
        die("OVS queues missing — run lab-up.sh / ovs-restore.sh first")
    bw = link_bw_mbps()
    nm, hops = netem_readback()
    print(f"[setup] link_bw={bw:.0f} Mb/s (HTB read-back), netem={nm} ms one-way over {len(ROUTERS)} hops ({hops})")

    subscriber_start()
    bg_server_start()
    publishers_start()
    for p in PUBLISHERS:
        if not pub_ctl(p["cont"], "start"):
            die(f"{p['cont']}: initial POST /start failed")
    print("[setup] waiting for all streams at the subscriber ...")
    wait_streams_live()
    publishers_guard()
    rtt = ping_baseline()
    print(f"[setup] ping RTT vmu1->vied: {rtt} ms (expect ~2x netem + queueing)")

    globals_ = {"link_bw_mbps": round(bw, 1), "netem_ms": nm, "netem_hops": hops,
                "ping_rtt_ms": rtt}

    with open(OUTCSV, "w", newline="") as csvf:
        writer = csv.DictWriter(csvf, fieldnames=COLS)
        writer.writeheader()
        for rep in range(1, REPS + 1):
            print(f"---- repetition {rep}/{REPS} ----")
            run_condition("baseline", "on", "none", rep, writer, csvf, globals_)
            for bg in LOADS:
                run_condition(f"load{bg}", "off", bg, rep, writer, csvf, globals_)
                run_condition(f"load{bg}", "on",  bg, rep, writer, csvf, globals_)

    bg_stop()
    flow_on()  # leave QoS protecting R-SV
    print(f"\n== done. results: {OUTCSV} ==")

    # headline: darkness off -> on per load (aggregated over streams)
    agg = {}
    with open(OUTCSV) as f:
        for row in csv.DictReader(f):
            if row["cond"] == "baseline":
                continue
            key = (row["cond"], row["qos"])
            agg[key] = agg.get(key, 0) + int(row["dark_16ms"])
    print(f"== darkness>16ms (summed over streams x {REPS} reps) QoS off -> on ==")
    for cond in sorted({c for c, _ in agg}):
        print(f"  {cond:10s}  {agg.get((cond,'off'), '?'):>5} -> {agg.get((cond,'on'), '?')}")

if __name__ == "__main__":
    main()
