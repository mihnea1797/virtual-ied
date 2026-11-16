#!/usr/bin/env python3
"""
mp_sweep.py — driver for the two-path lab (vied-mp), phase 1: build and accept.

The paper's driver (../qos_sweep.py) is imported, not copied: publishers, vIED, background
generator, per-stream metrics, HTB counters, R-GOOSE count and t_trip are measured by the SAME
code, pointed at this lab's containers. What is new here:

  - a per-run path pin (--path a|b): R-SV, background and R-GOOSE all use one tunnel;
  - the extended read-back, taken from the data plane before every run and compared with
    params.env: class rates/ceilings on every shaped interface, netem per router per direction
    per path, the pin (flow tables AND the switches' own forwarding decision for sample packets),
    both VXLAN tunnels with the outer-DSCP copy, BFD of both tunnels, MTU, ping RTT;
  - per window: BFD state before/after and flaps, packets on the path that should be idle,
    the mean frame size the access-hop EF class counted, and the host's CPU load.

Phase 1 runs no redundancy test: one path carries everything, the other only its BFD session.

Run from virtual-protections-wan/ with the lab up (multipath/mp-lab-up.sh); output lands next to
this file as mp_sweep_<stamp>_path<x>.csv plus the read-back as ..._readback.json:
  .venv/bin/python -u multipath/mp_sweep.py --path a --readback-only    # read-back printout, no traffic
  .venv/bin/python -u multipath/mp_sweep.py --path a                    # acceptance: no background + 140 %
"""

import argparse
import csv
import io
import json
import os
import pathlib
import re
import random
import signal
import socket
import struct
import subprocess
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import qos_sweep as q          # noqa: E402  the paper driver; its module globals are re-pointed in bind_paper_driver()


# ----------------------------- parameters -----------------------------
def load_params(path=HERE / "params.env"):
    """params.env as a dict of strings (literal KEY=VALUE lines; '#' starts a comment)."""
    out = {}
    for ln in pathlib.Path(path).read_text().splitlines():
        ln = ln.split("#", 1)[0].strip()
        if "=" in ln:
            k, v = ln.split("=", 1)
            out[k.strip()] = v.strip().strip('"')
    return out

P = load_params()
PFX = P["PFX"]
OVS_A, OVS_B = f"{PFX}-ovs-a", f"{PFX}-ovs-b"
EF_TOS = int(P["EF_TOS"])
OVERHEAD_B = int(P["TUNNEL_OVERHEAD_B"])
RSV_TUNNEL_B = int(P["RSV_FRAME_B"]) + OVERHEAD_B          # 248: what every shaper of this lab counts
BG_TUNNEL_B = int(P["BG_FRAME_B"]) + OVERHEAD_B            # 1292
KBIT = {k: int(P[k]) for k in ("CEIL_KBIT", "EF_RATE_KBIT", "EF_CEIL_KBIT", "BE_ACCESS_RATE_KBIT", "BE_ROUTER_RATE_KBIT")}

def _path(x):
    X = x.upper()
    return {"name": x, "tun": P[f"{X}_TUN"], "vni": int(P[f"{X}_VNI"]),
            "routers": [f"{PFX}-r1{x}", f"{PFX}-r2{x}"],
            "ovsa_dev": P[f"{X}_OVSA_DEV"], "ovsa_ip": P[f"{X}_OVSA_IP"],
            "ovsb_dev": P[f"{X}_OVSB_DEV"], "ovsb_ip": P[f"{X}_OVSB_IP"],
            "delay_ms": float(P[f"{X}_DELAY_MS"])}

PATHS = {"a": _path("a"), "b": _path("b")}
OTHER = {"a": "b", "b": "a"}
TUN2PATH = {PATHS[x]["tun"]: x for x in PATHS}

# Background levels by the paper's label; the value is iperf3 -b in kbit/s (0 = no background).
LEVELS = {k[3:-5]: int(v) for k, v in P.items() if re.fullmatch(r"BG_\d+_KBPS", k)}

STAMP = time.strftime("%Y%m%d_%H%M%S")

# Columns: the paper driver's, then this lab's. Rates in the paper's columns (link_bw_mbps,
# ef_guarantee_mbps, aggregate_rsv_mbps_*) are at the TUNNEL layer here, like the shapers.
MP_COLS = ["path", "bg_iperf_kbps", "offered_load_pct",
           "netem_rev_hops", "other_path_netem_fwd_hops", "other_path_netem_rev_hops",
           "ef_frame_bytes", "ef_class_pkts_hops", "other_path_pkts",
           "bfd_sel_start", "bfd_sel_end", "bfd_sel_flaps", "bfd_other_start", "bfd_other_end", "bfd_other_flaps",
           "host_cpu_mean_pct", "host_cpu_max_pct", "host_core_max_pct",
           # the VM's clock during the window (see clock_read): must be ~0 ms and ~0 s
           "clock_adj_ms", "vm_pause_s", "ntp_step_s"]
COLS = q.COLS + MP_COLS


def bind_paper_driver(path):
    """Point the paper driver's lab layout at this lab and at the selected path. Its functions read
    these module globals at call time, so everything it measures now measures here."""
    q.OVS = OVS_A
    q.ROUTERS = PATHS[path]["routers"]
    q.SUB = f"{PFX}-vied"
    q.LOAD = f"{PFX}-load-src"
    for p in q.PUBLISHERS + q.LOAD_PUBLISHERS:
        p["cont"] = p["cont"].replace("clab-vied-lab", PFX)
    q.ACTIVE = list(q.PUBLISHERS)
    q.SV_PORTS = [int(x) for x in P["SV_PORTS"].split()]
    q.SINK_IP = P["VIED_IP"]
    # EF / best-effort class per hop of the selected path: access hop (ovs-a underlay), r1, r2
    q.HTB_HOPS = [(OVS_A, PATHS[path]["ovsa_dev"], "1:2", "1:1")] + [(r, "eth2", "1:20", "1:10") for r in q.ROUTERS]
    q.RSV_FRAME_B = RSV_TUNNEL_B
    # anything in the paper driver that touches the marking must use this lab's flow layout
    q.flows_apply, q.flow_on, q.flow_off = flows_apply, (lambda: flows_apply(True)), (lambda: flows_apply(False))
    q.ef_mode_apply = lambda mode: q.die("EF mode switching is not part of the two-path lab (phase 1: work-conserving only)")


# ----------------------------- marking (ovs-a table 0) -----------------------------
def parse_marking(out):
    """(sorted UDP ports that get the EF mark, number of reset-to-DSCP-0 flows) out of
    `ovs-ofctl dump-flows br0 table=0` text of ovs-a. goto_table:1 is printed as resubmit(,1)."""
    nxt = r"(?:resubmit\(,1\)|goto_table:1)"
    ef = sorted(int(p) for p in re.findall(rf"\budp,tp_dst=(\d+) actions=mod_nw_tos:{EF_TOS},{nxt}", out))
    bleach = len(re.findall(rf"\bip actions=mod_nw_tos:0,{nxt}", out))
    return ef, bleach

def flows_apply(on):
    """Program the QoS arm on ovs-a (table 0 only; the path pin in table 1 is untouched) and read
    it back — same contract as the paper driver's flows_apply()."""
    want = (sorted(q.SV_PORTS), 1) if on else ([], 0)
    for _ in range(3):
        if on:
            for p in q.SV_PORTS:
                q.dx(OVS_A, f"ovs-ofctl add-flow br0 'table=0,priority=300,udp,tp_dst={p},actions=mod_nw_tos:{EF_TOS},goto_table:1'")
            q.dx(OVS_A, "ovs-ofctl add-flow br0 'table=0,priority=100,ip,actions=mod_nw_tos:0,goto_table:1'")
        else:
            q.dx(OVS_A, "ovs-ofctl del-flows br0 'table=0,ip'")
        r = q.dx(OVS_A, "ovs-ofctl dump-flows br0 table=0")
        got = parse_marking(r.stdout)
        if got == want:
            return
        time.sleep(0.5)
    q.die(f"QoS {'on' if on else 'off'} not in effect on {OVS_A} after 3 attempts: EF-marked ports {got[0]}, "
          f"DSCP-0 flows {got[1]}; wanted {want[0]}, {want[1]}\n  rc={r.returncode} stderr={r.stderr.strip()[:200]!r}")


# ----------------------------- path pin (table 1 on both switches) -----------------------------
def parse_pin(out, remote_net):
    """Out of `ovs-ofctl --names dump-flows br0 table=1`: (tunnel that IP to the other site is sent
    into, tunnel that ARP for the other site is sent into, tunnel whose input is dropped). A part
    that is missing or ambiguous is None."""
    def one(pattern):
        found = re.findall(pattern, out)
        return found[0] if len(found) == 1 else None
    net = re.escape(remote_net)
    return (one(rf"priority=150,ip,nw_dst={net} actions=output:(\w+)"),
            one(rf"priority=150,arp,arp_tpa={net} actions=output:(\w+)"),
            one(r"priority=200,in_port=\"?(\w+)\"? actions=drop"))

def parse_trace(out):
    """What the switch itself would do with a sample packet (`ovs-appctl ofproto/trace`): the
    datapath actions, and out of them the tunnel (VNI, outer source/destination, outer TOS) and the
    TOS written to the inner header. None if there is no datapath action line."""
    m = re.search(r"Datapath actions: (.*)", out)
    if not m:
        return None
    acts = m.group(1).strip()
    res = {"actions": acts, "tunnel": None, "inner_tos": None}
    t = re.search(r"set\(tunnel\(tun_id=(0x[0-9a-f]+),src=([\d.]+),dst=([\d.]+)(?:,tos=(0x[0-9a-f]+))?", acts)
    if t:
        res["tunnel"] = {"vni": int(t.group(1), 16), "src": t.group(2), "dst": t.group(3),
                         "outer_tos": int(t.group(4), 16) if t.group(4) else 0}
    i = re.search(r"set\(ipv4\(tos=(0x[0-9a-f]+|\d+)/0xfc\)\)", acts)
    if i:
        res["inner_tos"] = int(i.group(1), 0)
    return res

def trace(sw, flow):
    r = q.dx(sw, f"ovs-appctl ofproto/trace br0 '{flow}'")
    t = parse_trace(r.stdout)
    if t is None:
        q.die(f"{sw}: ofproto/trace gave no datapath actions for {flow}\n  {r.stdout[-300:]!r} {r.stderr.strip()[:200]!r}")
    return t

def pin_apply(path):
    r = subprocess.run(["bash", str(HERE / "mp-path.sh"), path], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        q.die(f"mp-path.sh {path} failed: {r.stdout.strip()[-300:]} {r.stderr.strip()[-300:]}")

def pin_readback(qos_on=True):
    """Which path the lab is pinned to, read two ways from both switches; dies unless they agree.
      1. the forwarding tables (table 1): site-to-site IP and ARP go into ONE tunnel, the other
         tunnel's input is dropped, and both switches chose the same tunnel;
      2. the switches' own decision for sample packets (ofproto/trace): every R-SV port and the
         background at ovs-a, R-GOOSE at ovs-b — which tunnel, and which DSCP on the outer header.
    Returns (path, details)."""
    d = {"flows": {}, "trace": {}}
    sel = set()
    for sw, net in ((OVS_A, P["LAN_B_NET"]), (OVS_B, P["LAN_A_NET"])):
        ip_t, arp_t, drop_t = parse_pin(q.dx(sw, "ovs-ofctl --names dump-flows br0 table=1").stdout, net)
        d["flows"][sw] = {"ip_to": ip_t, "arp_to": arp_t, "drop_from": drop_t}
        if ip_t is None or ip_t != arp_t or ip_t not in TUN2PATH or drop_t != PATHS[OTHER[TUN2PATH[ip_t]]]["tun"]:
            q.die(f"{sw}: path pin is incomplete or inconsistent: {d['flows'][sw]} — run mp-path.sh a|b")
        sel.add(TUN2PATH[ip_t])
    if len(sel) != 1:
        q.die(f"the two switches are pinned to different paths: {d['flows']}")
    path = sel.pop()
    pa = PATHS[path]

    def expect(name, sw, flow, src, dst, outer_tos, inner_tos):
        t = trace(sw, flow)
        d["trace"][name] = t
        tun = t["tunnel"]
        if tun is None or (tun["src"], tun["dst"], tun["vni"]) != (src, dst, pa["vni"]):
            q.die(f"{name} at {sw} does not enter tunnel {pa['tun']} ({src} -> {dst}, VNI {pa['vni']}): {t['actions']}")
        if tun["outer_tos"] != outer_tos:
            q.die(f"{name} at {sw}: outer TOS {tun['outer_tos']:#x}, expected {outer_tos:#x}: {t['actions']}")
        if inner_tos is not None and t["inner_tos"] != inner_tos:
            q.die(f"{name} at {sw}: inner TOS set to {t['inner_tos']}, expected {inner_tos}: {t['actions']}")

    ef = EF_TOS if qos_on else 0
    for port in q.SV_PORTS:      # R-SV as it leaves a publisher: TOS 0, re-marked at the edge when QoS is on
        expect(f"rsv_udp{port}", OVS_A, f"in_port=eth1,udp,nw_src={P['VMU1_IP']},nw_dst={P['VIED_IP']},udp_dst={port},nw_ttl=64",
               pa["ovsa_ip"], pa["ovsb_ip"], ef, ef if qos_on else None)
    # background sent with a non-zero TOS: must be reset to 0 (trust boundary) when QoS is on
    expect("background", OVS_A, f"in_port=eth4,udp,nw_src={P['LOAD_IP']},nw_dst={P['VIED_IP']},udp_dst=5201,nw_tos=0x20,nw_ttl=64",
           pa["ovsa_ip"], pa["ovsb_ip"], 0 if qos_on else 0x20, 0 if qos_on else None)
    expect("rgoose", OVS_B, f"in_port={P['OVSB_LAN_DEV']},udp,nw_src={P['VIED_IP']},nw_dst={P['VMU1_IP']},udp_dst=102,nw_ttl=64",
           pa["ovsb_ip"], pa["ovsa_ip"], 0, None)
    return path, d


# ----------------------------- shapers, delay -----------------------------
def parse_class_detail(out, classid):
    """quantum and burst (bytes) of one class out of `tc -d class show` text; None where absent."""
    m = re.search(rf"class htb {re.escape(classid)} ([^\n]*)", out)
    if not m:
        return None
    qm, bm = re.search(r"quantum (\d+)", m.group(1)), re.search(r" burst (\d+)b", m.group(1))
    return {"quantum": int(qm.group(1)) if qm else None, "burst_b": int(bm.group(1)) if bm else None}

def shaped_interfaces():
    """Every shaped interface of the lab with the values params.env says it must have:
    (label, container, dev, best-effort = default class, EF class,
     {classid: (role, rate kbit, ceil kbit, quantum, burst)}); None = not pinned in params.env."""
    acc = {"1:fffe": ("total", KBIT["CEIL_KBIT"], KBIT["CEIL_KBIT"], None, int(P["ACCESS_ROOT_BURST_B"])),
           "1:1": ("best effort", KBIT["BE_ACCESS_RATE_KBIT"], KBIT["CEIL_KBIT"], int(P["ACCESS_BE_QUANTUM"]), int(P["ACCESS_BURST_B"])),
           "1:2": ("EF", KBIT["EF_RATE_KBIT"], KBIT["EF_CEIL_KBIT"], int(P["ACCESS_EF_QUANTUM"]), int(P["ACCESS_BURST_B"]))}
    rtr = {"1:1": ("total", KBIT["CEIL_KBIT"], KBIT["CEIL_KBIT"], None, None),
           "1:10": ("best effort", KBIT["BE_ROUTER_RATE_KBIT"], KBIT["CEIL_KBIT"], int(P["ROUTER_BE_QUANTUM"]), None),
           "1:20": ("EF", KBIT["EF_RATE_KBIT"], KBIT["EF_CEIL_KBIT"], int(P["ROUTER_EF_QUANTUM"]), None)}
    out = []
    for x in ("a", "b"):
        out.append((f"ovs-a {PATHS[x]['ovsa_dev']} (path {x.upper()} access hop)", OVS_A, PATHS[x]["ovsa_dev"], "1:1", "1:2", acc))
        for r in PATHS[x]["routers"]:
            out.append((f"{r[len(PFX) + 1:]} eth2 (path {x.upper()})", r, "eth2", "1:10", "1:20", rtr))
    return out

def shaper_readback():
    """Class rates, ceilings, quanta and bursts on every shaped interface, the default class and
    the EF filter, as the kernel reports them. Dies on any difference from params.env."""
    res = []
    for label, cont, dev, be, ef, want in shaped_interfaces():
        cls = q.dx(cont, f"tc -s -d class show dev {dev}").stdout
        qd = q.dx(cont, f"tc qdisc show dev {dev}").stdout
        flt = q.dx(cont, f"tc filter show dev {dev}").stdout
        entry = {"label": label, "classes": {}}
        for cid, (role, rate, ceil, quantum, burst) in want.items():
            s, det = q.parse_htb_class(cls, cid), parse_class_detail(cls, cid)
            if s is None or det is None:
                q.die(f"{label}: HTB class {cid} ({role}) not found — run mp-lab-up.sh")
            got = {"role": role, "rate_kbit": round(s["rate_mbps"] * 1000), "ceil_kbit": round(s["ceil_mbps"] * 1000), **det}
            entry["classes"][cid] = got
            bad = [f"{k} {got[k]} != {w}" for k, w in (("rate_kbit", rate), ("ceil_kbit", ceil), ("quantum", quantum), ("burst_b", burst))
                   if w is not None and got[k] != w]
            if bad:
                q.die(f"{label}: class {cid} ({role}) differs from params.env: " + ", ".join(bad))
        dm = re.search(r"qdisc htb 1: root [^\n]*default (0x[0-9a-f]+)", qd)
        entry["default"] = f"1:{int(dm.group(1), 16):x}" if dm else None
        if entry["default"] != be:
            q.die(f"{label}: default class is {entry['default']}, expected best effort {be}")
        fm = re.search(r"flowid (\S+)[^\n]*\n\s*match 00b80000/00fc0000 at 0", flt)
        entry["ef_filter"] = fm.group(1) if fm else None
        if entry["ef_filter"] != ef:
            q.die(f"{label}: no DSCP-46 filter into the EF class {ef} (found {entry['ef_filter']})")
        res.append(entry)
    return res

def parse_netem(out):
    """{'root' or parent classid: delay in ms} for every netem qdisc in `tc qdisc show dev X` text."""
    unit = {"us": 1e-3, "ms": 1.0, "s": 1e3}
    return {(m.group(2) or "root"): round(float(m.group(3)) * unit[m.group(4)], 6)
            for m in re.finditer(r"qdisc netem \S+ (root|parent (\S+)) [^\n]*?delay ([\d.]+)(us|ms|s)\b", out)}

def netem_readback():
    """Propagation delay installed on every router, per direction, per path:
    {path: {"fwd": [r1, r2], "rev": [r1, r2]}} in ms. Forward = netem under both HTB leaves of
    eth2 (they must agree), reverse = netem at the root of eth1. Dies if any is missing: a silently
    absent netem would report WAN results measured on a zero-delay path."""
    res = {}
    for x in ("a", "b"):
        res[x] = {"fwd": [], "rev": []}
        for r in PATHS[x]["routers"]:
            fwd = parse_netem(q.dx(r, "tc qdisc show dev eth2").stdout)
            rev = parse_netem(q.dx(r, "tc qdisc show dev eth1").stdout)
            if set(fwd) != {"1:10", "1:20"} or fwd["1:10"] != fwd["1:20"]:
                q.die(f"{r}: forward netem under the two eth2 classes missing or unequal: {fwd} — run mp-wan-qos.sh")
            if set(rev) != {"root"}:
                q.die(f"{r}: no reverse netem on eth1: {rev} — run mp-wan-qos.sh")
            res[x]["fwd"].append(fwd["1:20"])
            res[x]["rev"].append(rev["root"])
    return res

def hops(delays):
    return "+".join(f"{d:g}" for d in delays)


# ----------------------------- tunnels, BFD, MTU -----------------------------
def parse_ovs_map(text):
    """An OVSDB map as ovs-vsctl prints it ({a="1", b=x}) -> dict of strings."""
    return {k: v for k, v in re.findall(r'([\w-]+)="?([^",}]*)"?', text)}

def tunnel_readback():
    """Both VXLAN tunnels on both switches: the interface as configured (type, endpoints, VNI,
    tos=inherit), that the datapath really has the port (dpif/show), and that it is excluded from
    flooding. Dies unless every tunnel is present with the outer-DSCP copy on."""
    res = {}
    for sw, loc, rem in ((OVS_A, "ovsa_ip", "ovsb_ip"), (OVS_B, "ovsb_ip", "ovsa_ip")):
        dpif = q.dx(sw, "ovs-appctl dpif/show").stdout
        ports = q.dx(sw, "ovs-ofctl show br0").stdout
        res[sw] = {}
        for x in ("a", "b"):
            pa = PATHS[x]
            lines = q.dx(sw, f"ovs-vsctl get interface {pa['tun']} type ofport options error").stdout.splitlines()
            if len(lines) < 4:
                q.die(f"{sw}: tunnel interface {pa['tun']} not found — run mp-lab-up.sh")
            opt = parse_ovs_map(lines[2])
            dp = re.search(rf"^\s*{pa['tun']} (\d+)/(\d+): \(vxlan: ([^)]*)\)", dpif, re.M)
            nf = re.search(rf"\d+\({pa['tun']}\): addr:\S+\s+config:\s+(\S+)", ports)
            t = {"type": lines[0].strip(), "ofport": int(lines[1]), "options": opt, "error": lines[3].strip(),
                 "datapath_port": int(dp.group(2)) if dp else None, "datapath": dp.group(3) if dp else None,
                 "port_config": nf.group(1) if nf else None}
            res[sw][pa["tun"]] = t
            want = {"key": str(pa["vni"]), "local_ip": pa[loc], "remote_ip": pa[rem], "tos": "inherit", "dst_port": P["VXLAN_PORT"]}
            bad = [f"{k}={opt.get(k)} (want {v})" for k, v in want.items() if opt.get(k) != v]
            if t["type"] != "vxlan" or t["ofport"] <= 0 or bad or t["error"] != "[]":
                q.die(f"{sw}: tunnel {pa['tun']} is not as specified: type={t['type']} ofport={t['ofport']} error={t['error']} {bad}")
            if dp is None or "tos=inherit" not in dp.group(3):
                q.die(f"{sw}: tunnel {pa['tun']} is not in the datapath with tos=inherit: {dp.group(0) if dp else 'absent'}")
            if t["port_config"] != "NO_FLOOD":
                q.die(f"{sw}: tunnel {pa['tun']} is not no-flood ({t['port_config']}) — run mp-ovs.sh")
    return res

def bfd_readback(detail=False):
    """BFD of both tunnels as both switches see it: {tunnel: {"state": "up" or "<ovs-a>/<ovs-b>",
    "flaps": flap counts summed over both ends, "ends": {...}}}. 'up' needs the session up at both
    ends, the peer reported up, and forwarding true. With detail, the negotiated timers are added."""
    res = {}
    for x in ("a", "b"):
        tun = PATHS[x]["tun"]
        ends = {}
        for sw in (OVS_A, OVS_B):
            st = parse_ovs_map(q.dx(sw, f"ovs-vsctl get interface {tun} bfd_status").stdout)
            if "state" not in st:
                q.die(f"{sw}: no BFD status on {tun} — is bfd:enable set? (mp-ovs.sh)")
            ends[sw] = st
            if detail:
                show = q.dx(sw, f"ovs-appctl bfd/show {tun}").stdout
                st["timers"] = {k.strip(): v.strip() for k, v in re.findall(
                    r"^\s*(Detect Multiplier|TX Interval|RX Interval|Local Minimum TX Interval|Local Minimum RX Interval): (.*)$", show, re.M)}
        up = all(e["state"] == "up" and e.get("remote_state") == "up" and e.get("forwarding") == "true" for e in ends.values())
        res[tun] = {"state": "up" if up else "/".join(e["state"] for e in ends.values()),
                    "flaps": sum(int(e.get("flap_count", 0)) for e in ends.values()), "ends": ends}
    return res

def mtu_readback():
    """MTU of every underlay interface and of the host links, from sysfs. Dies if the largest
    background packet does not fit the tunnel without fragmentation."""
    def mtu(cont, dev):
        try:
            return int(q.dx(cont, f"cat /sys/class/net/{dev}/mtu").stdout.strip())
        except ValueError:
            q.die(f"{cont}: cannot read the MTU of {dev}")
    under, host = {}, {}
    for x in ("a", "b"):
        pa = PATHS[x]
        under[f"ovs-a {pa['ovsa_dev']}"] = mtu(OVS_A, pa["ovsa_dev"])
        for r in pa["routers"]:
            for dev in ("eth1", "eth2"):
                under[f"{r[len(PFX) + 1:]} {dev}"] = mtu(r, dev)
        under[f"ovs-b {pa['ovsb_dev']}"] = mtu(OVS_B, pa["ovsb_dev"])
    for name, cont in (("vmu1", q.PUBLISHERS[0]["cont"]), ("load-src", q.LOAD), ("vied", q.SUB)):
        host[f"{name} eth1"] = mtu(cont, "eth1")
    bg_outer_ip = int(P["BG_FRAME_B"]) - 14 + OVERHEAD_B          # inner frame + VXLAN 8 + UDP 8 + IP 20
    if bg_outer_ip > min(under.values()):
        q.die(f"background packet needs {bg_outer_ip} B in the tunnel, underlay MTU is {min(under.values())}")
    return {"underlay": under, "host": host, "bg_outer_ip_b": bg_outer_ip,
            "largest_host_packet_fits": max(host.values()) + OVERHEAD_B <= min(under.values())}


# ----------------------------- the full read-back -----------------------------
def full_readback(path_wanted, qos_on=True):
    """Everything the spec asks to be read from the data plane before a run. Every item is compared
    with params.env / the requested path and the run is aborted on a difference; what was read is
    returned (and printed by print_readback)."""
    rb = {"stamp": STAMP, "clock": clock_readback(), "shapers": shaper_readback(), "netem": netem_readback()}
    rb["path"], rb["pin"] = pin_readback(qos_on)
    if rb["path"] != path_wanted:
        q.die(f"lab is pinned to path {rb['path']}, run asked for path {path_wanted}")
    rb["tunnels"] = tunnel_readback()
    rb["bfd"] = bfd_readback(detail=True)
    rb["mtu"] = mtu_readback()
    for x in ("a", "b"):
        if rb["bfd"][PATHS[x]["tun"]]["state"] != "up":
            q.die(f"BFD of tunnel {PATHS[x]['tun']} (path {x}) is {rb['bfd'][PATHS[x]['tun']]['state']}, not up — a path is broken before the run")
    return rb

def print_readback(rb):
    sel = rb["path"]
    print(f"[readback] ---- data plane, {time.strftime('%Y-%m-%d %H:%M:%S')} ----")
    print("[readback] 1. shaped interfaces (kernel: tc class/qdisc/filter), rate / ceiling in kbit/s:")
    for e in rb["shapers"]:
        c = "; ".join(f"{v['role']} {cid} {v['rate_kbit']}/{v['ceil_kbit']}"
                      + (f" q{v['quantum']}" if v["quantum"] else "") + f" burst {v['burst_b']}"
                      for cid, v in e["classes"].items())
        print(f"    {e['label']:34s} {c}; default {e['default']}; DSCP 46 -> {e['ef_filter']}")
    print("[readback] 2. netem delay per router, per direction (ms):")
    for x in ("a", "b"):
        n = rb["netem"][x]
        print(f"    path {x.upper()}: forward r1{x} {n['fwd'][0]:g} + r2{x} {n['fwd'][1]:g} = {sum(n['fwd']):g};  "
              f"reverse r1{x} {n['rev'][0]:g} + r2{x} {n['rev'][1]:g} = {sum(n['rev']):g}")
    print(f"[readback] 3. path pin: path {sel.upper()} (tunnel {PATHS[sel]['tun']})")
    for sw, f in rb["pin"]["flows"].items():
        print(f"    {sw[len(PFX) + 1:]} flow table: site-to-site IP -> {f['ip_to']}, ARP -> {f['arp_to']}, input dropped from {f['drop_from']}")
    for name, t in rb["pin"]["trace"].items():
        tun = t["tunnel"]
        inner = "" if t["inner_tos"] is None else f", inner TOS set to {t['inner_tos']:#04x}"
        print(f"    switch decision for {name:10s}: tunnel {tun['src']} -> {tun['dst']} VNI {tun['vni']}, "
              f"outer TOS {tun['outer_tos']:#04x} (DSCP {tun['outer_tos'] >> 2}){inner}")
    print("[readback] 4. VXLAN tunnels (interface + datapath port) and outer-DSCP copy:")
    for sw, tuns in rb["tunnels"].items():
        for name, t in tuns.items():
            o = t["options"]
            print(f"    {sw[len(PFX) + 1:]} {name}: {t['type']} VNI {o['key']} {o['local_ip']} -> {o['remote_ip']} udp/{o['dst_port']}, "
                  f"tos={o['tos']}, OpenFlow port {t['ofport']}, datapath port {t['datapath_port']}, {t['port_config']}")
    print("[readback] 5. BFD:")
    for x in ("a", "b"):
        b = rb["bfd"][PATHS[x]["tun"]]
        ends = "; ".join(f"{sw[len(PFX) + 1:]} state={e['state']} remote={e.get('remote_state')} forwarding={e.get('forwarding')} flaps={e.get('flap_count')}"
                         for sw, e in b["ends"].items())
        tm = next(iter(b["ends"].values())).get("timers", {})
        print(f"    {PATHS[x]['tun']} (path {x.upper()}): {b['state'].upper()} — {ends}")
        print(f"        timers: min TX {tm.get('Local Minimum TX Interval')}, min RX {tm.get('Local Minimum RX Interval')}, "
              f"in use TX {tm.get('TX Interval')} / RX {tm.get('RX Interval')}, detect multiplier {tm.get('Detect Multiplier')}")
    m = rb["mtu"]
    print(f"[readback] 6. MTU: underlay {sorted(set(m['underlay'].values()))} on {len(m['underlay'])} interfaces, "
          f"host links {sorted(set(m['host'].values()))}; largest background packet in the tunnel {m['bg_outer_ip_b']} B IP "
          f"-> no fragmentation; a full-size host packet fits: {m['largest_host_packet_fits']}")
    ck = rb["clock"]
    print(f"[readback] 7. clock: system clock moved {ck['adj_ms_in_2s']:+.3f} ms against the raw clock in 2 s (limit {CLOCK_ADJ_MAX_MS:g}); "
          f"host RTC - system clock = {ck['rtc_minus_system_s']} s (limit {RTC_OFFSET_MAX_S:g}); "
          f"internet time - system clock = {ck['ntp_minus_system_s']} s (limit {NTP_OFFSET_MAX_S:g})")
    if "ping_rtt_ms" in rb:
        print(f"[readback] 8. ping RTT vmu1 -> vied through path {sel.upper()}: {rb['ping_rtt_ms']} ms "
              f"({rb.get('ping_note', '')}; paper single-path baseline {P['PING_RTT_REF_MS']} ms)")


# ----------------------------- the VM's clock -----------------------------
# Added after the path A run of 2026-11-16: the VM was paused for ~23 min in the middle of it
# (the host slept). Inside the VM nothing shows that directly — every clock stops together — but
# two windows carried 110-140 ms stalls, and minutes later chrony started to pull the clock back
# by running it 8.3 % fast for hours. Every interval and every rate of the lab (publisher pacing,
# HTB, netem, t_trip) is timed by that clock, so a run must not start or continue in that state.
#   - clock_adj_ms: how far the system clock (NTP-steered) moved against CLOCK_MONOTONIC_RAW
#     (never steered) over an interval. Normal: a fraction of a ms per window; slewing: 2500 ms.
#   - vm_pause_s: change of (host RTC - system clock) over an interval. The emulated RTC followed
#     the HOST's clock through the first pause; 1 s resolution.
#   - ntp_step_s: change of (internet time server - system clock) over an interval, one SNTP packet
#     at each end. Added the same evening: the VM lost another 189 s, and that time the emulated RTC
#     lost them too, so vm_pause_s saw nothing. An outside clock cannot be fooled that way. It is
#     "NA" when no server answers; the other two checks still apply then.
CLOCK_ADJ_MAX_MS = 5.0       # per interval (2 s check at setup, ~32 s window)
VM_PAUSE_MAX_S = 1.5         # RTC has 1 s resolution: a change below this is rounding
RTC_OFFSET_MAX_S = 5.0       # |host RTC - system clock| at setup
NTP_STEP_MAX_S = 0.25        # per interval; one SNTP exchange over the internet is good to some tens of ms
NTP_OFFSET_MAX_S = 0.5       # |internet time - system clock| at setup
NTP_SERVERS = ["1.ntp.ubuntu.com", "2.ntp.ubuntu.com", "3.ntp.ubuntu.com", "4.ntp.ubuntu.com"]   # chrony's pool on this VM
RTC_PATH = "/sys/class/rtc/rtc0/since_epoch"

def sntp_offset(packet, t1, t4):
    """Server clock minus local clock (s) out of an SNTP reply and the local send/receive times;
    None for a short packet or a kiss-o'-death (stratum 0)."""
    if len(packet) < 48 or packet[1] == 0:
        return None
    def ts(at):
        sec, frac = struct.unpack("!II", packet[at:at + 8])
        return sec - 2208988800 + frac / 2 ** 32          # NTP epoch 1900 -> Unix epoch
    t2, t3 = ts(32), ts(40)                                # server receive / transmit
    return ((t2 - t1) + (t3 - t4)) / 2

def ntp_offset(timeout=1.0):
    """Internet time minus the system clock in s: one SNTP exchange with a server of the pool chrony
    uses (a second server is tried if the first is silent). None if neither answers. Sent from the
    host, so it never touches the lab's links."""
    for host in random.sample(NTP_SERVERS, k=2):
        try:
            addr = socket.gethostbyname(host)              # resolved before the clock is read
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sk:
                sk.settimeout(timeout)
                t1 = time.time()
                sk.sendto(b"\x23" + 47 * b"\0", (addr, 123))   # LI 0, version 4, mode 3 (client)
                packet, _ = sk.recvfrom(128)
                t4 = time.time()
            off = sntp_offset(packet, t1, t4)
            if off is not None:
                return off
        except OSError:
            continue
    return None

def ntp_step(off0):
    """Change of the internet-time offset since `off0` (s) = time the system clock lost meanwhile.
    A step above the limit is measured a second time before it is believed. None if unknown."""
    if off0 is None:
        return None
    off1 = ntp_offset()
    if off1 is not None and abs(off1 - off0) > NTP_STEP_MAX_S:
        again = ntp_offset()
        if again is not None:
            off1 = again
    return None if off1 is None else off1 - off0

def clock_read():
    """(CLOCK_MONOTONIC, CLOCK_MONOTONIC_RAW, host RTC - system clock in s or None if no RTC)."""
    try:
        with open(RTC_PATH) as f:
            rtc = int(f.read()) - time.time()
    except (OSError, ValueError):
        rtc = None
    return time.clock_gettime(time.CLOCK_MONOTONIC), time.clock_gettime(time.CLOCK_MONOTONIC_RAW), rtc

def clock_delta(c0, c1):
    """Between two clock_read(): (ms the system clock gained on the raw clock, s the system clock
    lost on the host RTC = time the VM was not running; None without an RTC)."""
    adj_ms = ((c1[0] - c0[0]) - (c1[1] - c0[1])) * 1000.0
    pause = (c1[2] - c0[2]) if (c0[2] is not None and c1[2] is not None) else None
    return adj_ms, pause

def clock_verdict(adj_ms, pause_s, ntp_step_s=None):
    """Why an interval is unusable, or None."""
    if abs(adj_ms) > CLOCK_ADJ_MAX_MS:
        return (f"the system clock was adjusted by {adj_ms:+.1f} ms against the raw clock (limit {CLOCK_ADJ_MAX_MS:g} ms): "
                f"it is being slewed, so every timer and rate in the lab is off")
    if pause_s is not None and abs(pause_s) > VM_PAUSE_MAX_S:
        return f"the VM did not run for about {pause_s:.0f} s (host RTC against the system clock): it was paused"
    if ntp_step_s is not None and abs(ntp_step_s) > NTP_STEP_MAX_S:
        return f"the system clock lost {ntp_step_s:+.2f} s against internet time (limit {NTP_STEP_MAX_S:g} s): the VM was paused"
    return None

def clock_readback():
    """The clock check before a run: a 2 s rate comparison and the offset from the host RTC. Dies
    if the clock is being slewed or is seconds away from the host's clock."""
    c0 = clock_read()
    time.sleep(2)
    c1 = clock_read()
    adj_ms, _ = clock_delta(c0, c1)
    ntp = ntp_offset()
    res = {"adj_ms_in_2s": round(adj_ms, 3), "rtc_minus_system_s": None if c1[2] is None else round(c1[2], 1),
           "ntp_minus_system_s": None if ntp is None else round(ntp, 3)}
    fix = "fix: `chronyc makestep` as root, then check `chronyc tracking`"
    why = clock_verdict(adj_ms, None)
    if why:
        q.die(f"clock check: {why} — {fix}")
    if ntp is not None and abs(ntp) > NTP_OFFSET_MAX_S:
        q.die(f"clock check: the system clock is {ntp:+.1f} s from internet time (limit {NTP_OFFSET_MAX_S:g} s) — "
              f"the VM was paused and has not been re-synchronised; {fix}")
    if c1[2] is not None and abs(c1[2]) > RTC_OFFSET_MAX_S:
        q.die(f"clock check: the system clock is {c1[2]:+.0f} s from the host RTC (limit {RTC_OFFSET_MAX_S:g} s) — "
              f"the VM was paused and has not been re-synchronised; {fix}")
    return res


# ----------------------------- host CPU -----------------------------
def cpu_read(path="/proc/stat"):
    """Cumulative (busy, total) jiffies per cpu line of the HOST's /proc/stat (the driver runs on
    the host, and every container shares its CPUs)."""
    out = {}
    with open(path) as f:
        for ln in f:
            if not ln.startswith("cpu"):
                break
            p = ln.split()
            v = [int(x) for x in p[1:9]]              # user nice system idle iowait irq softirq steal
            out[p[0]] = (sum(v) - v[3] - v[4], sum(v))
    return out

def cpu_util(c0, c1):
    """(busy % over all CPUs, busy % of the busiest single CPU) between two cpu_read() snapshots."""
    def pct(k):
        dt = c1[k][1] - c0[k][1]
        return 100.0 * (c1[k][0] - c0[k][0]) / dt if dt > 0 else 0.0
    cores = [pct(k) for k in c1 if k != "cpu" and k in c0]
    return pct("cpu"), (max(cores) if cores else 0.0)


# ----------------------------- one condition -----------------------------
def offered_load_pct(pps_total, bg_kbps, ceil_mbps):
    """Offered load as a percentage of the ceiling, counted at the tunnel layer (nominal rates)."""
    rsv = pps_total * RSV_TUNNEL_B * 8 / 1e6
    bg = bg_kbps / 1000.0 * BG_TUNNEL_B / int(P["BG_PAYLOAD_B"])
    return 100.0 * (rsv + bg) / ceil_mbps

def run_condition(cond, qos, bg_kbps, rep, writer, csvf, globals_, path):
    """The paper driver's run_condition(), same steps in the same order with the same helpers.
    Added (marked +): BFD before/after, packets on the other path, EF frame size, host CPU, and a
    check that the EF class still has the rate and ceiling of the read-back."""
    other_dev = PATHS[OTHER[path]]["ovsa_dev"]
    sel_tun, other_tun = PATHS[path]["tun"], PATHS[OTHER[path]]["tun"]
    flows_apply(qos == "on")
    if bg_kbps:
        q.bg_start(f"{bg_kbps}K")
    q.publishers_rearm()
    time.sleep(q.SETTLE_S)

    k0, n0 = clock_read(), ntp_offset()                                # + before the capture starts, well ahead of t0
    q.rgoose_capture_start()
    bfd0 = bfd_readback()                                              # +
    off0 = q.htb_class_stats(OVS_A, other_dev, "1:fffe")["pkts"]       # +
    w0 = time.time(); ef0, be0 = q.htb_snapshot()
    for (cont, dev, _, _), s in zip(q.HTB_HOPS, ef0):                  # + the shaper must be the one read back
        if abs(s["rate_mbps"] - globals_["ef_guarantee_mbps"]) > 0.01 or abs(s["ceil_mbps"] - globals_["ef_ceil_mbps"]) > 0.01:
            q.die(f"{cont} {dev}: EF class is {s['rate_mbps']}/{s['ceil_mbps']} Mb/s, read-back was "
                  f"{globals_['ef_guarantee_mbps']}/{globals_['ef_ceil_mbps']}")
    rb0 = q.sub_rcvbuf_errors()
    t0 = q.snapshot()
    q.require_fresh(t0, f"{cond} qos={qos} rep={rep} window start")
    bl_max = 0
    c_start = c_prev = cpu_read()                                      # +
    cpu_1s = []
    for i in range(q.DUR):
        time.sleep(1)
        c = cpu_read(); cpu_1s.append(cpu_util(c_prev, c)); c_prev = c
        if i % 3 == 2:
            bl_max = max(bl_max, sum(s["backlog_p"] for s in q.htb_snapshot()[0]))
    cpu_mean = cpu_util(c_start, c_prev)[0]
    all_recs = q.stats_lines()
    t1 = q.snapshot(all_recs)
    q.require_fresh(t1, f"{cond} qos={qos} rep={rep} window end")
    ef1, be1 = q.htb_snapshot(); w1 = time.time()
    rb1 = q.sub_rcvbuf_errors()
    off1 = q.htb_class_stats(OVS_A, other_dev, "1:fffe")["pkts"]       # +
    bfd1 = bfd_readback()                                              # +
    rgoose_n = q.rgoose_capture_stop()
    trip = q.t_trip_ms()
    bg_meas, bg_loss = (None, None)
    if bg_kbps:
        bg_meas, bg_loss = q.bg_stop()
    clock_adj_ms, vm_pause_s = clock_delta(k0, clock_read())           # +
    ntp_step_s = ntp_step(n0)
    why = clock_verdict(clock_adj_ms, vm_pause_s, ntp_step_s)
    if why:                                                            # no row is written for such a window
        q.die(f"{cond} path={path} qos={qos} rep={rep}: {why}. Window discarded, run stopped "
              f"(t_trip would have been {trip}) — re-synchronise the clock (`chronyc makestep` as root) and run again")

    active = {p["appid"] for p in q.ACTIVE}
    win = {a: m for a, m in q.measure_window(t0, t1, all_recs).items() if a in active}
    ef_drops = [b["drops"] - a["drops"] for a, b in zip(ef0, ef1)]
    pps_total = sum(p.get("pps", 4000) for p in q.ACTIVE)
    ef_pkts = ef1[0]["pkts"] - ef0[0]["pkts"]
    extra = {
        "n_streams": len(q.ACTIVE),
        "stream_rates_sas": "+".join(str(p.get("pps", 4000)) for p in q.ACTIVE),
        "aggregate_rsv_mbps_nominal": round(pps_total * RSV_TUNNEL_B * 8 / 1e6, 2),
        "aggregate_rsv_mbps_measured": round(sum(m["rate_sas"] for m in win.values()) * RSV_TUNNEL_B * 8 / 1e6, 2),
        "ef_class_drops": sum(ef_drops),
        "ef_class_overlimits": sum(b["overlimits"] - a["overlimits"] for a, b in zip(ef0, ef1)),
        "ef_class_backlog": bl_max,
        "ef_class_drops_hops": "+".join(str(d) for d in ef_drops),     # ovs-a + r1 + r2 of the selected path
        "ef_class_sent_mbps": round((ef1[0]["bytes"] - ef0[0]["bytes"]) * 8 / (w1 - w0) / 1e6, 2),
        "be_class_drops": sum(b["drops"] - a["drops"] for a, b in zip(be0, be1)),
        "bg_mbps_measured": bg_meas if bg_meas is not None else "NA",
        "bg_loss_pct": bg_loss if bg_loss is not None else "NA",
        "sub_rcvbuf_drops": (rb1 - rb0) if (rb0 >= 0 and rb1 >= 0) else "NA",
        "rgoose_frames_per_window": rgoose_n if rgoose_n >= 0 else "NA",
        # this lab's columns
        "path": path, "bg_iperf_kbps": bg_kbps,
        "offered_load_pct": round(offered_load_pct(pps_total, bg_kbps, globals_["link_bw_mbps"]), 1),
        "ef_frame_bytes": round((ef1[0]["bytes"] - ef0[0]["bytes"]) / ef_pkts, 1) if ef_pkts else "NA",
        # packets each hop put in its EF class: shows the outer DSCP was honoured at every hop
        "ef_class_pkts_hops": "+".join(str(b["pkts"] - a["pkts"]) for a, b in zip(ef0, ef1)),
        "other_path_pkts": off1 - off0,
        "bfd_sel_start": bfd0[sel_tun]["state"], "bfd_sel_end": bfd1[sel_tun]["state"],
        "bfd_sel_flaps": bfd1[sel_tun]["flaps"] - bfd0[sel_tun]["flaps"],
        "bfd_other_start": bfd0[other_tun]["state"], "bfd_other_end": bfd1[other_tun]["state"],
        "bfd_other_flaps": bfd1[other_tun]["flaps"] - bfd0[other_tun]["flaps"],
        "host_cpu_mean_pct": round(cpu_mean, 1),
        "host_cpu_max_pct": round(max(t for t, _ in cpu_1s), 1),
        "host_core_max_pct": round(max(c for _, c in cpu_1s), 1),
        "clock_adj_ms": round(clock_adj_ms, 3),
        "vm_pause_s": "NA" if vm_pause_s is None else round(vm_pause_s, 1),
        "ntp_step_s": "NA" if ntp_step_s is None else round(ntp_step_s, 3),
    }
    for appid, m in sorted(win.items()):
        row = {"cond": cond, "qos": qos, "bg_mbps": round(bg_kbps / 1000.0, 3), "appid": appid, "rep": rep,
               "t_trip_ms": trip if trip is not None else "NA", **m, **globals_, **extra}
        writer.writerow(row)
        csvf.flush()
        print(f"  [{cond} path={path} qos={qos} bg={bg_kbps}K rep={rep}] appid={appid} rate={m['rate_sas']} sa/s "
              f"lost={m['lost']} ({m['loss_pct']}%) reord={m['reordered']} jmax={m['jit_max_ms']}ms dark={m['dark_16ms']} "
              f"owd={m['owd_mean_ms']}/{m['owd_max_ms']}ms trip={trip}")
    print(f"  [{cond} path={path} qos={qos} bg={bg_kbps}K rep={rep}] offered {extra['offered_load_pct']}% of ceiling; "
          f"rsv={extra['aggregate_rsv_mbps_nominal']}/{extra['aggregate_rsv_mbps_measured']} Mb/s nominal/delivered (tunnel layer), "
          f"EF class sent={extra['ef_class_sent_mbps']} Mb/s in {extra['ef_frame_bytes']} B frames, "
          f"EF pkts per hop={extra['ef_class_pkts_hops']}, drops={extra['ef_class_drops_hops']} "
          f"overlimits={extra['ef_class_overlimits']} backlog_max={bl_max}p, BE drops={extra['be_class_drops']}, "
          f"bg={bg_meas} Mb/s, rcvbuf drops={extra['sub_rcvbuf_drops']}, R-GOOSE@vMU1={extra['rgoose_frames_per_window']}")
    print(f"  [{cond} path={path} qos={qos} bg={bg_kbps}K rep={rep}] BFD {sel_tun} {extra['bfd_sel_start']}->{extra['bfd_sel_end']} "
          f"(flaps {extra['bfd_sel_flaps']}), {other_tun} {extra['bfd_other_start']}->{extra['bfd_other_end']} (flaps {extra['bfd_other_flaps']}); "
          f"other path carried {extra['other_path_pkts']} pkt; host CPU mean {extra['host_cpu_mean_pct']}% "
          f"max {extra['host_cpu_max_pct']}% busiest core {extra['host_core_max_pct']}%; "
          f"clock adjusted {extra['clock_adj_ms']} ms, VM paused {extra['vm_pause_s']} s by the RTC, "
          f"{extra['ntp_step_s']} s by internet time")


# ----------------------------- summary -----------------------------
def summarize(rows):
    """Per (cond, qos): t_trip of every window (one per repetition, NA dropped), windows above the
    budget, EF drops summed over windows, BFD flaps on the selected tunnel. `rows` = CSV dict rows."""
    out = {}
    seen = set()
    for r in rows:
        key, win = (r["cond"], r["qos"]), (r["cond"], r["qos"], r["rep"])
        if win in seen:              # per-window values are repeated on every stream row
            continue
        seen.add(win)
        s = out.setdefault(key, {"trips": [], "na": 0, "ef_drops": 0, "bfd_sel_flaps": 0, "windows": 0})
        s["windows"] += 1
        if r["t_trip_ms"] in ("NA", ""):
            s["na"] += 1
        else:
            s["trips"].append(float(r["t_trip_ms"]))
        s["ef_drops"] += int(r["ef_class_drops"])
        s["bfd_sel_flaps"] += int(r["bfd_sel_flaps"])
    return out

def print_summary(csvpath, path):
    ref, tol, budget = float(P["T_TRIP_REF_MS"]), float(P["T_TRIP_TOL_MS"]), float(P["T_TRIP_BUDGET_MS"])
    with open(csvpath) as f:
        summ = summarize(list(csv.DictReader(f)))
    print(f"== path {path.upper()}: t_trip per condition (paper reference {ref} ms, budget {budget:g} ms) ==")
    for (cond, qos), s in summ.items():
        if not s["trips"]:
            print(f"  {cond:9s} qos={qos}: no t_trip in {s['windows']} windows")
            continue
        mean = sum(s["trips"]) / len(s["trips"])
        flag = "" if abs(mean - ref) <= tol else f"   <-- mean differs from {ref} ms by more than {tol:g} ms: STOP AND REPORT"
        print(f"  {cond:9s} qos={qos}: n={len(s['trips'])} mean={mean:.2f} min={min(s['trips']):.2f} max={max(s['trips']):.2f} ms, "
              f"above {budget:g} ms: {sum(t > budget for t in s['trips'])}, no trip: {s['na']}, EF drops: {s['ef_drops']}, "
              f"BFD flaps on the selected tunnel: {s['bfd_sel_flaps']}{flag}")


# ----------------------------- main -----------------------------
def delay_apply(path_b_ms):
    """Set path B's per-router delay for this run (None = the params.env default) by re-running
    mp-wan-qos.sh; the read-back that follows logs what is really installed."""
    env = None if path_b_ms is None else dict(os.environ, B_DELAY_MS=f"{path_b_ms:g}")
    r = subprocess.run(["bash", str(HERE / "mp-wan-qos.sh")], capture_output=True, text=True, timeout=120, env=env)
    if r.returncode != 0:
        q.die(f"mp-wan-qos.sh failed: {r.stdout.strip()[-300:]} {r.stderr.strip()[-300:]}")

def restore_lab(args):
    """Leave the lab in its default state on every exit path, like the paper driver: background
    stopped, QoS marking on, default path pinned, path B's delay back to params.env. Each step is
    attempted even if an earlier one fails; a failed step ends the run non-zero."""
    steps = [("stop background load", q.bg_stop), ("QoS marking on", lambda: flows_apply(True)),
             (f"pin default path {P['PATH_DEFAULT']}", lambda: pin_apply(P["PATH_DEFAULT"]))]
    if args.delay_b_ms is not None:
        steps.append(("path B delay back to params.env", lambda: delay_apply(None)))
    failed = []
    for name, step in steps:
        try:
            step()
        except (SystemExit, Exception) as e:
            failed.append(name)
            print(f"[cleanup] {name} FAILED: {e!r}")
    if failed:
        q.die("lab NOT restored (" + ", ".join(failed) + ") — run mp-lab-up.sh")

def cond_name(label):
    return "baseline" if LEVELS[label] == 0 else f"load{label}"

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--path", choices=["a", "b"], required=True, help="path that carries R-SV, background and R-GOOSE in this run")
    ap.add_argument("--loads", default="60,140", type=lambda v: v.split(","),
                    help=f"load levels by the paper's label, from params.env ({','.join(sorted(LEVELS, key=int))}); "
                         "60 = no background. Default 60,140 = the acceptance test")
    ap.add_argument("--arms", default="on", type=lambda v: v.split(","), help="QoS arms per level, in order (default on = EF)")
    ap.add_argument("--dur", type=int, default=q.DUR, help=f"measured seconds per condition (default {q.DUR})")
    ap.add_argument("--reps", type=int, default=q.REPS, help=f"repetitions per condition (default {q.REPS})")
    ap.add_argument("--no-warmup", action="store_true", help="skip the discarded warm-up pass (smoke tests only)")
    ap.add_argument("--delay-b-ms", type=float, default=None,
                    help="path B netem per router per direction for this run (default: params.env, equal to path A)")
    ap.add_argument("--readback-only", action="store_true", help="pin, print the full read-back with an idle-lab ping, and exit")
    args = ap.parse_args()
    if set(args.arms) - {"off", "on"}:
        ap.error(f"--arms must be a comma list of off/on, got {','.join(args.arms)}")
    if set(args.loads) - set(LEVELS):
        ap.error(f"--loads: unknown level(s) {sorted(set(args.loads) - set(LEVELS))}; params.env has {sorted(LEVELS, key=int)}")
    path = args.path
    bind_paper_driver(path)
    q.DUR, q.REPS = args.dur, args.reps
    levels = [(lab, LEVELS[lab]) for lab in args.loads]
    outcsv = HERE / f"mp_sweep_{STAMP}_path{path}.csv"
    print(f"== mp_sweep {STAMP}: path {path.upper()}, {len(q.ACTIVE)} R-SV streams, levels {args.loads}, arms {args.arms}, "
          f"{q.DUR}s/condition, {q.REPS} reps ==")

    signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))     # a plain `kill` must also run the finally below
    try:
        if args.delay_b_ms is not None:
            delay_apply(args.delay_b_ms)
        pin_apply(path)
        flows_apply(True)
        time.sleep(1)
        rb = full_readback(path)
        if args.readback_only:
            rb["ping_rtt_ms"], rb["ping_note"] = q.ping_baseline(), "idle lab, no streams running"
            print_readback(rb)
            return

        sel = rb["netem"][path]
        oth = rb["netem"][OTHER[path]]
        ef = rb["shapers"][0 if path == "a" else 3]["classes"]            # access hop of the selected path
        q.subscriber_start()
        q.bg_server_start()
        q.publishers_start()
        q.publishers_post_start(" (initial)")
        print("[setup] waiting for all streams at the subscriber ...")
        q.wait_streams_live()
        q.publishers_guard()
        # like the paper driver: pinged with the streams running (an idle lab reads higher)
        rb["ping_rtt_ms"], rb["ping_note"] = q.ping_baseline(), "streams running, as the paper driver measures it"
        print_readback(rb)
        (HERE / f"mp_sweep_{STAMP}_path{path}_readback.json").write_text(json.dumps(rb, indent=1))

        ef_g, ef_ceil, bw = ef["1:2"]["rate_kbit"] / 1000.0, ef["1:2"]["ceil_kbit"] / 1000.0, ef["1:fffe"]["rate_kbit"] / 1000.0
        if abs(q.ef_guarantee_readback() - ef_g) > 0.01 or abs(q.ef_ceil_readback() - ef_ceil) > 0.01:
            q.die("EF rate/ceiling differ between the hops of the selected path")
        globals_ = {"link_bw_mbps": round(bw, 1), "netem_ms": sum(sel["fwd"]), "netem_hops": hops(sel["fwd"]),
                    "ping_rtt_ms": rb["ping_rtt_ms"], "ef_guarantee_mbps": round(ef_g, 1),
                    "ef_mode": "policed" if abs(ef_ceil - ef_g) < 0.01 else "work-conserving", "ef_ceil_mbps": round(ef_ceil, 1),
                    "netem_rev_hops": hops(sel["rev"]), "other_path_netem_fwd_hops": hops(oth["fwd"]),
                    "other_path_netem_rev_hops": hops(oth["rev"])}

        with open(outcsv, "w", newline="") as csvf:
            writer = csv.DictWriter(csvf, fieldnames=COLS)
            writer.writeheader()
            if not args.no_warmup:
                print("---- warm-up (discarded: post-deploy settling) ----")
                null = csv.DictWriter(io.StringIO(), fieldnames=COLS)
                for lab, kbps in levels:
                    for arm in args.arms:
                        run_condition("warmup", arm, kbps, 0, null, io.StringIO(), globals_, path)
            for rep in range(1, q.REPS + 1):
                print(f"---- repetition {rep}/{q.REPS} ----")
                for lab, kbps in levels:
                    for arm in args.arms:
                        run_condition(cond_name(lab), arm, kbps, rep, writer, csvf, globals_, path)
        print(f"\n== done. results: {outcsv} ==")
        print_summary(outcsv, path)
    finally:
        restore_lab(args)

if __name__ == "__main__":
    main()
