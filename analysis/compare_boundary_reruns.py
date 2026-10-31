#!/usr/bin/env python3
"""
compare_boundary_reruns.py — results table of a boundary-sweep campaign, per-point comparison
against a reference campaign, and the three go/no-go checks of the 2026-09-30 re-run.

Usage:  compare_boundary_reruns.py <new_both.csv> <ref_both.csv> [--trip-floor 18] [--reps 10]

Prints Markdown (tables + check lines) to stdout; paste into boundary-results-rerun.md.
Conditions are keyed like stats_table.py: (cond, qos, ef_mode) with ef_mode = "" for best-effort
rows, so the two best-effort arms of a two-mode campaign pool (n = 20).
"""
import csv, sys, argparse
from collections import defaultdict
import numpy as np

REQUIRED = ["n_streams", "stream_rates_sas", "aggregate_rsv_mbps_nominal", "aggregate_rsv_mbps_measured",
            "ef_guarantee_mbps", "ef_ceil_mbps", "ef_mode", "ef_class_drops", "ef_class_overlimits",
            "ef_class_backlog", "ef_class_drops_hops", "ef_class_sent_mbps", "be_class_drops",
            "bg_mbps_measured", "sub_rcvbuf_drops", "rgoose_frames_per_window"]
ARM = {("on", "work-conserving"): "EF work-conserving", ("on", "policed"): "EF policed (rate-capped)",
       ("off", ""): "best-effort"}
# Per 30 s window. The 2026-09-15 storm (last-stream debounce) toggled the trip on EVERY received
# ASDU: 80k-260k frames. With the OR-fix a frame is a genuine transition of the aggregated trip;
# a lossless window has 1 (the step), a lossy one (1.58, above the link ceiling) has tens to ~100
# because sample loss makes the RMS of the stepped streams flicker around the threshold. The
# storm threshold is therefore set two orders of magnitude above the flicker, one below the storm.
STORM_MAX_FRAMES = 1000

def load(path):
    rows = [r for r in csv.DictReader(open(path)) if r["cond"] != "warmup"]
    g = defaultdict(list)
    for r in rows:
        mode = r.get("ef_mode", "") if r["qos"] == "on" else ""
        g[(r["cond"], r["qos"], mode)].append(r)
    return rows, g

def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

TRIP_FLOOR_MS = 18.0   # stats_table.py excludes t_trip below the loop floor (another stream's trip arrived first)

def per_rep(rs, col, floor=None):
    """One value per repetition (the driver repeats condition-level values on every stream row).
    With floor set (t_trip only), values below it are excluded exactly as stats_table.py / the
    2026-09-15 table did, so the reference numbers here equal the published ones."""
    d = {}
    for r in rs:
        v = num(r.get(col))
        if v is not None and (floor is None or v >= floor):
            d[(r.get("ef_mode", ""), int(r["rep"]))] = v
    return np.array(list(d.values()), dtype=float)

def ms(x, nd=1):
    x = np.asarray(x, dtype=float)
    if x.size == 0:
        return "–"
    s = x.std(ddof=1) if x.size > 1 else 0.0
    return f"{x.mean():.{nd}f} ± {s:.{nd}f}"

def rg_cell(x):
    return f"{x.mean():.1f} (max {x.max():.0f})" if x.size else "NA (column absent)"

def summarize(rs):
    trips = per_rep(rs, "t_trip_ms", floor=TRIP_FLOOR_MS)
    owd_mean = np.array([float(r["owd_mean_ms"]) for r in rs if float(r["owd_mean_ms"]) >= 0])
    owd_max = max(float(r["owd_max_ms"]) for r in rs)
    gaps = np.array([int(r["dark_16ms"]) for r in rs], dtype=float)
    bl = per_rep(rs, "ef_class_backlog")
    dr = per_rep(rs, "ef_class_drops")
    deliv = per_rep(rs, "aggregate_rsv_mbps_measured")
    bg = per_rep(rs, "bg_mbps_measured")
    rg = per_rep(rs, "rgoose_frames_per_window")
    rb = per_rep(rs, "sub_rcvbuf_drops")
    loss = np.array([float(r["loss_pct"]) for r in rs])
    r0 = rs[0]
    return {"ratio": float(r0["aggregate_rsv_mbps_nominal"]) / float(r0["ef_guarantee_mbps"]),
            "nominal": float(r0["aggregate_rsv_mbps_nominal"]),
            "trips": trips, "owd_mean": owd_mean, "owd_max": owd_max, "gaps": gaps, "backlog": bl,
            "drops": dr, "deliv": deliv, "bg": bg, "rgoose": rg, "rcvbuf": rb, "loss": loss, "n_rows": len(rs)}

def order(k, g):
    cond, qos, mode = k
    return (float(g[k][0]["aggregate_rsv_mbps_nominal"]), 0 if qos == "off" else 1, mode)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("new"); ap.add_argument("ref")
    ap.add_argument("--trip-floor", type=float, default=18.0)
    ap.add_argument("--reps", type=int, default=10)
    a = ap.parse_args()
    nrows, ng = load(a.new)
    rrows, rg_ = load(a.ref)
    N = {k: summarize(v) for k, v in ng.items()}
    R = {k: summarize(v) for k, v in rg_.items()}
    keys = sorted(N, key=lambda k: order(k, ng))

    print("## Results (mean ± std over repetitions; OWD and gaps over repetitions × streams)\n")
    print("| ratio | arm | t_trip (ms) | OWD mean / max (ms) | gaps >16 ms / window | peak EF backlog (pkt) | EF drops / window | delivered R-SV (Mb/s) | background got (Mb/s) | loss % | R-GOOSE / window | rcvbuf drops |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|")
    for k in keys:
        s = N[k]; arm = ARM.get((k[1], k[2]), f"{k[1]}/{k[2]}")
        ef = k[1] == "on"
        print(f"| {s['ratio']:.2f} | {arm} | {ms(s['trips'])} (n = {s['trips'].size}) | {s['owd_mean'].mean():.1f} / {s['owd_max']:.0f} | "
              f"{ms(s['gaps'], 0)} | {ms(s['backlog'], 0) if ef else '–'} | {ms(s['drops'], 0) if ef else '–'} | "
              f"{s['deliv'].mean():.1f} | {s['bg'].mean():.1f} | {s['loss'].mean():.2f} | "
              f"{rg_cell(s['rgoose'])} | {int(s['rcvbuf'].sum()) if s['rcvbuf'].size else 'NA'} |")

    print("\n## Per-point comparison against the reference campaign (new − reference)\n")
    print(f"t_trip statistics exclude values below the {TRIP_FLOOR_MS:g} ms loop floor on both sides, as the reference "
          "table did (n is therefore 9/19 for three reference conditions; no exclusion was needed in the new data).\n")
    print("| ratio | arm | t_trip mean: new / ref / Δ (ms) | t_trip std: new / ref / Δ (ms) | EF backlog mean: new / ref / Δ (pkt) | EF drops mean: new / ref / Δ |")
    print("|---|---|---|---|---|---|")
    for k in keys:
        s, r = N[k], R.get(k)
        arm = ARM.get((k[1], k[2]), f"{k[1]}/{k[2]}")
        if r is None:
            print(f"| {s['ratio']:.2f} | {arm} | (no reference) | | | |"); continue
        def trio(x, y, nd=1):
            if x.size == 0 or y.size == 0:
                return "–"
            return f"{x.mean():.{nd}f} / {y.mean():.{nd}f} / {x.mean() - y.mean():+.{nd}f}"
        def strio(x, y, nd=1):
            if x.size < 2 or y.size < 2:
                return "–"
            sx, sy = x.std(ddof=1), y.std(ddof=1)
            return f"{sx:.{nd}f} / {sy:.{nd}f} / {sx - sy:+.{nd}f}"
        ef = k[1] == "on"
        print(f"| {s['ratio']:.2f} | {arm} | {trio(s['trips'], r['trips'])} | {strio(s['trips'], r['trips'])} | "
              f"{trio(s['backlog'], r['backlog'], 0) if ef else '–'} | {trio(s['drops'], r['drops'], 0) if ef else '–'} |")

    # ---- the three yes/no checks + column population + completeness ----
    print("\n## Checks\n")
    rg_all = np.array([v for v in (num(r.get("rgoose_frames_per_window")) for r in nrows) if v is not None], dtype=float)
    rg_ok = rg_all.size == len(nrows) and rg_all.size > 0 and rg_all.max() <= STORM_MAX_FRAMES
    low = [(r["cond"], r["qos"], r.get("ef_mode", ""), int(r["rep"]), float(r["t_trip_ms"]))
           for r in nrows if r["t_trip_ms"] != "NA" and float(r["t_trip_ms"]) < a.trip_floor]
    low = sorted(set(low))
    storm_absent = bool(rg_ok and not low)
    worst = max(((num(r.get("rgoose_frames_per_window")) or 0, r["cond"], r["qos"], r.get("ef_mode", ""), int(r["rep"]))
                 for r in nrows), default=None)
    per_point = ", ".join(f"{N[k]['ratio']:.2f} {ARM.get((k[1], k[2]), k[1])}: {N[k]['rgoose'].mean():.0f} (max {N[k]['rgoose'].max():.0f})"
                          for k in keys if N[k]["rgoose"].size)
    print(f"- **R-GOOSE storm absent: {'yes' if storm_absent else 'NO'}.** rgoose_frames_per_window over all "
          f"{len(nrows)} rows ({rg_all.size} populated): max {rg_all.max() if rg_all.size else 'NA'}"
          + (f" at {worst[1]} qos={worst[2]} {worst[3]} rep {worst[4]}" if worst else "")
          + f", mean {rg_all.mean() if rg_all.size else float('nan'):.2f}; storm threshold {STORM_MAX_FRAMES}"
          f" (2026-09-15: 80 000–260 000 per window at every point ≥ 1.11). t_trip below the {a.trip_floor:g} ms loop floor: "
          f"{len(low)}" + (f" → {low}" if low else " (none excluded)") + ".")
    print(f"  Per point, mean (max) frames per window: {per_point}.")
    # completeness = no restart failure (the driver dies on a failed restart and the campaign would be short)
    expect = {}
    missing = []
    for k, rs in ng.items():
        for mode in sorted({r.get("ef_mode", "") for r in rs}):
            reps = sorted({int(r["rep"]) for r in rs if r.get("ef_mode", "") == mode})
            want = list(range(1, a.reps + 1))
            if reps != want:
                missing.append((k, mode, reps))
            nstreams = {int(r["n_streams"]) for r in rs}
            per_rep_rows = defaultdict(int)
            for r in rs:
                if r.get("ef_mode", "") == mode:
                    per_rep_rows[int(r["rep"])] += 1
            bad = {rep: n for rep, n in per_rep_rows.items() if n not in nstreams}
            if bad:
                missing.append((k, mode, f"stream rows per rep off: {bad}"))
    complete = not missing
    print(f"- **No publisher restart failures: {'yes' if complete else 'NO'}.** Every condition × EF mode has repetitions "
          f"1..{a.reps} with one row per active stream" + (" ." if complete else f"; gaps: {missing}."))
    rb_all = [num(r.get("sub_rcvbuf_drops")) for r in nrows]
    rb_na = sum(1 for v in rb_all if v is None)
    rb_sum = sum(v for v in rb_all if v is not None)
    rb_ok = rb_na == 0 and rb_sum == 0
    print(f"- **sub_rcvbuf_drops = 0 at all points: {'yes' if rb_ok else 'NO'}.** Sum over all rows = {rb_sum:.0f}, "
          f"NA cells = {rb_na}" + (" (2026-09-15: ~107 k in work-conserving reps 1–2)." if rb_ok else "."))
    empty = defaultdict(int)
    for r in nrows:
        for c in REQUIRED:
            if r.get(c) in (None, ""):
                empty[c] += 1
    print(f"- Required columns populated in every row ({len(nrows)} rows): {'yes' if not empty else 'NO: ' + str(dict(empty))}.")

if __name__ == "__main__":
    main()
