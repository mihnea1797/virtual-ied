#!/usr/bin/env python3
"""Merge qos_sweep CSVs of one campaign that was interrupted and resumed with --first-rep.

Usage:  merge_csv.py <out.csv> <first.csv>:<max_rep> [<next.csv>[:<max_rep>] ...]

Rows of <first.csv> with rep > <max_rep> (the repetition that was cut short) are dropped;
the resumed CSV supplies that repetition in full. All inputs must share the header.
"""
import csv, sys

def main():
    out, parts = sys.argv[1], sys.argv[2:]
    header, rows = None, []
    for part in parts:
        path, _, max_rep = part.partition(":")
        max_rep = int(max_rep) if max_rep else None
        with open(path) as f:
            rd = csv.DictReader(f)
            if header is None:
                header = rd.fieldnames
            elif rd.fieldnames != header:
                sys.exit(f"header mismatch in {path}")
            kept = [r for r in rd if max_rep is None or int(r["rep"]) <= max_rep]
        print(f"{path}: kept {len(kept)} rows" + (f" (rep <= {max_rep})" if max_rep else ""))
        rows += kept
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader(); w.writerows(rows)
    reps = sorted({int(r["rep"]) for r in rows})
    print(f"wrote {out}: {len(rows)} rows, reps {reps[0]}..{reps[-1]}")

if __name__ == "__main__":
    main()
