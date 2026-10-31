#!/usr/bin/env python3
"""Boundary-sweep figures (Task B), both against the aggregate-R-SV / EF-rate ratio.

Usage:  make_figs_boundary.py <outdir> <boundary_results.csv> [<more.csv> ...]
  (pass the work-conserving and the policed campaign CSVs together; rows carry ef_mode)
  -> <outdir>/fig6a-trip-vs-ratio.{pdf,jpg}     t_trip mean +- std: EF work-conserving,
                                                EF policed, best-effort (both runs pooled)
  -> <outdir>/fig6b-efqueue-vs-ratio.{pdf,jpg}  two panels: max EF-class backlog (packets,
                                                all hops) and EF-class drops per 30 s window,
                                                both EF modes (the EF class is idle with QoS off)

Style constants copied from energycon/make_figs.py (EF blue / best-effort orange, IEEE column
width, DejaVu Sans 7.5 pt, recessive grid). Policed EF uses the same hue family, a darker step
with square markers and a dashed line, so identity is carried by marker + line style too."""

import csv, sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

EF, BE = "#2a78d6", "#eb6834"
EF2 = "#173f75"   # policed EF: darker step of the EF hue
INK, INK2, GRID = "#0b0b0b", "#52514e", "#d9d7d2"
COL_W = 3.45

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 7.5,
    "axes.edgecolor": GRID, "axes.linewidth": 0.7,
    "axes.labelcolor": INK, "xtick.color": INK2, "ytick.color": INK2,
    "grid.color": GRID, "grid.linewidth": 0.5,
    "legend.frameon": False, "pdf.fonttype": 42,
})

SERIES = {  # key -> (label, colour, fmt, marker face)
    ("on", "work-conserving"): ("EF, work-conserving", EF, "-o", EF),
    ("on", "policed"):         ("EF, policed (ceil = rate)", EF2, "--s", "white"),
    ("off", ""):               ("best-effort", BE, "-o", BE),
}

def style(ax):
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", zorder=0)
    ax.set_axisbelow(True)

def save(f, out, name):
    f.savefig(f"{out}/{name}.pdf", bbox_inches="tight", facecolor="white")
    f.savefig(f"{out}/{name}.jpg", bbox_inches="tight", facecolor="white", dpi=300)
    plt.close(f)

def load(paths):
    """(cond, qos, mode) -> dict(ratio, mu, agg, trips{run,rep}, ef_drops{}, ef_backlog{}, be_drops{})
    mode is "" for best-effort rows so both runs' BE arms pool."""
    g = {}
    for run, path in enumerate(paths):
        for r in csv.DictReader(open(path)):
            if r["cond"] == "warmup":
                continue
            mode = r.get("ef_mode", "work-conserving") if r["qos"] == "on" else ""
            k = (r["cond"], r["qos"], mode)
            d = g.setdefault(k, {"trips": {}, "ef_drops": {}, "be_drops": {}, "ef_backlog": {}, "owd": {}})
            d["ratio"] = float(r["aggregate_rsv_mbps_nominal"]) / float(r["ef_guarantee_mbps"])
            d["agg"] = float(r["aggregate_rsv_mbps_nominal"])
            d["mu"] = sum(int(x) for x in r["stream_rates_sas"].split("+")) / 4000.0
            d["ceil_ratio"] = float(r["link_bw_mbps"]) / float(r["ef_guarantee_mbps"])
            key = (run, int(r["rep"]))
            if r["t_trip_ms"] != "NA":
                d["trips"][key] = float(r["t_trip_ms"])
            d["ef_drops"][key] = int(r["ef_class_drops"])       # same value on every stream row
            d["be_drops"][key] = int(r["be_class_drops"])
            d["ef_backlog"][key] = int(r["ef_class_backlog"])
            d["owd"].setdefault(key, []).append(float(r["owd_mean_ms"]))
    return g

def series(g, qos, mode, key):
    pts = sorted((d["ratio"], np.array(list(d[key].values()), dtype=float))
                 for (c, q, m), d in g.items() if q == qos and m == mode and d[key])
    x = np.array([p[0] for p in pts])
    m = np.array([p[1].mean() for p in pts])
    s = np.array([p[1].std(ddof=1) if p[1].size > 1 else 0.0 for p in pts])
    return x, m, s

def guide_lines(ax, g, ytext):
    ceil = next(iter(g.values()))["ceil_ratio"]
    ax.axvline(1.0, color=INK2, lw=0.7, ls=(0, (2, 2)), zorder=1)
    ax.axvline(ceil, color=INK2, lw=0.7, ls=(0, (1, 2)), zorder=1)
    if ytext is not None:
        ax.text(1.0, ytext, "EF rate", fontsize=5.4, color=INK2, ha="center", va="bottom")
        ax.text(ceil, ytext, "link ceiling", fontsize=5.4, color=INK2, ha="center", va="bottom")

def mu_axis(ax, g):
    """x ticks at the measured ratios, labelled with the merging-unit equivalents (4000 sa/s)."""
    pts = sorted({(round(d["ratio"], 3), d["mu"]) for d in g.values()})
    ax.set_xticks([p[0] for p in pts])
    ax.set_xticklabels([f"{p[0]:.2f}\n{p[1]:g} MU" for p in pts], fontsize=5.6)
    ax.set_xlim(min(p[0] for p in pts) - 0.05, max(max(p[0] for p in pts), 1.5) + 0.06)

def plot_series(ax, g, key, keys=None, **kw):
    for (qos, mode) in (keys or SERIES):
        if (qos, mode) not in SERIES:
            continue
        lab, col, fmt, mfc = SERIES[(qos, mode)]
        x, m, s = series(g, qos, mode, key)
        if x.size == 0:
            continue
        ax.errorbar(x, m, yerr=s, fmt=fmt, color=col, lw=1.2, ms=3.4, mfc=mfc, mec=col if mfc == "white" else "white",
                    mew=0.7, capsize=2, elinewidth=0.8, label=lab, zorder=3, **kw)

def fig_trip(g, out):
    f, ax = plt.subplots(figsize=(COL_W, 2.0))
    plot_series(ax, g, "trips")
    ax.axhline(20, color=INK2, lw=0.8, ls=(0, (4, 3)))
    tops = [(series(g, q, m, "trips")[1] + series(g, q, m, "trips")[2]).max()
            for (q, m) in SERIES if series(g, q, m, "trips")[0].size]
    top = max(30, max(tops) * 1.12)
    style(ax); mu_axis(ax, g); guide_lines(ax, g, top)
    ax.text(ax.get_xlim()[1] - 0.01, 21.5, "20 ms budget", fontsize=5.6, color=INK2, ha="right")
    ax.set_ylim(0, top)
    ax.set_xlabel("aggregate R-SV / EF rate (Layer 2)"); ax.set_ylabel(r"$t_{trip}$ (ms), mean$\pm$std")
    ax.tick_params(axis="y", labelsize=6)
    ax.legend(ncol=2, loc="lower left", fontsize=5.8, frameon=False,
              bbox_to_anchor=(0, 1.07), columnspacing=1.0, handlelength=1.6)
    f.tight_layout(pad=0.4, rect=(0, 0, 1, 0.9))
    save(f, out, "fig6a-trip-vs-ratio")

def fig_queue(g, out):
    f, (a1, a2) = plt.subplots(2, 1, figsize=(COL_W, 2.7), sharex=True)
    ef_keys = [("on", "work-conserving"), ("on", "policed")]
    plot_series(a1, g, "ef_backlog", ef_keys)
    plot_series(a2, g, "ef_drops", ef_keys)
    for ax, ylab in ((a1, "max EF backlog\n(packets, 3 hops)"), (a2, "EF-class drops\nper 30 s window")):
        style(ax); ax.set_ylabel(ylab, fontsize=6.5); ax.tick_params(axis="y", labelsize=6)
        lo, hi = ax.get_ylim(); ax.set_ylim(0, max(hi, 1) * 1.1)
        guide_lines(ax, g, None)
    a1.text(1.0, a1.get_ylim()[1], "EF rate", fontsize=5.4, color=INK2, ha="center", va="bottom")
    a1.text(next(iter(g.values()))["ceil_ratio"], a1.get_ylim()[1], "link ceiling", fontsize=5.4, color=INK2, ha="center", va="bottom")
    mu_axis(a2, g); a2.set_xlabel("aggregate R-SV / EF rate (Layer 2)")
    a1.legend(ncol=2, loc="lower left", fontsize=5.8, frameon=False, bbox_to_anchor=(0, 1.12),
              columnspacing=1.0, handlelength=1.6)
    f.tight_layout(pad=0.4, h_pad=0.6, rect=(0, 0, 1, 0.93))
    save(f, out, "fig6b-efqueue-vs-ratio")

if __name__ == "__main__":
    out, paths = sys.argv[1], sys.argv[2:]
    g = load(paths)
    fig_trip(g, out)
    fig_queue(g, out)
    for (c, q, m), d in sorted(g.items(), key=lambda kv: (kv[1]["ratio"], kv[0][1], kv[0][2])):
        t = np.array(list(d["trips"].values())); e = np.array(list(d["ef_drops"].values()))
        b = np.array(list(d["be_drops"].values())); bl = np.array(list(d["ef_backlog"].values()))
        owd = np.array([np.mean(v) for v in d["owd"].values()])
        print(f"{c:7s} {q:3s} {m:16s} ratio={d['ratio']:.2f} ({d['agg']:.1f} Mb/s, {d['mu']:g} MU)  "
              f"t_trip={t.mean():.1f}+-{(t.std(ddof=1) if t.size > 1 else 0):.1f} ms (n={t.size})  "
              f"OWD={owd.mean():.1f} ms  EF drops={e.mean():.0f}  EF backlog max={bl.max()}p  BE drops={b.mean():.0f}")
    print("wrote fig6a-trip-vs-ratio fig6b-efqueue-vs-ratio ->", out)
