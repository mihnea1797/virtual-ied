#!/usr/bin/env python3
"""
stats_table.py — per-condition descriptive statistics from a qos_sweep CSV.

Usage:  stats_table.py <results.csv> <outdir> [--label NAME]

For every (cond, qos) it computes, over all repetitions x streams:
  t_trip (one value per repetition — the CSV repeats it on each stream row),
  OWD   (per-stream-window mean one-way delay, owd_mean_ms; max of owd_max_ms),
  gaps  (per-stream-window count of inter-arrival gaps > 16 ms, dark_16ms),
each with mean, std (sample, ddof=1), median, p25/p75 (IQR), p5, p95, p99
(numpy linear interpolation) and CoV = std/mean.

Writes:
  <outdir>/stats_<label>.csv        long form, one row per condition x metric
  <outdir>/table_<label>.tex        LaTeX rows in the paper's Table I column order:
      Load | QoS | Rate | OWD mean/max | Gaps mean±std | t_trip mean±std | t_trip p95 / CoV
"""
import csv, sys, argparse
from collections import defaultdict
import numpy as np

# Condition -> offered load (% of the 30 Mb/s ceiling); same map as make_figs.py.
LOAD = {"baseline": 60, "load9M": 90, "load13M": 105, "load18M": 120, "load24M": 140}
QOS = {"on": "EF", "off": "BE"}
TRIP_FLOOR_MS = 18.0   # physical floor of the step -> R-GOOSE loop on this testbed (see per_condition)
MODE = {"work-conserving": "wc", "policed": "pol", "": ""}   # ef_mode suffix for EF rows

def describe(x):
    x = np.asarray(x, dtype=float)
    n = x.size
    if n == 0:
        return None
    mean = float(x.mean())
    std = float(x.std(ddof=1)) if n > 1 else 0.0
    p5, p25, p50, p75, p95, p99 = np.percentile(x, [5, 25, 50, 75, 95, 99])
    return {"n": n, "mean": mean, "std": std, "median": float(p50),
            "p25": float(p25), "p75": float(p75), "iqr": float(p75 - p25),
            "p5": float(p5), "p95": float(p95), "p99": float(p99),
            "cov": (std / mean) if mean != 0 else float("nan"),
            "min": float(x.min()), "max": float(x.max())}

def load(path):
    """Group rows by condition. Key = (cond, qos, ef_mode); ef_mode is "" for CSVs without the
    column and for best-effort rows (the EF class is unused with QoS off), so the two BE arms
    of a two-mode boundary campaign pool into one condition."""
    rows = list(csv.DictReader(open(path)))
    g = defaultdict(list)
    for r in rows:
        mode = r.get("ef_mode", "") if r["qos"] == "on" else ""
        g[(r["cond"], r["qos"], mode)].append(r)
    return g

def cond_key(k):
    cond, qos, mode = k
    return (LOAD.get(cond, 999), cond, 0 if qos == "off" else 1, mode)

def qos_label(qos, mode):
    return QOS.get(qos, qos) + (f"-{MODE.get(mode, mode)}" if qos == "on" and mode else "")

def per_condition(rs):
    """Return metric -> describe() for one condition, plus a few extras."""
    trips, invalid = {}, {}
    for r in rs:
        if r["t_trip_ms"] != "NA":
            # one t_trip per repetition; pooled best-effort arms of several runs are told apart by ef_mode
            trips[(r.get("ef_mode", ""), int(r["rep"]))] = float(r["t_trip_ms"])
    # A trip below the uncongested loop (5 ms + 5 ms propagation + one-cycle RMS build-up,
    # measured 18.2 ms on the empty network) cannot be vMU1's own step -> trip -> return loop:
    # it is another stream's trip arriving first. Flag and exclude from the t_trip statistics.
    for k, t in list(trips.items()):
        if t < TRIP_FLOOR_MS:
            invalid[k] = trips.pop(k)
    owd_mean = [float(r["owd_mean_ms"]) for r in rs if float(r["owd_mean_ms"]) >= 0]
    owd_max = [float(r["owd_max_ms"]) for r in rs]
    gaps = [int(r["dark_16ms"]) for r in rs]
    rate = [float(r["rate_sas"]) for r in rs]
    loss = [float(r["loss_pct"]) for r in rs]
    r0 = rs[0]
    agg = float(r0["aggregate_rsv_mbps_nominal"]) if r0.get("aggregate_rsv_mbps_nominal") else None
    efg = float(r0["ef_guarantee_mbps"]) if r0.get("ef_guarantee_mbps") else None
    out = {
        "_agg_nominal_mbps": agg,
        "_rsv_to_ef_ratio": (agg / efg) if (agg and efg) else None,
        "_invalid_trips": invalid,
        "_ef_class_drops": describe([int(r["ef_class_drops"]) for r in rs]) if r0.get("ef_class_drops") else None,
        "_ef_class_backlog": describe([int(r["ef_class_backlog"]) for r in rs]) if r0.get("ef_class_backlog") else None,
        "bg_mbps_measured": describe([float(r["bg_mbps_measured"]) for r in rs if r.get("bg_mbps_measured") not in (None, "", "NA")]) if r0.get("bg_mbps_measured") else None,
        "t_trip_ms": describe(list(trips.values())),
        "owd_mean_ms": describe(owd_mean),
        "owd_max_ms": describe(owd_max),
        "gaps_16ms": describe(gaps),
        "rate_sas": describe(rate),
        "loss_pct": describe(loss),
    }
    return out

def fmt(v, nd=1):
    return f"{v:.{nd}f}"

def write_csv(stats, path, extra_cols=None):
    cols = ["cond", "load_pct", "qos", "ef_mode", "aggregate_rsv_mbps_nominal", "rsv_to_ef_ratio",
            "metric", "n", "mean", "std", "median",
            "p25", "p75", "iqr", "p5", "p95", "p99", "cov", "min", "max"]
    if extra_cols:
        cols = extra_cols + cols
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for k in sorted(stats, key=cond_key):
            cond, qos, mode = k
            for metric, d in stats[k].items():
                if d is None or metric == "_invalid_trips" or (metric.startswith("_") and metric not in ("_ef_class_drops", "_ef_class_backlog")):
                    continue
                agg, ratio = stats[k]["_agg_nominal_mbps"], stats[k]["_rsv_to_ef_ratio"]
                row = {"cond": cond, "load_pct": LOAD.get(cond, ""), "qos": qos_label(qos, mode), "ef_mode": mode,
                       "aggregate_rsv_mbps_nominal": fmt(agg, 2) if agg else "",
                       "rsv_to_ef_ratio": fmt(ratio, 3) if ratio else "",
                       "metric": metric.lstrip("_"),
                       **{c: (fmt(d[c], 4) if isinstance(d[c], float) else d[c]) for c in cols if c in d}}
                if extra_cols:
                    for c in extra_cols:
                        row[c] = ""
                w.writerow(row)

def write_tex(stats, path, caption_note=""):
    """Paper Table I column order. Gaps of the 140% best-effort row (bimodal) also get
    median [IQR] in a footnote."""
    lines = []
    lines.append(r"\begin{tabular}{llrrrrr}")
    lines.append(r"\toprule")
    lines.append(r"Load & QoS & Rate & OWD & Gaps $>$16\,ms & \ttrip{} & \ttrip{} \\")
    lines.append(r" & & (sa/s) & mean\,/\,max (ms) & mean$\pm$std & mean$\pm$std (ms) & p95 (ms)\,/\,CoV \\")
    lines.append(r"\midrule")
    notes = []
    for k in sorted(stats, key=cond_key):
        cond, qos, mode = k
        s = stats[k]
        rate = s["rate_sas"]["mean"]
        owd = f"{fmt(s['owd_mean_ms']['mean'])}\\,/\\,{fmt(s['owd_max_ms']['max'], 0)}"
        g = s["gaps_16ms"]
        gaps = f"{fmt(g['mean'], 0)}$\\pm${fmt(g['std'], 0)}"
        if g["std"] > g["mean"] and g["mean"] > 0:
            mark = chr(ord("a") + len(notes))
            gaps += f"$^{{\\mathrm{{{mark}}}}}$"
            notes.append(f"$^{{\\mathrm{{{mark}}}}}$bimodal (std $>$ mean): median [IQR] = "
                         f"{fmt(g['median'], 0)} [{fmt(g['p25'], 0)}--{fmt(g['p75'], 0)}], "
                         f"p95 = {fmt(g['p95'], 0)}, max = {fmt(g['max'], 0)}.")
        t = s["t_trip_ms"]
        if t is None:                 # every repetition NA or below the floor: nothing to report, do not crash
            trip = trip2 = "--"
        else:
            trip = f"{fmt(t['mean'])}$\\pm${fmt(t['std'])}"
            if s["_invalid_trips"]:
                mark = chr(ord("a") + len(notes))
                trip += f"$^{{\\mathrm{{{mark}}}}}$"
                notes.append(f"$^{{\\mathrm{{{mark}}}}}$n = {t['n']}: {len(s['_invalid_trips'])} run(s) excluded whose "
                             f"\\ttrip{{}} ({', '.join(fmt(v) for v in s['_invalid_trips'].values())} ms) is below the "
                             f"{TRIP_FLOOR_MS:g} ms loop floor, i.e. another stream's trip arrived first.")
            trip2 = f"{fmt(t['p95'])}\\,/\\,{fmt(t['cov'], 2)}"
        if cond in LOAD:
            load = f"{LOAD[cond]}\\%"
        elif s["_rsv_to_ef_ratio"]:
            load = f"{fmt(s['_agg_nominal_mbps'])}\\,Mb/s ({fmt(s['_rsv_to_ef_ratio'], 2)})"
        else:
            load = cond
        lines.append(f"{load} & {qos_label(qos, mode)} & {fmt(rate, 0)} & {owd} & {gaps} & {trip} & {trip2} \\\\")
    lines.append(r"\bottomrule")
    lines.append(r"\end{tabular}")
    for n in notes:
        lines.append(r"\par\smallskip\footnotesize " + n)
    if caption_note:
        lines.insert(0, "% " + caption_note)
    open(path, "w").write("\n".join(lines) + "\n")

def print_summary(stats):
    hdr = f"{'cond':10s} {'qos':6s} {'metric':16s} {'n':>3s} {'mean':>9s} {'std':>9s} {'median':>9s} {'p25':>8s} {'p75':>8s} {'p5':>8s} {'p95':>8s} {'p99':>8s} {'CoV':>6s}"
    print(hdr)
    for k in sorted(stats, key=cond_key):
        cond, qos, mode = k
        for metric in ("t_trip_ms", "owd_mean_ms", "gaps_16ms", "_ef_class_drops", "_ef_class_backlog", "bg_mbps_measured"):
            d = stats[k].get(metric)
            if d is None:
                continue
            print(f"{cond:10s} {qos_label(qos, mode):6s} {metric.lstrip('_'):16s} {d['n']:3d} {d['mean']:9.2f} {d['std']:9.2f} "
                  f"{d['median']:9.2f} {d['p25']:8.2f} {d['p75']:8.2f} {d['p5']:8.2f} {d['p95']:8.2f} {d['p99']:8.2f} {d['cov']:6.3f}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("outdir")
    ap.add_argument("--label", default="table1")
    a = ap.parse_args()
    g = load(a.csv)
    stats = {k: per_condition(rs) for k, rs in g.items() if k[0] != "warmup"}
    write_csv(stats, f"{a.outdir}/stats_{a.label}.csv")
    write_tex(stats, f"{a.outdir}/table_{a.label}.tex",
              caption_note=f"generated by analysis/stats_table.py from {a.csv}")
    print_summary(stats)
    print(f"\nwrote {a.outdir}/stats_{a.label}.csv and {a.outdir}/table_{a.label}.tex")

if __name__ == "__main__":
    main()
