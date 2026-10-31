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
SV_PORTS = [102, 103, 104, 105, 106]   # one UDP port per merging-unit R-session (parallel decrypt at vIED);
                                        # 105/106 = boundary-sweep load streams (LOAD_PUBLISHERS)

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
    {"cont": "clab-vied-lab-vmu3", "cfg": "config-vmu3.json", "ip": "10.10.40.3", "appid": 16386, "port": 104,
     "cwd": "/tmp"},
]
# Boundary sweep (--campaign boundary): extra R-SV load streams beyond the three
# protection streams, WITHOUT new containers (topology unchanged): each is a second
# publisher PROCESS hosted in vmu2/vmu3 with its own IP alias, APPID, R-session port and
# HTTP control port (config "httpPort"). amp1 == amp2 (no amplitude step) so they can
# never trigger the trip that vmu1 times; their sample rate is set per point via
# POST /configure and recorded in stream_rates_sas.
LOAD_PUBLISHERS = [
    {"cont": "clab-vied-lab-vmu2", "cfg": "config-vmu4.json", "ip": "10.10.40.4", "appid": 16387, "port": 105,
     "cwd": "/tmp/vmu4", "http": 8084, "pps": 4000, "load_only": True},
    {"cont": "clab-vied-lab-vmu3", "cfg": "config-vmu5.json", "ip": "10.10.40.5", "appid": 16388, "port": 106,
     "cwd": "/tmp/vmu5", "http": 8085, "pps": 4000, "load_only": True},
]
ACTIVE = list(PUBLISHERS)   # publishers emitting in the current condition (legacy campaign: always the 3)
LOGGER_DIR = PUB_DIR + "/loggerOutput"      # harness CSVs (t_trip source, vmu1 only)
MU_BIN     = "/opt/virtual-merging-unit/merging-unit"
MU_STATS   = "/tmp/mu-stats.jsonl"

# ----------------------------- experiment -----------------------------
DUR        = 30          # measured seconds per condition
SETTLE_S   = 4           # after (re)arming publishers, before the t0 snapshot
REPS       = 10          # repetitions per condition (N=3 was too few for error bars)
WARMUP     = True        # run one full unrecorded pass first: the first repetition after a
                         # deploy carries container-settling noise (jmax ~13-25 ms vs ~1-2 ms)
# Background loads: cap is 30M, aggregate R-SV ~18M -> offered totals 90/105/120/140% of cap.
LOADS      = ["9M", "13M", "18M", "24M"]
SV_PPS_MIN, SV_PPS_MAX = 3500, 4500   # per-publisher guard band around 4000 sa/s (scaled for other rates)

# --campaign boundary: aggregate R-SV swept ACROSS the EF guarantee at a saturating
# background (total offered >= 140% at every point). Points are "MU equivalents": the 3
# protection streams (4000 sa/s each, untouched) + load streams at 4000 or 2000 sa/s.
# Nominal Mb/s use the on-wire frame size, i.e. what the HTB shaper actually counts.
RSV_FRAME_B     = 198        # Ethernet bytes per R-SV packet (pcap: analysis/fill-in-sheet.md)
BOUNDARY_BG     = "24M"      # same saturating background as the legacy 140% point
BOUNDARY_POINTS = [          # cond label, [(LOAD_PUBLISHERS index, sa/s), ...]
    ("rsv3.0", []),
    ("rsv3.5", [(0, 2000)]),
    ("rsv4.0", [(0, 4000)]),
    ("rsv4.5", [(0, 4000), (1, 2000)]),
    ("rsv5.0", [(0, 4000), (1, 4000)]),
]
# HTB classes whose kernel counters locate WHERE EF / best-effort packets are dropped:
# (container, dev, EF classid, BE classid) per hop. OVS linux-htb: queue1/queue0 -> 1:2/1:1;
# routers (wan-qos.sh): 1:20/1:10. Read back with `tc -s class show`, never inferred.
HTB_HOPS = [(OVS, "eth5", "1:2", "1:1"),
            (ROUTERS[0], "eth2", "1:20", "1:10"),
            (ROUTERS[1], "eth2", "1:20", "1:10")]

STAMP  = time.strftime("%Y%m%d_%H%M%S")
OUTCSV = f"qos_sweep_{STAMP}.csv"

COLS = ["cond", "qos", "bg_mbps", "appid", "svid",
        "rx", "rate_sas", "lost", "loss_pct", "dup",
        "jit_mean_ms", "jit_max_ms", "stalls_5ms", "dark_16ms",
        "owd_mean_ms", "owd_max_ms", "t_trip_ms",
        "link_bw_mbps", "netem_ms", "ping_rtt_ms",
        "rep", "netem_hops",     # appended: repetition idx, per-hop delay breakdown
        # appended for the boundary sweep (filled in every campaign; legacy columns untouched):
        "n_streams", "stream_rates_sas", "aggregate_rsv_mbps_nominal", "aggregate_rsv_mbps_measured",
        "ef_guarantee_mbps", "ef_class_drops", "ef_class_overlimits", "ef_class_backlog",
        "ef_class_drops_hops", "ef_class_sent_mbps", "be_class_drops", "bg_mbps_measured", "bg_loss_pct",
        # appended: EF class ceiling as read back (work-conserving = ceil at link rate; policed = ceil at EF rate)
        "ef_mode", "ef_ceil_mbps",
        # appended: subscriber-side UDP receive-buffer drops in the window (vIED /proc/net/snmp
        # RcvbufErrors delta) — separates receiver overload from network loss
        "sub_rcvbuf_drops",
        # appended (2026-09-30 re-run): R-GOOSE frames the vIED sent vMU1 during the window,
        # counted by tcpdump at vMU1 — measures the absence of the R-GOOSE storm instead of assuming it
        "rgoose_frames_per_window"]

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

def parse_htb_class(out, classid):
    """One HTB class out of `tc -s class show` text: configured rate, sent bytes/packets, drops,
    overlimits and the current backlog (bytes, packets). None if the class is not in the text.
    Checked by tests/test_htb_parse.py."""
    m = re.search(rf"class htb {re.escape(classid)} [^\n]*?rate (\d+)([KMG])bit ceil (\d+)([KMG])bit[^\n]*\n"
                  rf"\s*Sent (\d+) bytes (\d+) pkt \(dropped (\d+), overlimits (\d+) requeues \d+\)\s*"
                  rf"backlog (\d+)([KMG]?)b (\d+)p", out)   # tc prints e.g. '6Kb' once queued
    if not m:
        return None
    mult = {"K": 1e-3, "M": 1.0, "G": 1e3}
    bmult = {"": 1, "K": 1024, "M": 1024 ** 2, "G": 1024 ** 3}[m.group(10)]
    return {"rate_mbps": float(m.group(1)) * mult[m.group(2)], "ceil_mbps": float(m.group(3)) * mult[m.group(4)],
            "bytes": int(m.group(5)), "pkts": int(m.group(6)),
            "drops": int(m.group(7)), "overlimits": int(m.group(8)),
            "backlog_b": int(m.group(9)) * bmult, "backlog_p": int(m.group(11))}

def htb_class_stats(cont, dev, classid):
    """parse_htb_class() on the live `tc -s class show` of one hop."""
    for attempt in range(3):                     # docker exec can hiccup under load: retry, then die
        r = dx(cont, f"tc -s class show dev {dev}")
        out = r.stdout
        s = parse_htb_class(out, classid)
        if s:
            return s
        time.sleep(0.5)
    die(f"{cont}: HTB class {classid} on {dev} not found — run lab-up.sh (ovs-restore.sh / wan-qos.sh)\n"
        f"  rc={r.returncode} stderr={r.stderr.strip()[:200]!r}\n  stdout tail={out[-300:]!r}")

def sub_rcvbuf_errors():
    """Cumulative UDP RcvbufErrors of the subscriber container (all its sockets): packets the
    kernel dropped because a vIED decrypt thread fell behind. Network drops are not in it."""
    out = dx(SUB, "grep '^Udp:' /proc/net/snmp").stdout.splitlines()
    try:
        keys, vals = out[0].split()[1:], out[1].split()[1:]
        return int(vals[keys.index("RcvbufErrors")])
    except (IndexError, ValueError):
        return -1

# R-GOOSE from the vIED goes to vMU1 only (vied config.json gooseSettings.rSessionSettings:
# remoteAddress 10.10.40.1, remotePort 102); vMU1's own R-SV to 10.10.30.1 does not match.
RGOOSE_FILTER = "udp and src host 10.10.30.1 and dst port 102"
RGOOSE_TXT, RGOOSE_PID = "/tmp/rgoose_window.txt", "/tmp/rgoose_window.pid"

def rgoose_capture_start():
    """tcpdump at vMU1 for the window's R-GOOSE (one line per frame). Expected: one trip frame
    per window (the step), i.e. O(1); the 2026-09-15 storm was 80k-260k. PID-file kill, so an
    independent tcpdump on the same interface (smoke tests) is left alone."""
    cont = PUBLISHERS[0]["cont"]
    dx(cont, f"[ -f {RGOOSE_PID} ] && kill -INT $(cat {RGOOSE_PID}) 2>/dev/null; rm -f {RGOOSE_TXT} {RGOOSE_PID}")
    dxd(cont, f"tcpdump -i eth1 -nn -l -q '{RGOOSE_FILTER}' >{RGOOSE_TXT} 2>/dev/null & echo $! >{RGOOSE_PID}; wait")
    time.sleep(1)                                  # let tcpdump attach before the t0 snapshot

def rgoose_capture_stop():
    cont = PUBLISHERS[0]["cont"]
    dx(cont, f"[ -f {RGOOSE_PID} ] && kill -INT $(cat {RGOOSE_PID}) 2>/dev/null")
    for _ in range(10):
        time.sleep(0.2)
        if dx(cont, f"[ -f {RGOOSE_PID} ] && kill -0 $(cat {RGOOSE_PID}) 2>/dev/null && echo live").stdout.strip() != "live":
            break
    try:   # non-empty lines only: tcpdump emits one bare newline on exit (wc -l would count it)
        return int(dx(cont, f"grep -c . {RGOOSE_TXT}").stdout.strip())
    except ValueError:
        return -1

def htb_snapshot():
    """EF-class and BE-class counters on every hop (lists in HTB_HOPS order)."""
    ef = [htb_class_stats(c, d, e) for c, d, e, _ in HTB_HOPS]
    be = [htb_class_stats(c, d, b) for c, d, _, b in HTB_HOPS]
    return ef, be

def ef_guarantee_readback():
    """The EF class 'rate' (its guarantee) read back from every hop; must agree."""
    rates = {s["rate_mbps"] for s in htb_snapshot()[0]}
    if len(rates) != 1:
        die(f"EF guarantee differs across hops: {sorted(rates)} Mb/s")
    return rates.pop()

def ef_ceil_readback():
    """The EF class 'ceil' read back from every hop; must agree."""
    ceils = {s["ceil_mbps"] for s in htb_snapshot()[0]}
    if len(ceils) != 1:
        die(f"EF ceil differs across hops: {sorted(ceils)} Mb/s")
    return ceils.pop()

def ef_mode_apply(mode):
    """work-conserving: EF ceil = link ceiling (the paper's configuration, EF may borrow);
    policed: EF ceil = EF rate at EVERY hop (RFC 3246-style policing of the EF aggregate).
    Changes only the ceil: OVS queue max-rate (-> HTB class 1:2) and the routers' class 1:20."""
    ef_g, bw = ef_guarantee_readback(), link_bw_mbps()
    ceil = ef_g if mode == "policed" else bw
    q1 = dx(OVS, f"ovs-vsctl --bare --columns=_uuid find queue other_config:min-rate={int(ef_g * 1e6)}").stdout.strip()
    if not q1:
        die("OVS EF queue (min-rate = EF guarantee) not found — run ovs-restore.sh")
    dx(OVS, f"ovs-vsctl set queue {q1} other_config:max-rate={int(ceil * 1e6)}")
    for r in ROUTERS:
        dx(r, f"tc class change dev eth2 parent 1:1 classid 1:20 htb rate {ef_g:g}mbit ceil {ceil:g}mbit")
    time.sleep(1)
    got = ef_ceil_readback()
    if abs(got - ceil) > 0.01:
        die(f"EF ceil read-back {got} Mb/s != requested {ceil} Mb/s ({mode})")
    print(f"[setup] EF mode {mode}: EF class rate {ef_g:g} / ceil {got:g} Mb/s on all {len(HTB_HOPS)} hops (read back)")
    return got

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
    # -J: the end summary (sender bit rate, receiver loss) is parsed by bg_stop(); iperf3
    # prints it on SIGINT as well, so the generator can still be cut when the window ends.
    dx(LOAD, "rm -f /tmp/iperf_bg.log")
    dxd(LOAD, f"iperf3 -c {SINK_IP} -p 5201 -u -b {rate} -l 1200 -t {DUR + 15} -J >/tmp/iperf_bg.log 2>&1")
    time.sleep(2)
    # iperf3 exits immediately if the server is unreachable — a silently dead load
    # generator turns every "load" condition into an unloaded baseline.
    if dx(LOAD, "pgrep -c iperf3 || true").stdout.strip() in ("", "0"):
        err = dx(LOAD, "tail -2 /tmp/iperf_bg.log 2>/dev/null").stdout.strip()
        die(f"background load died at start ({rate}): {err}")

def bg_stop():
    """SIGINT ends the iperf3 test gracefully (summary still written). Returns the
    measured background (sender Mb/s, receiver loss %) or (None, None) if unavailable."""
    dx(LOAD, "pkill -INT -x iperf3 || true")
    for _ in range(10):
        time.sleep(0.5)
        if dx(LOAD, "pgrep -x iperf3 || true").stdout.strip() == "":
            break
    try:
        end = json.loads(dx(LOAD, "cat /tmp/iperf_bg.log 2>/dev/null").stdout)["end"]
        snd, rcv = end["sum"], end.get("sum_received", {})
        # receiver stats exist only if the test ended by itself (not on our SIGINT)
        return round(snd["bits_per_second"] / 1e6, 2), (rcv.get("lost_percent") if rcv.get("packets") else None)
    except (json.JSONDecodeError, KeyError, TypeError):
        return None, None

def ping_baseline():
    out = dx(PUBLISHERS[0]["cont"], f"ping -c 10 -i 0.2 {SINK_IP}").stdout
    m = re.search(r"= [\d.]+/([\d.]+)/", out)
    return float(m.group(1)) if m else None

# ----------------------------- publishers -----------------------------
def pub_alive(cont, cfg):
    # cfg narrows to ONE publisher process when a container hosts several (load streams)
    r = dx(cont, f"ps -eo stat,args | grep '[b]uild/iec61850-lab' | grep '{cfg}' | grep -v 'bash -lc' | grep -vc '^Z'")
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

def pub_ctl(cont, verb, http=8080, body=""):
    # NB: explicit (possibly empty) body — this httplib server 400s on a bodyless POST.
    return dx(cont, f"curl -fs -X POST -H 'Content-Type: application/json' --data '{body}' "
                    f"http://localhost:{http}/{verb} >/dev/null && echo ok").stdout.strip() == "ok"

def publishers_start():
    for p in PUBLISHERS + LOAD_PUBLISHERS:
        dx(p["cont"], "pkill -9 -x iec61850-lab || true")   # -x: exact name, never the wrapper shell
    time.sleep(2)
    # fresh t_trip source: stale harness CSVs must never win the "newest" race
    dx(PUBLISHERS[0]["cont"], f"rm -f {LOGGER_DIR}/sv_goose_*.csv")
    for p in ACTIVE:
        if p.get("load_only"):   # IP alias on the hosting container (idempotent) + private cwd
            dx(p["cont"], f"ip addr add {p['ip']}/24 dev eth1 2>/dev/null; mkdir -p {p['cwd']}")
        dxd(p["cont"], f"cd {p['cwd']} && {PUB_DIR}/build/iec61850-lab {PUB_DIR}/{p['cfg']} >/dev/null 2>&1")
    time.sleep(3)

def publishers_guard():
    """Exactly one live publisher process per stream, each at its configured pps at the source."""
    for p in ACTIVE:
        n = pub_alive(p["cont"], p["cfg"])
        if n != 1:
            die(f"{p['cont']}/{p['cfg']}: expected 1 live publisher, found {n} (stacking inflates R-SV)")
    for p in ACTIVE:
        pps = src_pps(p["cont"], p["port"])
        lo, hi = SV_PPS_MIN * p.get("pps", 4000) / 4000, SV_PPS_MAX * p.get("pps", 4000) / 4000
        if not (lo <= pps <= hi):
            die(f"{p['cont']}/{p['cfg']}: source rate {pps} pps outside [{lo:.0f},{hi:.0f}]")
        print(f"  [guard] {p['cont']}/{p['cfg']}: 1 live publisher @ {pps} pps (udp/{p['port']})")

def publishers_rearm():
    """Stop + start the sim on every publisher: re-arms step/threshold so each
    condition produces a fresh t_trip; smpCnt discontinuity lands before t0.
    Load streams not in ACTIVE stay stopped; active ones get this point's sample rate."""
    for p in PUBLISHERS + LOAD_PUBLISHERS:
        pub_ctl(p["cont"], "stop", p.get("http", 8080))
    time.sleep(1.5)
    for p in ACTIVE:
        if p.get("load_only"):   # applied by the following /start
            pub_ctl(p["cont"], "configure", p["http"], json.dumps({"sampleRate": p["pps"]}))
        if not pub_ctl(p["cont"], "start", p.get("http", 8080)):
            die(f"{p['cont']}/{p['cfg']}: POST /start failed")

def publishers_restart():
    """Fresh publisher PROCESSES for every stream + liveness re-check. Called at the start of
    every boundary repetition: the publisher leaks memory while its UDP socket is back-pressured
    (~30 MB/min per process behind a saturated EF class); over a 90-min policed campaign that
    reached the host OOM killer (vmu3 at 1.7 GB RSS). Verification runs like the setup check:
    marking off, load streams at 2000 sa/s, so the 25 Mb/s fit the 30 Mb/s link."""
    global ACTIVE
    flow_off()
    for p in LOAD_PUBLISHERS:
        p["pps"] = 2000
    ACTIVE = PUBLISHERS + LOAD_PUBLISHERS
    publishers_start()
    for p in ACTIVE:
        if p.get("load_only"):
            pub_ctl(p["cont"], "configure", p["http"], json.dumps({"sampleRate": p["pps"]}))
        if not pub_ctl(p["cont"], "start", p.get("http", 8080)):
            die(f"{p['cont']}/{p['cfg']}: POST /start failed after process restart")
    wait_streams_live()

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
    want = {p["appid"] for p in ACTIVE}
    thr = {p["appid"]: SV_PPS_MIN * p.get("pps", 4000) / 4000 for p in ACTIVE}
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        snap = snapshot()
        live = {a for a, r in snap.items() if r.get("rate", 0) > thr.get(a, SV_PPS_MIN)}
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

    rgoose_capture_start()                           # R-GOOSE count at vMU1 spans exactly the window
    w0 = time.time(); ef0, be0 = htb_snapshot()      # HTB class counters BEFORE the window
    rb0 = sub_rcvbuf_errors()
    t0 = snapshot()
    bl_max = 0
    for i in range(DUR):
        time.sleep(1)
        if i % 3 == 2:                               # EF backlog sampled every 3 s (max kept)
            bl_max = max(bl_max, sum(s["backlog_p"] for s in htb_snapshot()[0]))
    all_recs = stats_lines()
    t1 = snapshot()
    ef1, be1 = htb_snapshot(); w1 = time.time()      # ... and AFTER
    rb1 = sub_rcvbuf_errors()
    rgoose_n = rgoose_capture_stop()
    trip = t_trip_ms()
    bg_meas, bg_loss = None, None
    if bg != "none":
        bg_meas, bg_loss = bg_stop()

    active = {p["appid"] for p in ACTIVE}
    win = {a: m for a, m in measure_window(t0, t1, all_recs).items() if a in active}
    ef_drops = [b["drops"] - a["drops"] for a, b in zip(ef0, ef1)]
    extra = {
        "n_streams": len(ACTIVE),
        "stream_rates_sas": "+".join(str(p.get("pps", 4000)) for p in ACTIVE),
        "aggregate_rsv_mbps_nominal": round(sum(p.get("pps", 4000) for p in ACTIVE) * RSV_FRAME_B * 8 / 1e6, 2),
        "aggregate_rsv_mbps_measured": round(sum(m["rate_sas"] for m in win.values()) * RSV_FRAME_B * 8 / 1e6, 2),
        "ef_class_drops": sum(ef_drops),
        "ef_class_overlimits": sum(b["overlimits"] - a["overlimits"] for a, b in zip(ef0, ef1)),
        "ef_class_backlog": bl_max,                                    # max packets queued, all hops
        "ef_class_drops_hops": "+".join(str(d) for d in ef_drops),     # ovs+router1+router2
        "ef_class_sent_mbps": round((ef1[0]["bytes"] - ef0[0]["bytes"]) * 8 / (w1 - w0) / 1e6, 2),  # OVS hop
        "be_class_drops": sum(b["drops"] - a["drops"] for a, b in zip(be0, be1)),
        "bg_mbps_measured": bg_meas if bg_meas is not None else "NA",
        "bg_loss_pct": bg_loss if bg_loss is not None else "NA",
        "sub_rcvbuf_drops": (rb1 - rb0) if (rb0 >= 0 and rb1 >= 0) else "NA",
        "rgoose_frames_per_window": rgoose_n if rgoose_n >= 0 else "NA",
    }
    for appid, m in sorted(win.items()):
        row = {"cond": cond, "qos": qos,
               "bg_mbps": bg.rstrip("M") if bg != "none" else 0,
               "appid": appid, "rep": rep,
               "t_trip_ms": trip if trip is not None else "NA",
               **m, **globals_, **extra}
        writer.writerow(row)
        csvf.flush()
        print(f"  [{cond} qos={qos} bg={bg} rep={rep}] appid={appid} rate={m['rate_sas']} sa/s "
              f"loss={m['loss_pct']}% jmax={m['jit_max_ms']}ms dark={m['dark_16ms']} "
              f"owd={m['owd_mean_ms']}/{m['owd_max_ms']}ms trip={trip}")
    print(f"  [{cond} qos={qos} bg={bg} rep={rep}] rsv={extra['aggregate_rsv_mbps_nominal']}/"
          f"{extra['aggregate_rsv_mbps_measured']} Mb/s nominal/delivered, EF class sent={extra['ef_class_sent_mbps']} Mb/s "
          f"drops={extra['ef_class_drops_hops']} overlimits={extra['ef_class_overlimits']} backlog_max={bl_max}p, "
          f"BE class drops={extra['be_class_drops']}, bg={bg_meas} Mb/s loss={bg_loss}%, "
          f"subscriber rcvbuf drops={extra['sub_rcvbuf_drops']}, R-GOOSE@vMU1={extra['rgoose_frames_per_window']}")

# ----------------------------- main -----------------------------
def set_point(extra):
    """ACTIVE = the 3 protection streams + the listed load streams at their sa/s."""
    global ACTIVE
    ACTIVE = list(PUBLISHERS)
    for idx, pps in extra:
        LOAD_PUBLISHERS[idx]["pps"] = pps
        ACTIVE.append(LOAD_PUBLISHERS[idx])

def main():
    global DUR, REPS, WARMUP, ACTIVE
    import argparse
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--campaign", choices=["legacy", "boundary"], default="legacy",
                    help="legacy: QoS x background-load sweep (default, unchanged); "
                         "boundary: aggregate R-SV across the EF guarantee at saturating background")
    ap.add_argument("--dur", type=int, default=DUR, help=f"measured seconds per condition (default {DUR})")
    ap.add_argument("--reps", type=int, default=REPS, help=f"repetitions per condition (default {REPS})")
    ap.add_argument("--no-warmup", action="store_true", help="skip the discarded warm-up pass (smoke tests only)")
    ap.add_argument("--points", default="", help="boundary: comma-separated subset of point labels (smoke tests)")
    ap.add_argument("--first-rep", type=int, default=1,
                    help="boundary: first repetition index to run (resume an interrupted campaign into a new CSV)")
    ap.add_argument("--ef-mode", choices=["work-conserving", "policed"], default="work-conserving",
                    help="boundary: EF class ceil = link rate (work-conserving, paper config) or = EF rate (policed)")
    ap.add_argument("--arms", default="off,on", type=lambda v: v.split(","),
                    help="boundary: QoS arms to run per point, in order (default off,on; smoke tests: on)")
    args = ap.parse_args()
    if set(args.arms) - {"off", "on"}:          # anything else would be run as best-effort but labelled as typed
        ap.error(f"--arms must be a comma list of off/on, got {','.join(args.arms)}")
    DUR, REPS, WARMUP = args.dur, args.reps, WARMUP and not args.no_warmup
    points = [pt for pt in BOUNDARY_POINTS if not args.points or pt[0] in args.points.split(",")]
    if args.campaign == "boundary":
        # Setup verifies every stream the sweep will use, but with the load streams at 2000 sa/s:
        # five streams at 4000 sa/s (31.7 Mb/s at L2) already exceed the 30 Mb/s ceiling and the
        # last-started one is back-pressured below the liveness threshold before any test runs.
        for p in LOAD_PUBLISHERS:
            p["pps"] = 2000
        ACTIVE = PUBLISHERS + LOAD_PUBLISHERS
    print(f"== qos_sweep {STAMP} [{args.campaign}]: {len(ACTIVE)} R-SV streams, {DUR}s/condition, {REPS} reps ==")

    if "min-rate" not in dx(OVS, "ovs-vsctl list queue 2>/dev/null").stdout:
        die("OVS queues missing — run lab-up.sh / ovs-restore.sh first")
    bw = link_bw_mbps()
    nm, hops = netem_readback()
    ef_g = ef_guarantee_readback()
    print(f"[setup] link_bw={bw:.0f} Mb/s (HTB read-back), EF guarantee={ef_g:.0f} Mb/s (EF class rate, all hops), "
          f"netem={nm} ms one-way over {len(ROUTERS)} hops ({hops})")
    if args.campaign == "boundary":
        ef_mode_apply(args.ef_mode)
        # Setup liveness/rate checks run in the single best-effort queue (no EF marking): with EF
        # policed to 20 Mb/s the 25 Mb/s of verification streams would be back-pressured below the
        # liveness threshold. The first condition re-applies the marking it needs.
        flow_off()
    try:
        ef_ceil = ef_ceil_readback()                 # recorded from the data plane, not from the flag
        ef_mode = "policed" if abs(ef_ceil - ef_g) < 0.01 else "work-conserving"

        subscriber_start()
        bg_server_start()
        publishers_start()
        for p in ACTIVE:
            if p.get("load_only"):
                pub_ctl(p["cont"], "configure", p["http"], json.dumps({"sampleRate": p["pps"]}))
            if not pub_ctl(p["cont"], "start", p.get("http", 8080)):
                die(f"{p['cont']}/{p['cfg']}: initial POST /start failed")
        print("[setup] waiting for all streams at the subscriber ...")
        wait_streams_live()
        publishers_guard()
        rtt = ping_baseline()
        print(f"[setup] ping RTT vmu1->vied: {rtt} ms (expect ~2x netem + queueing)")

        globals_ = {"link_bw_mbps": round(bw, 1), "netem_ms": nm, "netem_hops": hops,
                    "ping_rtt_ms": rtt, "ef_guarantee_mbps": round(ef_g, 1),
                    "ef_mode": ef_mode, "ef_ceil_mbps": round(ef_ceil, 1)}

        campaign(args, points, globals_)
    finally:
        if args.campaign == "boundary" and args.ef_mode != "work-conserving":
            ef_mode_apply("work-conserving")   # always leave the paper's EF configuration behind, even on abort

def campaign(args, points, globals_):
    with open(OUTCSV, "w", newline="") as csvf:
        writer = csv.DictWriter(csvf, fieldnames=COLS)
        writer.writeheader()
        if args.campaign == "boundary":
            if WARMUP:
                print("---- warm-up (discarded: post-deploy settling) ----")
                import io
                null = csv.DictWriter(io.StringIO(), fieldnames=COLS)
                set_point(points[-1][1])
                run_condition("warmup", "on", BOUNDARY_BG, 0, null, io.StringIO(), globals_)
                run_condition("warmup", "off", BOUNDARY_BG, 0, null, io.StringIO(), globals_)
            for rep in range(args.first_rep, REPS + 1):
                print(f"---- repetition {rep}/{REPS} ----")
                publishers_restart()      # bound the publisher memory leak to one repetition
                for label, extra in points:
                    set_point(extra)
                    for arm in args.arms:
                        run_condition(label, arm, BOUNDARY_BG, rep, writer, csvf, globals_)
            set_point([])   # leave the load streams stopped
            publishers_rearm()
        else:
            if WARMUP:
                print("---- warm-up (discarded: post-deploy settling) ----")
                import io
                null = csv.DictWriter(io.StringIO(), fieldnames=COLS)
                run_condition("warmup", "on", "none", 0, null, io.StringIO(), globals_)
                run_condition("warmup", "off", LOADS[-1], 0, null, io.StringIO(), globals_)
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
