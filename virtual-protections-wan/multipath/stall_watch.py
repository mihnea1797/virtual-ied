#!/usr/bin/env python3
"""
stall_watch.py — record moments when the VM's CPUs stop running user code.

One small process per CPU, pinned to it, sleeps 4 ms at a time and notes every wake-up that
comes more than 12 ms late (three periods). Cost: 250 wake-ups a second per CPU, well under 1 %
of a core, so it can run next to a measurement.

What a late wake-up means:
  - late on ONE CPU: that CPU was busy in the kernel, or the host took that one virtual CPU away;
  - late on ALL CPUs at the same instant: the whole VM was not running. A guest has no ordinary
    way to stop every CPU's user code at once for tens of milliseconds, so this points at the host.
The script cannot tell more than that; it has no view of the host.

Run from virtual-protections-wan/:
  .venv/bin/python -u multipath/stall_watch.py --seconds 1300 > multipath/stall_watch_<stamp>.csv
Output (CSV on stdout): wall_s, cpu, late_ms — one line per late wake-up; `summary()` groups them.
"""
import argparse
import os
import subprocess
import sys
import time

PERIOD_S = 0.004
LATE_S = 0.012


def watch(cpu, seconds):
    os.sched_setaffinity(0, {cpu})
    end = time.monotonic() + seconds
    last = time.monotonic()
    while last < end:
        time.sleep(PERIOD_S)
        now = time.monotonic()
        if now - last > LATE_S:
            # wall-clock time of the END of the gap, the CPU, and how long the process did not run
            sys.stdout.write(f"{time.time():.3f},{cpu},{(now - last) * 1000:.1f}\n")
            sys.stdout.flush()
        last = now


def summary(lines, together_s=0.05):
    """Group late wake-ups that end within `together_s` of each other into one event:
    [(wall_s of the first, set of CPUs, longest late_ms)], sorted by time."""
    recs = sorted((float(a), int(b), float(c)) for a, b, c in (ln.split(",") for ln in lines if ln and ln[0].isdigit()))
    events = []
    for t, cpu, late in recs:
        if events and t - events[-1][3] <= together_s:
            ev = events[-1]
            ev[1].add(cpu)
            ev[2] = max(ev[2], late)
            ev[3] = t
        else:
            events.append([t, {cpu}, late, t])
    return [(t0, cpus, late) for t0, cpus, late, _ in events]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seconds", type=float, default=300, help="how long to watch (default 300)")
    ap.add_argument("--cpu", type=int, default=None, help="internal: watch this one CPU")
    args = ap.parse_args()
    if args.cpu is not None:
        watch(args.cpu, args.seconds)
        return
    print("wall_s,cpu,late_ms", flush=True)
    procs = [subprocess.Popen([sys.executable, "-u", __file__, "--cpu", str(c), "--seconds", str(args.seconds)])
             for c in sorted(os.sched_getaffinity(0))]
    for p in procs:
        p.wait()


if __name__ == "__main__":
    main()
