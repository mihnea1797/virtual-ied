#!/usr/bin/env python3
"""
paper_control.py — same-day control on the PAPER lab for the two-path acceptance runs.

Runs the acceptance sequence of mp_sweep.py — EF only, no background and the 140 % level, one
discarded warm-up pass, then N repetitions — on the paper lab (vied-lab), with the paper driver's
own setup, its own run_condition() and its own columns. Nothing of the paper lab or of
qos_sweep.py is changed; this file only calls it.

Purpose: tell whether something seen in the two-path lab (first use: the short delay spikes of
2026-11-16) belongs to that lab or to the host on that day.

Added around the paper driver, because it has neither: the clock check of mp_sweep.py before the
run and around every condition, and a side file with the clock and the host CPU per condition.
The CPU figures cover the WHOLE condition (re-arm, settle, window, stop), not only the 30 s
window as in mp_sweep.py, so they read a little lower than that driver's.

Run from virtual-protections-wan/ with the PAPER lab up (./lab-up.sh):
  .venv/bin/python -u multipath/paper_control.py
Output: multipath/paper_control_<stamp>.csv (paper columns) and ..._side.csv.
"""
import argparse
import csv
import io
import pathlib
import signal
import sys
import threading
import time
import types

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
import qos_sweep as q          # noqa: E402  the paper driver, with its own (paper lab) layout
import mp_sweep as m           # noqa: E402  only for the clock and CPU helpers; never bind_paper_driver() here

STAMP = time.strftime("%Y%m%d_%H%M%S")


class CpuSampler(threading.Thread):
    """Host CPU once a second until stop(): (mean %, highest 1 s %, highest 1 s % of a single CPU)."""
    def __init__(self):
        super().__init__(daemon=True)
        self._stop_evt = threading.Event()
        self.first = self.last = m.cpu_read()
        self.samples = []

    def run(self):
        while not self._stop_evt.wait(1.0):
            c = m.cpu_read()
            self.samples.append(m.cpu_util(self.last, c))
            self.last = c

    def stop(self):
        self._stop_evt.set()
        self.join()
        if not self.samples:
            return 0.0, 0.0, 0.0
        return m.cpu_util(self.first, self.last)[0], max(t for t, _ in self.samples), max(c for _, c in self.samples)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--reps", type=int, default=q.REPS, help=f"repetitions per condition (default {q.REPS})")
    ap.add_argument("--dur", type=int, default=q.DUR, help=f"measured seconds per condition (default {q.DUR})")
    ap.add_argument("--bg", default=q.LOADS[-1], help=f"iperf3 -b of the loaded condition (default {q.LOADS[-1]}, the paper's 140 %% level)")
    ap.add_argument("--no-warmup", action="store_true", help="skip the discarded warm-up pass (smoke tests only)")
    args = ap.parse_args()
    q.DUR, q.REPS = args.dur, args.reps
    out, side = HERE / f"paper_control_{STAMP}.csv", HERE / f"paper_control_{STAMP}_side.csv"
    print(f"== paper_control {STAMP}: paper lab, {len(q.ACTIVE)} R-SV streams, EF, no background + {args.bg}, "
          f"{q.DUR}s/condition, {q.REPS} reps ==")

    ck = m.clock_readback()                      # dies while the clock is being slewed or seconds off
    print(f"[setup] clock: moved {ck['adj_ms_in_2s']:+.3f} ms against the raw clock in 2 s; host RTC - system clock = "
          f"{ck['rtc_minus_system_s']} s; internet time - system clock = {ck['ntp_minus_system_s']} s")
    # ---- from here to the campaign: the paper driver's own setup, as in its main() ----
    if "min-rate" not in q.dx(q.OVS, "ovs-vsctl list queue 2>/dev/null").stdout:
        q.die("OVS queues missing — run lab-up.sh / ovs-restore.sh first (is the PAPER lab deployed?)")
    bw = q.link_bw_mbps()
    nm, hops = q.netem_readback()
    ef_g = q.ef_guarantee_readback()
    print(f"[setup] link_bw={bw:.0f} Mb/s (HTB read-back), EF guarantee={ef_g:.0f} Mb/s (EF class rate, all hops), "
          f"netem={nm} ms one-way over {len(q.ROUTERS)} hops ({hops})")
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
    restore_args = types.SimpleNamespace(campaign="legacy", ef_mode="work-conserving")
    try:
        ef_ceil = q.ef_ceil_readback()
        ef_mode = "policed" if abs(ef_ceil - ef_g) < 0.01 else "work-conserving"
        q.subscriber_start()
        q.bg_server_start()
        q.publishers_start()
        q.publishers_post_start(" (initial)")
        print("[setup] waiting for all streams at the subscriber ...")
        q.wait_streams_live()
        q.publishers_guard()
        rtt = q.ping_baseline()
        print(f"[setup] ping RTT vmu1->vied: {rtt} ms; EF mode {ef_mode} (ceil {ef_ceil:g} Mb/s)")
        globals_ = {"link_bw_mbps": round(bw, 1), "netem_ms": nm, "netem_hops": hops,
                    "ping_rtt_ms": rtt, "ef_guarantee_mbps": round(ef_g, 1),
                    "ef_mode": ef_mode, "ef_ceil_mbps": round(ef_ceil, 1)}

        with open(out, "w", newline="") as csvf, open(side, "w", newline="") as sf:
            writer = csv.DictWriter(csvf, fieldnames=q.COLS)
            writer.writeheader()
            sw = csv.writer(sf)
            sw.writerow(["cond", "rep", "clock_adj_ms", "vm_pause_s", "ntp_step_s", "host_cpu_mean_pct", "host_cpu_max_pct", "host_core_max_pct"])

            def one(cond, bg, rep):
                k0, n0 = m.clock_read(), m.ntp_offset()
                cpu = CpuSampler()
                cpu.start()
                buf = io.StringIO()                                          # rows are held back until the clock verdict
                q.run_condition(cond, "on", bg, rep, csv.DictWriter(buf, fieldnames=q.COLS), buf, globals_)   # the paper driver's own condition
                mean, mx, core = cpu.stop()
                adj, pause = m.clock_delta(k0, m.clock_read())
                step = m.ntp_step(n0)
                why = m.clock_verdict(adj, pause, step)
                if why:
                    q.die(f"{cond} rep={rep}: {why}. Window discarded (its rows are not written), run stopped — re-synchronise the clock")
                print(f"  [{cond} rep={rep}] clock adjusted {adj:.3f} ms, VM paused {'NA' if pause is None else round(pause, 1)} s by the RTC, "
                      f"{'NA' if step is None else round(step, 3)} s by internet time; "
                      f"host CPU over the whole condition mean {mean:.1f}% max {mx:.1f}% busiest core {core:.1f}%")
                if rep:
                    csvf.write(buf.getvalue())
                    csvf.flush()
                    sw.writerow([cond, rep, round(adj, 3), "NA" if pause is None else round(pause, 1),
                                 "NA" if step is None else round(step, 3), round(mean, 1), round(mx, 1), round(core, 1)])
                    sf.flush()

            loaded = f"load{args.bg}"
            if not args.no_warmup:
                print("---- warm-up (discarded: post-deploy settling) ----")
                one("warmup", "none", 0)
                one("warmup", args.bg, 0)
            for rep in range(1, q.REPS + 1):
                print(f"---- repetition {rep}/{q.REPS} ----")
                one("baseline", "none", rep)
                one(loaded, args.bg, rep)
        print(f"\n== done. results: {out} (side file {side.name}) ==")
    finally:
        q.restore_lab(restore_args)


if __name__ == "__main__":
    main()
