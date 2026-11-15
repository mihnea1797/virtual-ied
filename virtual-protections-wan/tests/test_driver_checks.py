#!/usr/bin/env python3
"""Self-check of the pure logic behind the driver's safety checks (no lab needed).
Run:  .venv/bin/python tests/test_driver_checks.py   (prints 'ok').
  parse_flows   decides whether a QoS arm is really in effect (flows_apply read-back);
  snapshot / stats_age_s   decide whether the vIED is still writing stats (require_fresh).
The dump-flows samples are real output of ovs-core in the lab, QoS on and QoS off."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from qos_sweep import parse_flows, snapshot, stats_age_s, measure_window, SV_PORTS

QOS_ON = """NXST_FLOW reply (xid=0x4):
 cookie=0x0, duration=428.843s, table=0, n_packets=206045, n_bytes=40796942, idle_age=377, priority=300,udp,tp_dst=102 actions=mod_nw_tos:184,set_queue:1,NORMAL
 cookie=0x0, duration=428.801s, table=0, n_packets=206018, n_bytes=40791564, idle_age=377, priority=300,udp,tp_dst=103 actions=mod_nw_tos:184,set_queue:1,NORMAL
 cookie=0x0, duration=428.760s, table=0, n_packets=205987, n_bytes=40785426, idle_age=376, priority=300,udp,tp_dst=104 actions=mod_nw_tos:184,set_queue:1,NORMAL
 cookie=0x0, duration=428.719s, table=0, n_packets=120511, n_bytes=23861178, idle_age=431, priority=300,udp,tp_dst=105 actions=mod_nw_tos:184,set_queue:1,NORMAL
 cookie=0x0, duration=428.678s, table=0, n_packets=60262, n_bytes=11931876, idle_age=431, priority=300,udp,tp_dst=106 actions=mod_nw_tos:184,set_queue:1,NORMAL
 cookie=0x0, duration=428.637s, table=0, n_packets=91, n_bytes=8318, idle_age=376, priority=100,ip actions=mod_nw_tos:0,NORMAL
 cookie=0x0, duration=3215.112s, table=0, n_packets=1873, n_bytes=110194, idle_age=373, priority=0 actions=NORMAL
"""
QOS_OFF = """NXST_FLOW reply (xid=0x4):
 cookie=0x0, duration=3215.112s, table=0, n_packets=1873, n_bytes=110194, idle_age=373, priority=0 actions=NORMAL
"""

assert parse_flows(QOS_ON) == (sorted(SV_PORTS), 1), parse_flows(QOS_ON)
assert parse_flows(QOS_OFF) == ([], 0), parse_flows(QOS_OFF)
# a half-applied arm (one add-flow lost) and a missing bleach flow must both differ from 'on'
part = "\n".join(l for l in QOS_ON.splitlines() if "tp_dst=104" not in l)
assert parse_flows(part) == ([102, 103, 105, 106], 1), parse_flows(part)
nobleach = "\n".join(l for l in QOS_ON.splitlines() if "priority=100,ip" not in l)
assert parse_flows(nobleach) == (sorted(SV_PORTS), 0), parse_flows(nobleach)
assert parse_flows("") == ([], 0)                        # failed docker exec: empty text is never 'on'

recs = [{"appid": 16384, "ts_ms": 1000_000, "rx": 10}, {"appid": 16385, "ts_ms": 1000_000, "rx": 20},
        {"appid": 16384, "ts_ms": 1002_000, "rx": 30}]
snap = snapshot(recs)                                    # newest record per appid, no file read
assert snap[16384]["rx"] == 30 and snap[16385]["rx"] == 20, snap
assert stats_age_s(snap, now=1005.0) == 3.0              # age counts from the newest record of any stream
assert stats_age_s({}, now=1005.0) is None               # no records at all: caller treats it as stale

# measure_window: per-window deltas of the vIED's cumulative counters
def rec(ts, rx, lost, **kw):
    r = {"appid": 16384, "svid": "sv1", "ts_ms": ts, "rx": rx, "lost": lost, "dup": 0, "jit_sum_ms": 0.0, "jit_n": 0,
         "win_jmax_ms": 0.0, "stalls_5ms": 0, "dark_16ms": 0, "owd_sum_ms": 0.0, "owd_n": 0, "win_owdmax_ms": 0.0}
    r.update(kw)
    return r
s0, s1 = rec(0, 1000, 5, reordered=2), rec(30_000, 121_000, 9, reordered=7)
m = measure_window({16384: s0}, {16384: s1}, [s0, s1])[16384]
assert (m["rx"], m["lost"], m["reordered"], m["rate_sas"]) == (120_000, 4, 5, 4000.0), m
# a late sample that straddles t0 takes one back out of `lost`: the window reports 0, not -1
m = measure_window({16384: rec(0, 1000, 5, reordered=2)}, {16384: rec(30_000, 121_000, 4, reordered=3)}, [])[16384]
assert (m["lost"], m["loss_pct"], m["reordered"]) == (0, 0.0, 1), m
# stats from a vIED built before the `reordered` field existed: say so instead of inventing a 0
m = measure_window({16384: rec(0, 1000, 5)}, {16384: rec(30_000, 121_000, 9)}, [])[16384]
assert m["reordered"] == "NA", m
print("ok")
