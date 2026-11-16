#!/usr/bin/env python3
"""Self-check of the pure logic behind the two-path driver's read-backs (no lab needed).
Run from virtual-protections-wan/:  .venv/bin/python multipath/tests/test_mp_checks.py   (prints 'ok').

  parse_marking            is the QoS arm really in effect on ovs-a (table 0)?
  parse_pin / parse_trace  which path is the lab pinned to, by flow table and by switch decision?
  parse_netem              per-router delay, per direction
  parse_ovs_map            tunnel options and BFD status as ovs-vsctl prints them
  parse_class_detail       HTB quantum and burst
  params.env arithmetic    the background rates reproduce the paper's load at the shaper
  cpu_util, summarize      host CPU and the acceptance summary

Every sample text is real output of the lab on 2026-11-16."""
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import mp_sweep as m

# ---- marking: `ovs-ofctl dump-flows br0 table=0` on ovs-a, QoS on ----
T0_ON = """NXST_FLOW reply (xid=0x8):
 cookie=0x0, duration=43.782s, table=0, n_packets=176615, n_bytes=34969770, idle_age=0, priority=300,udp,tp_dst=102 actions=mod_nw_tos:184,resubmit(,1)
 cookie=0x0, duration=43.752s, table=0, n_packets=174856, n_bytes=34621488, idle_age=0, priority=300,udp,tp_dst=103 actions=mod_nw_tos:184,resubmit(,1)
 cookie=0x0, duration=43.715s, table=0, n_packets=174737, n_bytes=34597926, idle_age=0, priority=300,udp,tp_dst=104 actions=mod_nw_tos:184,resubmit(,1)
 cookie=0x0, duration=43.686s, table=0, n_packets=0, n_bytes=0, idle_age=228, priority=300,udp,tp_dst=105 actions=mod_nw_tos:184,resubmit(,1)
 cookie=0x0, duration=43.658s, table=0, n_packets=0, n_bytes=0, idle_age=228, priority=300,udp,tp_dst=106 actions=mod_nw_tos:184,resubmit(,1)
 cookie=0x0, duration=43.633s, table=0, n_packets=99, n_bytes=6534, idle_age=0, priority=100,ip actions=mod_nw_tos:0,resubmit(,1)
 cookie=0x0, duration=228.454s, table=0, n_packets=47, n_bytes=2058, idle_age=10, priority=0 actions=resubmit(,1)
"""
T0_OFF = """NXST_FLOW reply (xid=0x8):
 cookie=0x0, duration=228.454s, table=0, n_packets=47, n_bytes=2058, idle_age=10, priority=0 actions=resubmit(,1)
"""
PORTS = [102, 103, 104, 105, 106]
assert m.parse_marking(T0_ON) == (PORTS, 1), m.parse_marking(T0_ON)
assert m.parse_marking(T0_OFF) == ([], 0)
assert m.parse_marking(T0_ON.replace("resubmit(,1)", "goto_table:1")) == (PORTS, 1)      # the other spelling
part = "\n".join(l for l in T0_ON.splitlines() if "tp_dst=104" not in l)                  # one add-flow lost
assert m.parse_marking(part) == ([102, 103, 105, 106], 1)
assert m.parse_marking("\n".join(l for l in T0_ON.splitlines() if "priority=100,ip" not in l)) == (PORTS, 0)
# the paper lab's flows (NORMAL, set_queue) must never read as this lab's marking
assert m.parse_marking(" priority=300,udp,tp_dst=102 actions=mod_nw_tos:184,set_queue:1,NORMAL") == ([], 0)
assert m.parse_marking("") == ([], 0)                                                     # failed docker exec

# ---- pin: `ovs-ofctl --names dump-flows br0 table=1` on ovs-a, pinned to path A ----
T1_A = """ cookie=0x0, duration=43.600s, table=1, n_packets=0, n_bytes=0, priority=200,in_port=vxb actions=drop
 cookie=0x0, duration=43.600s, table=1, n_packets=522123, n_bytes=103380354, priority=150,ip,nw_dst=10.10.30.0/24 actions=output:vxa
 cookie=0x0, duration=43.600s, table=1, n_packets=4, n_bytes=168, priority=150,arp,arp_tpa=10.10.30.0/24 actions=output:vxa
 cookie=0x0, duration=43.599s, table=1, n_packets=6, n_bytes=308, priority=0 actions=NORMAL
"""
assert m.parse_pin(T1_A, "10.10.30.0/24") == ("vxa", "vxa", "vxb")
assert m.parse_pin(T1_A, "10.10.40.0/24") == (None, None, "vxb")                          # the other switch's subnet
half = T1_A.replace("arp,arp_tpa=10.10.30.0/24 actions=output:vxa", "arp,arp_tpa=10.10.30.0/24 actions=output:vxb")
assert m.parse_pin(half, "10.10.30.0/24") == ("vxa", "vxb", "vxb")                        # IP and ARP disagree: caller dies
assert m.parse_pin("", "10.10.30.0/24") == (None, None, None)
both = T1_A + " table=1, priority=150,ip,nw_dst=10.10.30.0/24 actions=output:vxb\n"       # two answers = no answer
assert m.parse_pin(both, "10.10.30.0/24")[0] is None

# ---- switch decision: `ovs-appctl ofproto/trace` ----
TR_RSV = """Final flow: udp,in_port=1,vlan_tci=0x0000,dl_src=00:00:00:00:00:00,dl_dst=00:00:00:00:00:00,nw_src=10.10.40.1,nw_dst=10.10.30.1,nw_tos=184,nw_ecn=0,nw_ttl=64,nw_frag=no,tp_src=0,tp_dst=102
Megaflow: recirc_id=0,eth,udp,in_port=1,nw_dst=10.10.30.0/24,nw_tos=0,nw_ecn=0,nw_frag=no,tp_dst=102
Datapath actions: set(tunnel(tun_id=0x65,src=10.10.51.1,dst=10.10.53.2,tos=0xb8,ttl=64,tp_dst=4789,flags(df|key))),set(ipv4(tos=0xb8/0xfc)),6
"""
t = m.parse_trace(TR_RSV)
assert t["tunnel"] == {"vni": 101, "src": "10.10.51.1", "dst": "10.10.53.2", "outer_tos": 0xb8} and t["inner_tos"] == 0xb8, t
t = m.parse_trace("Datapath actions: set(tunnel(tun_id=0x65,src=10.10.51.1,dst=10.10.53.2,ttl=64,tp_dst=4789,flags(df|key))),set(ipv4(tos=0/0xfc)),6")
assert t["tunnel"]["outer_tos"] == 0 and t["inner_tos"] == 0, t                           # background: reset to DSCP 0
t = m.parse_trace("Datapath actions: set(tunnel(tun_id=0x66,src=10.10.63.2,dst=10.10.61.1,ttl=64,tp_dst=4789,flags(df|key))),3")
assert t["tunnel"]["vni"] == 102 and t["inner_tos"] is None, t                            # R-GOOSE back over path B
t = m.parse_trace("Datapath actions: drop")                                               # input from the unselected tunnel
assert t["tunnel"] is None and t["actions"] == "drop", t
assert m.parse_trace("Bad openflow flow syntax") is None

# ---- netem: `tc qdisc show dev eth2` / `eth1` on r1a ----
FWD = """qdisc htb 1: root refcnt 5 r2q 10 default 0x10 direct_packets_stat 0 direct_qlen 1000
qdisc netem 10: parent 1:10 limit 1000 delay 2.5ms seed 17574191116630549264
qdisc netem 20: parent 1:20 limit 1000 delay 2.5ms seed 1714689934977607520
"""
assert m.parse_netem(FWD) == {"1:10": 2.5, "1:20": 2.5}
assert m.parse_netem("qdisc netem 8003: root refcnt 5 limit 1000 delay 2.5ms seed 7482062207180768246\n") == {"root": 2.5}
assert m.parse_netem("qdisc netem 8003: root refcnt 5 limit 1000 delay 500us\n") == {"root": 0.5}   # tc switches units
assert m.parse_netem("qdisc netem 8003: root refcnt 5 limit 1000 delay 1s\n") == {"root": 1000.0}
assert m.parse_netem("qdisc htb 1: root refcnt 5 r2q 10 default 0x10\n") == {}                      # no netem: caller dies
assert m.hops([2.5, 2.5]) == "2.5+2.5" and m.hops([10.0, 2.5]) == "10+2.5"

# ---- OVSDB maps ----
opt = m.parse_ovs_map('{dst_port="4789", key="101", local_ip="10.10.51.1", remote_ip="10.10.53.2", tos=inherit}')
assert opt == {"dst_port": "4789", "key": "101", "local_ip": "10.10.51.1", "remote_ip": "10.10.53.2", "tos": "inherit"}, opt
bfd = m.parse_ovs_map('{diagnostic="No Diagnostic", flap_count="1", forwarding="true", remote_diagnostic="No Diagnostic", remote_state=up, state=up}')
assert (bfd["state"], bfd["remote_state"], bfd["forwarding"], bfd["flap_count"]) == ("up", "up", "true", "1"), bfd
down = m.parse_ovs_map('{diagnostic="Control Detection Time Expired", flap_count="2", forwarding="false", remote_diagnostic="No Diagnostic", remote_state=down, state=down}')
assert (down["state"], down["forwarding"], down["diagnostic"]) == ("down", "false", "Control Detection Time Expired"), down
assert m.parse_ovs_map("") == {}

# ---- HTB class detail: `tc -d class show dev eth5` on ovs-a ----
CLS = """class htb 1:1 parent 1:fffe prio 0 quantum 12500 rate 1250Kbit ceil 37500Kbit linklayer ethernet burst 9564b/1mpu 60b cburst 9564b/1mpu 60b level 0
 Sent 3618 bytes 33 pkt (dropped 0, overlimits 0 requeues 0)
 backlog 0b 0p requeues 0
class htb 1:fffe root rate 37500Kbit ceil 37500Kbit linklayer ethernet burst 9499b/1mpu 60b cburst 9499b/1mpu 60b level 7
 Sent 3618 bytes 33 pkt (dropped 0, overlimits 0 requeues 0)
 backlog 0b 0p requeues 0
class htb 1:2 parent 1:fffe prio 0 quantum 200000 rate 25Mbit ceil 37500Kbit linklayer ethernet burst 9564b/1mpu 60b cburst 9564b/1mpu 60b level 0
 Sent 0 bytes 0 pkt (dropped 0, overlimits 0 requeues 0)
 backlog 0b 0p requeues 0
"""
assert m.parse_class_detail(CLS, "1:1") == {"quantum": 12500, "burst_b": 9564}
assert m.parse_class_detail(CLS, "1:2") == {"quantum": 200000, "burst_b": 9564}
assert m.parse_class_detail(CLS, "1:fffe") == {"quantum": None, "burst_b": 9499}          # inner class: no quantum
assert m.parse_class_detail(CLS, "1:20") is None
# the paper driver's parser reads the same text (rates in kbit, with the -d detail on the line)
s = m.q.parse_htb_class(CLS, "1:2")
assert (s["rate_mbps"], s["ceil_mbps"]) == (25.0, 37.5), s
s = m.q.parse_htb_class(CLS, "1:1")
assert (s["rate_mbps"], s["ceil_mbps"], s["pkts"]) == (1.25, 37.5, 33), s

# ---- params.env: the numbers approved at checkpoint 1 ----
P = m.P
assert (m.RSV_TUNNEL_B, m.BG_TUNNEL_B) == (248, 1292)
for new, paper in (("CEIL_KBIT", 30000), ("EF_RATE_KBIT", 20000), ("EF_CEIL_KBIT", 30000),
                   ("BE_ACCESS_RATE_KBIT", 1000), ("BE_ROUTER_RATE_KBIT", 10000)):
    assert int(P[new]) == paper * 1.25, (new, P[new])                                     # every rate and ceiling x 1.25
ceil = int(P["CEIL_KBIT"]) / 1000
assert abs(m.offered_load_pct(12000, 0, ceil) - 63.49) < 0.01                             # R-SV alone
# each level offers the same fraction of the ceiling, at the shaper, as the paper's run did at Layer 2
for label, paper_b in (("90", 9), ("105", 13), ("120", 18), ("140", 24)):
    paper_pct = 100 * (3 * 198 * 8 * 4000 / 1e6 + paper_b * 1242 / 1200) / 30
    assert abs(m.offered_load_pct(12000, m.LEVELS[label], ceil) - paper_pct) < 0.01, (label, paper_pct)
assert m.LEVELS["60"] == 0 and m.cond_name("60") == "baseline" and m.cond_name("140") == "load140"
assert m.TUN2PATH == {"vxa": "a", "vxb": "b"} and m.OTHER["a"] == "b"

# ---- host CPU ----
with tempfile.TemporaryDirectory() as d:
    f0, f1 = pathlib.Path(d, "s0"), pathlib.Path(d, "s1")
    f0.write_text("cpu  100 0 100 800 0 0 0 0 0 0\ncpu0 60 0 40 400 0 0 0 0 0 0\ncpu1 40 0 60 400 0 0 0 0 0 0\nintr 1\n")
    f1.write_text("cpu  160 0 140 880 20 0 0 0 0 0\ncpu0 110 0 70 420 0 0 0 0 0 0\ncpu1 50 0 70 460 20 0 0 0 0 0\nintr 2\n")
    c0, c1 = m.cpu_read(f0), m.cpu_read(f1)
assert set(c0) == {"cpu", "cpu0", "cpu1"}, c0                                             # stops at the first non-cpu line
tot, core = m.cpu_util(c0, c1)
assert abs(tot - 50.0) < 1e-9 and abs(core - 80.0) < 1e-9, (tot, core)                    # iowait counts as idle
assert m.cpu_util(c0, c0) == (0.0, 0.0)                                                   # no time passed: no division

# ---- the VM's clock: (monotonic, raw, host RTC - system clock) ----
adj, pause = m.clock_delta((100.0, 50.0, -0.4), (132.0, 82.0, -0.9))                     # a healthy 32 s window
assert abs(adj) < 1e-6 and abs(pause + 0.5) < 1e-9 and m.clock_verdict(adj, pause) is None
adj, pause = m.clock_delta((100.0, 50.0, 1392.2), (132.0, 79.538, 1389.6))               # 2026-11-16: slewing 8.33 % fast
assert abs(adj - 2462.0) < 1e-6 and "slewed" in m.clock_verdict(adj, pause), (adj, pause)
adj, pause = m.clock_delta((100.0, 50.0, -0.4), (132.0, 82.0, 1422.3))                   # the VM was paused 23.7 min
assert abs(adj) < 1e-6 and "paused" in m.clock_verdict(adj, pause), (adj, pause)
assert m.clock_delta((1.0, 1.0, None), (2.0, 2.0, None)) == (0.0, None)                  # no RTC: only the rate check
assert m.clock_verdict(0.2, None) is None and m.clock_verdict(-6.0, None) is not None
assert "clock_adj_ms" in m.COLS and "vm_pause_s" in m.COLS

# ---- acceptance summary: one t_trip per window, however many stream rows it has ----
def row(cond, rep, trip, drops=0, flaps=0):
    return {"cond": cond, "qos": "on", "rep": str(rep), "t_trip_ms": trip, "ef_class_drops": str(drops), "bfd_sel_flaps": str(flaps)}
rows = [row("baseline", 1, "18.2")] * 3 + [row("baseline", 2, "18.4")] * 3 + [row("baseline", 3, "NA")] * 3 \
     + [row("load140", 1, "21.0", drops=5, flaps=1)] * 3
s = m.summarize(rows)
assert s[("baseline", "on")] == {"trips": [18.2, 18.4], "na": 1, "ef_drops": 0, "bfd_sel_flaps": 0, "windows": 3}, s
assert s[("load140", "on")] == {"trips": [21.0], "na": 0, "ef_drops": 5, "bfd_sel_flaps": 1, "windows": 1}, s
print("ok")
