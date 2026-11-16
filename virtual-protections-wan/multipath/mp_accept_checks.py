#!/usr/bin/env python3
"""
mp_accept_checks.py — acceptance tests 3 and 4 of phase 1. Observe only: nothing is tuned and
nothing fails over.

  capture   Test 3, marking survives the tunnel. Captures on the core link of the pinned path
            (at r2x eth1, packets arriving from r1x) while R-SV is running, and counts the R-SV
            packets inside VXLAN by the DSCP of their OUTER header. Keeps the first packets as a
            pcap and prints three of them decoded.

  bfd-cut   Test 4, BFD sees its own path. Cuts the r1a-r2a link, then the r1b-r2b link, and logs
            the BFD state of both tunnels at both switches a few times a second: the cut path's
            tunnel must go down at both ends, the other tunnel must stay up in every sample.
            The cut is an ingress drop filter on both ends of the link (both directions), not
            `ip link set down`: that would delete the static routes and need a re-run of the
            bring-up. The shapers and netem are read back afterwards to show they were not touched.

Run from virtual-protections-wan/ with the lab up and, for `capture`, the streams running (the
publishers keep running after mp_sweep.py exits):
  .venv/bin/python -u multipath/mp_accept_checks.py capture
  .venv/bin/python -u multipath/mp_accept_checks.py bfd-cut
Output: multipath/accept_<test>_<stamp>.* (promote kept ones to multipath/test-results/).
"""
import argparse
import csv
import pathlib
import subprocess
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import mp_sweep as m          # noqa: E402

q, P, PFX = m.q, m.P, m.PFX
STAMP = time.strftime("%Y%m%d_%H%M%S")


# ----------------------------- test 3: capture -----------------------------
# BPF offsets from the start of the OUTER IPv4 header (20 B, no options): UDP 8 + VXLAN 8 + inner
# Ethernet 14 put the inner IPv4 header at ip[50]: inner ethertype ip[48:2], inner TOS ip[51],
# inner protocol ip[59], inner UDP destination port ip[72:2].
def bpf(path):
    fwd = f"udp dst port {P['VXLAN_PORT']} and dst host {m.PATHS[path]['ovsb_ip']}"     # toward the vIED only
    ports = sorted(int(x) for x in P["SV_PORTS"].split())
    rsv = f"{fwd} and ip[48:2] = 0x0800 and ip[59] = 17 and ip[72:2] >= {ports[0]} and ip[72:2] <= {ports[-1]}"
    return fwd, rsv

def capture(args):
    m.bind_paper_driver("a")
    path, _ = m.pin_readback()
    m.bind_paper_driver(path)
    r1, r2 = m.PATHS[path]["routers"]
    fwd, rsv = bpf(path)
    pcap = "/tmp/core_link.pcap"
    print(f"== test 3: capture on the core link {r1[len(PFX) + 1:]} -> {r2[len(PFX) + 1:]} (path {path.upper()}), "
          f"at {r2[len(PFX) + 1:]} eth1, {args.seconds} s ==")
    q.dx(r2, f"rm -f {pcap}; timeout {args.seconds} tcpdump -i eth1 -nn -w {pcap} '{fwd}' 2>/dev/null; true", timeout=args.seconds + 30)

    def count(flt):
        # one packet = one outer line ("... > ....4789: VXLAN, flags ..."); tcpdump prints the decoded
        # inner packet on a second line, so `wc -l` would count every packet twice
        try:
            return int(q.dx(r2, f"tcpdump -r {pcap} -nn '{flt}' 2>/dev/null | grep -c ': VXLAN, '").stdout.strip())
        except ValueError:
            q.die(f"{r2}: could not count '{flt}' in the capture")
    n = {"vxlan_toward_vied": count(fwd), "rsv": count(rsv),
         "rsv_outer_dscp46": count(f"{rsv} and ip[1] & 0xfc = 0xb8"),
         "rsv_inner_dscp46": count(f"{rsv} and ip[51] & 0xfc = 0xb8"),
         "rsv_frame_248": count(f"{rsv} and len = {m.RSV_TUNNEL_B}"),
         "other_outer_dscp46": count(f"{fwd} and not ({rsv}) and ip[1] & 0xfc = 0xb8")}
    n["other"] = n["vxlan_toward_vied"] - n["rsv"]
    if n["rsv"] == 0:
        q.die("no R-SV on the core link — start the streams first (run mp_sweep.py once; the publishers keep running)")

    out = HERE / f"accept_capture_{STAMP}_path{path}"
    q.dx(r2, f"tcpdump -r {pcap} -nn -c {args.keep} -w {pcap}.keep '{rsv}' 2>/dev/null")
    subprocess.run(["docker", "cp", f"{r2}:{pcap}.keep", f"{out}.pcap"], check=True, capture_output=True)
    decoded = q.dx(r2, f"tcpdump -r {pcap} -nn -e -v -c 3 '{rsv}' 2>/dev/null").stdout
    report = [f"capture: {r2} eth1, {args.seconds} s, filter: {fwd}", f"R-SV filter: {rsv}", ""]
    report += [f"{k}: {v}" for k, v in n.items()]
    report += ["", "first three R-SV packets (tcpdump -e -v):", decoded]
    pathlib.Path(f"{out}.txt").write_text("\n".join(report))

    print(f"  VXLAN packets toward the vIED: {n['vxlan_toward_vied']}")
    print(f"  R-SV inside VXLAN (inner UDP {P['SV_PORTS'].split()[0]}-{P['SV_PORTS'].split()[-1]}): {n['rsv']}")
    print(f"    outer header DSCP 46: {n['rsv_outer_dscp46']}   inner header DSCP 46: {n['rsv_inner_dscp46']}   "
          f"frame length {m.RSV_TUNNEL_B} B: {n['rsv_frame_248']}")
    print(f"  other packets in the tunnel: {n['other']} (with outer DSCP 46: {n['other_outer_dscp46']})")
    print("  first three R-SV packets:")
    for ln in decoded.splitlines():
        print("    " + ln)
    ok = n["rsv_outer_dscp46"] == n["rsv"] and n["other_outer_dscp46"] == 0
    print(f"  RESULT: {'PASS' if ok else 'FAIL'} — {n['rsv_outer_dscp46']} of {n['rsv']} R-SV packets carry DSCP 46 on the outer header")
    print(f"  kept: {out}.pcap ({args.keep} packets), {out}.txt")
    return 0 if ok else 1


# ----------------------------- test 4: BFD under a cut -----------------------------
def cut_devs(path):
    r1, r2 = m.PATHS[path]["routers"]
    return [(r1, "eth2"), (r2, "eth1")]          # the two ends of the r1x-r2x link

def cut(path, on):
    """Drop everything ARRIVING on both ends of the r1x-r2x link (= both directions), or remove
    the drop. Uses the clsact ingress hook, which is separate from the egress qdiscs (HTB/netem)."""
    for cont, dev in cut_devs(path):
        if on:
            r = q.dx(cont, f"tc qdisc add dev {dev} clsact && tc filter add dev {dev} ingress pref 1 matchall action drop")
            if r.returncode != 0 or "matchall" not in q.dx(cont, f"tc filter show dev {dev} ingress").stdout:
                q.die(f"{cont} {dev}: could not install the cut: {r.stderr.strip()[:200]}")
        else:
            q.dx(cont, f"tc qdisc del dev {dev} clsact 2>/dev/null; true")
            if "matchall" in q.dx(cont, f"tc filter show dev {dev} ingress 2>/dev/null").stdout:
                q.die(f"{cont} {dev}: the cut is still in place — remove it with: tc qdisc del dev {dev} clsact")

def bfd_states():
    """{(tunnel, switch): BFD session state} read from both switches (one docker exec each)."""
    tuns = [m.PATHS[x]["tun"] for x in ("a", "b")]
    out = {}
    for sw in (m.OVS_A, m.OVS_B):
        lines = q.dx(sw, "; ".join(f"ovs-vsctl get interface {t} bfd_status:state" for t in tuns)).stdout.split()
        for t, st in zip(tuns, lines + ["?"] * len(tuns)):
            out[(t, sw)] = st
    return out

def bfd_cut(args):
    m.bind_paper_driver("a")
    tuns = {x: m.PATHS[x]["tun"] for x in ("a", "b")}
    keys = [(t, sw) for t in tuns.values() for sw in (m.OVS_A, m.OVS_B)]
    cols = ["t_s", "phase", "cut"] + [f"{t}@{sw[len(PFX) + 1:]}" for t, sw in keys]
    out = HERE / f"accept_bfd_cut_{STAMP}.csv"
    t_start = time.time()
    results = {}
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)

        def sample(phase, which):
            st = bfd_states()
            w.writerow([f"{time.time() - t_start:.2f}", phase, which] + [st[k] for k in keys])
            f.flush()
            return st

        try:
            for x in ("a", "b"):
                own, other = tuns[x], tuns[m.OTHER[x]]
                r1, r2 = (c[len(PFX) + 1:] for c in m.PATHS[x]["routers"])
                print(f"== test 4: cut {r1}-{r2} (path {x.upper()}) for {args.hold} s ==")
                t_end = time.time() + args.before
                while time.time() < t_end:
                    st = sample("before", "none")
                    if any(v != "up" for v in st.values()):
                        q.die(f"BFD is not up on every tunnel before the cut: {st}")
                    time.sleep(args.period)
                cut(x, True)
                t_cut = time.time()
                down_at, other_ok, n_cut = {}, True, 0
                while time.time() - t_cut < args.hold:
                    st = sample("cut", x)
                    n_cut += 1
                    now = time.time() - t_cut
                    for sw in (m.OVS_A, m.OVS_B):
                        if st[(own, sw)] != "up" and sw not in down_at:
                            down_at[sw] = now
                        if st[(other, sw)] != "up":
                            other_ok = False
                    time.sleep(args.period)
                st_hold = sample("cut-end", x)
                cut(x, False)
                t_rest = time.time()
                up_at = None
                while time.time() - t_rest < args.recover:
                    st = sample("restored", "none")
                    if all(v == "up" for v in st.values()):
                        up_at = time.time() - t_rest
                        break
                    time.sleep(args.period)
                own_down = all(st_hold[(own, sw)] != "up" for sw in (m.OVS_A, m.OVS_B))
                results[x] = {"own_down": own_down, "other_ok": other_ok, "up_at": up_at}
                print(f"  tunnel {own} (own path): " + ", ".join(
                    f"{sw[len(PFX) + 1:]} left 'up' {down_at[sw]:.1f} s after the cut" if sw in down_at else f"{sw[len(PFX) + 1:]} STAYED UP"
                    for sw in (m.OVS_A, m.OVS_B)) + f"; state at the end of the cut: "
                    + "/".join(st_hold[(own, sw)] for sw in (m.OVS_A, m.OVS_B)))
                print(f"  tunnel {other} (other path): {'up in all ' + str(n_cut + 1) + ' samples during the cut' if other_ok else 'NOT up in every sample'}")
                print(f"  after removing the cut: " + (f"all four sessions up again after {up_at:.1f} s" if up_at is not None
                                                        else f"NOT all up within {args.recover} s"))
        finally:
            for x in ("a", "b"):          # never leave a path cut behind
                try:
                    cut(x, False)
                except SystemExit:
                    pass
    # the cut must not have touched shapers, delays, tunnels or the pin
    m.shaper_readback(); m.netem_readback(); m.tunnel_readback(); m.pin_readback()
    flaps = {t: b["flaps"] for t, b in m.bfd_readback().items()}
    ok = all(r["own_down"] and r["other_ok"] and r["up_at"] is not None for r in results.values()) and len(results) == 2
    print(f"  shapers, netem, tunnels and pin read back unchanged; BFD flap counters now {flaps}")
    print(f"  RESULT: {'PASS' if ok else 'FAIL'}")
    print(f"  timeline: {out}")
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="test", required=True)
    c = sub.add_parser("capture", help="test 3: R-SV inside VXLAN with DSCP 46 on the outer header")
    c.add_argument("--seconds", type=int, default=5, help="capture duration (default 5)")
    c.add_argument("--keep", type=int, default=200, help="R-SV packets kept in the pcap (default 200)")
    b = sub.add_parser("bfd-cut", help="test 4: BFD of both tunnels while one path's core link is cut")
    b.add_argument("--before", type=float, default=5, help="seconds observed before each cut (default 5)")
    b.add_argument("--hold", type=float, default=12, help="seconds each cut is held (default 12)")
    b.add_argument("--recover", type=float, default=30, help="seconds waited for BFD to come back (default 30)")
    b.add_argument("--period", type=float, default=0.2, help="pause between samples (default 0.2 s)")
    args = ap.parse_args()
    sys.exit(capture(args) if args.test == "capture" else bfd_cut(args))

if __name__ == "__main__":
    main()
