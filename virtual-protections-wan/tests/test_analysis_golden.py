#!/usr/bin/env python3
"""Regression check: the kept result CSVs must still produce the tracked tables (no lab needed).
Run:  .venv/bin/python tests/test_analysis_golden.py   (prints 'ok').

Re-runs analysis/stats_table.py on every kept campaign in test-results/ and compares the output
with the stats_*.csv / table_*.tex files tracked in analysis/, which are what the paper quotes.
Also re-merges the two raw parts of the resumed 2026-09-15 rate-capped campaign.

A failure means a change to the analysis (or to a kept CSV) has moved a published number. If the
change is intended, regenerate the tracked files with the commands in the README and say so in
the commit; if not, it is a bug."""
import pathlib, subprocess, sys, tempfile
ROOT = pathlib.Path(__file__).resolve().parent.parent
PY = sys.executable

TABLES = [  # kept campaign CSV -> label of the tracked analysis/stats_<label>.csv + table_<label>.tex
    ("qos_sweep_20260829_093156.csv",          "table1"),                     # paper Table I (baseline)
    ("boundary_both_20260930.csv",             "boundary"),                   # boundary re-run, both EF modes
    ("boundary_workconserving_20260930.csv",   "boundary-wc"),
    ("boundary_policed_20260930.csv",          "boundary-policed"),
    ("boundary_both_20260915.csv",             "boundary_20260915"),          # first boundary sweep
    ("boundary_workconserving_20260915.csv",   "boundary-wc_20260915"),
    ("boundary_policed_20260915.csv",          "boundary-policed_20260915"),
]

def body(path):
    """A .tex table without its first line (a comment that records the path typed at generation)."""
    return path.read_text().split("\n", 1)[1]

with tempfile.TemporaryDirectory() as tmp:
    tmp = pathlib.Path(tmp)
    for name, label in TABLES:
        r = subprocess.run([PY, str(ROOT / "analysis" / "stats_table.py"), str(ROOT / "test-results" / name),
                            str(tmp), "--label", label], capture_output=True, text=True)
        assert r.returncode == 0, f"stats_table.py failed on {name}:\n{r.stderr}"
        got, want = tmp / f"stats_{label}.csv", ROOT / "analysis" / f"stats_{label}.csv"
        assert got.read_text() == want.read_text(), f"{name}: stats differ from tracked analysis/{want.name}"
        got, want = tmp / f"table_{label}.tex", ROOT / "analysis" / f"table_{label}.tex"
        assert body(got) == body(want), f"{name}: LaTeX table differs from tracked analysis/{want.name}"

    # merge_csv.py: rows of the interrupted first part beyond repetition 8 are dropped, the
    # resumed part supplies repetitions 9-10; the result is the kept merged campaign.
    res = ROOT / "test-results"
    out = tmp / "merged.csv"
    r = subprocess.run([PY, str(ROOT / "analysis" / "merge_csv.py"), str(out),
                        f"{res / 'raw_boundary_policed_reps1-8_20260915_104954.csv'}:8",
                        str(res / "raw_boundary_policed_reps9-10_20260915_115244.csv")], capture_output=True, text=True)
    assert r.returncode == 0, f"merge_csv.py failed:\n{r.stderr}"
    assert out.read_text() == (res / "boundary_policed_20260915.csv").read_text(), "merge differs from the kept CSV"
print("ok")
