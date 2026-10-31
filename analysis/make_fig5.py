#!/usr/bin/env python3
"""Fig. 5: empirical CDF of t_trip at 120% offered load, DiffServ EF vs best-effort,
dashed vertical line at the 20 ms budget.

Usage:  make_fig5.py <results.csv> <outdir>        -> <outdir>/fig5-trip-cdf.{pdf,jpg}

Style constants and helpers are copied verbatim from energycon/make_figs.py
(iec61850-lab repo) so the figure matches Figs. 2-4: EF blue #2a78d6, best-effort
orange #eb6834 (colorblind-safe pair), IEEE single-column width, DejaVu Sans 7.5 pt,
recessive y-grid, no top/right spines, white background, PDF + 300 dpi JPG."""

import csv, sys
from collections import defaultdict
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

EF, BE = "#2a78d6", "#eb6834"
INK, INK2, GRID = "#0b0b0b", "#52514e", "#d9d7d2"
LOAD = {"baseline": 60, "load9M": 90, "load13M": 105, "load18M": 120, "load24M": 140}
COL_W = 3.45  # IEEE single column, inches

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 7.5,
    "axes.edgecolor": GRID, "axes.linewidth": 0.7,
    "axes.labelcolor": INK, "xtick.color": INK2, "ytick.color": INK2,
    "grid.color": GRID, "grid.linewidth": 0.5,
    "legend.frameon": False, "pdf.fonttype": 42,
})

def style(ax):
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", zorder=0)
    ax.set_axisbelow(True)

def save(f, out, name):
    f.savefig(f"{out}/{name}.pdf", bbox_inches="tight", facecolor="white")
    f.savefig(f"{out}/{name}.jpg", bbox_inches="tight", facecolor="white", dpi=300)
    plt.close(f)

def trips_by_condition(path):
    """cond,qos -> sorted list of t_trip, ONE value per repetition (the CSV repeats the
    same t_trip on every stream row of a repetition)."""
    g = defaultdict(dict)
    for r in csv.DictReader(open(path)):
        if r["t_trip_ms"] != "NA":
            g[(r["cond"], r["qos"])][int(r["rep"])] = float(r["t_trip_ms"])
    return {k: np.array(sorted(v.values())) for k, v in g.items()}

def ecdf(x):
    x = np.sort(x)
    return x, np.arange(1, x.size + 1) / x.size

def fig_trip_cdf(trips, out, cond="load18M"):
    load = LOAD[cond]
    f, ax = plt.subplots(figsize=(COL_W, 1.85))
    for qos, col, lab in (("off", BE, "best-effort"), ("on", EF, "DiffServ EF")):
        x, y = ecdf(trips[(cond, qos)])
        # step ECDF (right-continuous) with the samples marked
        xs = np.concatenate([[x[0]], x]); ys = np.concatenate([[0.0], y])
        ax.step(xs, ys, where="post", color=col, lw=1.4, label=f"{lab} (n={x.size})", zorder=3)
        ax.plot(x, y, "o", ms=3.0, color=col, mec="white", mew=0.5, zorder=4)
    ax.axvline(20, color=INK2, lw=0.8, ls=(0, (4, 3)), zorder=2)
    ax.text(21.5, 0.08, "20 ms budget", fontsize=5.6, color=INK2, ha="left")
    style(ax)
    ax.set_xlim(0, 100); ax.set_xticks([0, 20, 40, 60, 80, 100])
    ax.set_ylim(0, 1.02); ax.set_yticks([0, 0.25, 0.5, 0.75, 1.0])
    ax.set_xlabel(r"$t_{trip}$ (ms)"); ax.set_ylabel("empirical CDF")
    ax.tick_params(labelsize=6)
    ax.text(98, 0.45, f"{load}% offered load", fontsize=6, color=INK2, ha="right", va="center")
    # legend reads like the plot: EF (left, ~18 ms) before best-effort (right, 50-64 ms); draw order unchanged
    h, l = ax.get_legend_handles_labels()
    ax.legend(h[::-1], l[::-1], ncol=2, loc="lower left", fontsize=6, frameon=False,
              bbox_to_anchor=(0, 1.0), columnspacing=1.2, handlelength=1.4)
    f.tight_layout(pad=0.4, rect=(0, 0, 1, 0.88))
    save(f, out, "fig5-trip-cdf")

if __name__ == "__main__":
    csv_path, out = sys.argv[1], sys.argv[2]
    trips = trips_by_condition(csv_path)
    fig_trip_cdf(trips, out)
    for qos in ("on", "off"):
        t = trips[("load18M", qos)]
        print(f"120% {'EF' if qos == 'on' else 'BE'}: n={t.size} min={t.min():.1f} median={np.median(t):.1f} "
              f"max={t.max():.1f} P(t_trip<=20ms)={np.mean(t <= 20):.2f}")
    print("wrote fig5-trip-cdf.{pdf,jpg} ->", out)
