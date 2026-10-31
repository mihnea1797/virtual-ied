# Admission-control boundary sweep (Task B) — results and caveats

Campaign of 2026-09-15 on the unchanged 3-hop testbed (30 Mb/s HTB ceiling, 20 Mb/s EF rate,
2.5 + 2.5 ms netem, edge marking at the OVS). Aggregate R-SV swept across the EF rate by adding
merging-unit equivalents at a saturating background of 24 Mb/s (iperf3 UDP, payload rate; total
offered 146–188 % of the ceiling at Layer 2). Both QoS arms, 10 × 30 s per condition, one
discarded warm-up pass per run. Two EF modes:

| ef_mode | EF class on OVS q1 / router class 1:20 | meaning |
|---|---|---|
| work-conserving | rate 20 Mbit, ceil 30 Mbit (the paper's configuration) | EF may borrow unused link capacity |
| policed | rate 20 Mbit, **ceil 20 Mbit** on all three hops | EF aggregate policed to its rate (RFC 3246 style) |

Ladder (the 3 protection streams vMU1–3 stay at 4000 sa/s and remain the t_trip source; load
streams vMU4/vMU5 never step, so they cannot trigger the trip):

| cond | streams (sa/s) | aggregate L2 (198 B frames) | ratio to 20 Mb/s |
|---|---|---:|---:|
| rsv3.0 | 3 × 4000 | 19.0 Mb/s | 0.95 |
| rsv3.5 | 3 × 4000 + 2000 | 22.2 Mb/s | 1.11 |
| rsv4.0 | 4 × 4000 | 25.3 Mb/s | 1.27 |
| rsv4.5 | 4 × 4000 + 2000 | 28.5 Mb/s | 1.43 |
| rsv5.0 | 5 × 4000 | 31.7 Mb/s | 1.58 (above the 30 Mb/s ceiling) |

Files: `test-results/boundary_policed_20260915.csv`, `test-results/boundary_workconserving_20260915.csv`,
merged `test-results/boundary_both_20260915.csv`; statistics `analysis/stats_boundary*.csv`;
LaTeX `analysis/table_boundary.tex`; figures `figures/fig6a-trip-vs-ratio.*` (t_trip vs ratio,
three arms) and `figures/fig6b-efqueue-vs-ratio.*` (EF backlog and EF drops vs ratio).
New CSV columns (all existing columns kept): `n_streams, stream_rates_sas,
aggregate_rsv_mbps_nominal, aggregate_rsv_mbps_measured, ef_guarantee_mbps, ef_class_drops,
ef_class_overlimits, ef_class_backlog, ef_class_drops_hops, ef_class_sent_mbps, be_class_drops,
bg_mbps_measured, bg_loss_pct, ef_mode, ef_ceil_mbps` (`sub_rcvbuf_drops` exists in the driver but
was added after these runs). `ef_class_*` are deltas of `tc -s class show` counters summed over
the three hops (backlog = maximum of 3-s polls); `ef_class_drops_hops` gives the per-hop split.

## Results (mean ± std over 10 runs; OWD and gaps over runs × streams)

| ratio | arm | t_trip (ms) | OWD mean / max (ms) | gaps >16 ms / window | peak EF backlog (pkt) | EF drops / window | delivered R-SV (Mb/s) | background got (Mb/s) |
|---|---|---|---|---|---|---|---|---|
| 0.95 | EF work-cons. | **18.3 ± 0.1** | 6.2 / 41 | 0 | 64 | 0 | 19.0 | 11.4 |
| 0.95 | EF policed | **18.3 ± 0.1** | 6.1 / 20 | 0 | 68 | 0 | 19.0 | 11.4 |
| 0.95 | best-effort | 66 ± 11 | 58 / 123 | 53 ± 130 | – | – | 19.0 | 11.5 |
| 1.11 | EF work-cons. | 31.1 ± 6.4 | 20.2 / 118 | 0 | 298 ± 110 | 0 | 22.2 (all) | 8.2 |
| 1.11 | EF policed | 51.4 ± 1.9 | 48.9 / 93 | 698 ± 408 | 670 ± 26 | 0 | 20.0 (capped) | 10.5 |
| 1.11 | best-effort | 64 ± 8 | 60 / 172 | 424 ± 312 | – | – | 19.7 | 10.8 |
| 1.27 | EF work-cons. | 32.9 ± 7.4 | 22.5 / 166 | 0 | 354 ± 110 | 0 | 25.2 (all) | 5.4 |
| 1.27 | EF policed | 55.6 ± 2.3 | 53.2 / 103 | 830 ± 15 | 710 ± 19 | 0 | 20.0 (capped) | 10.4 |
| 1.27 | best-effort | 60 ± 4 | 60 / 145 | 722 ± 38 | – | – | 19.8 | 10.6 |
| 1.43 | EF work-cons. | 49 ± 12 (n = 9) | 55.5 / 267 | 4 ± 8 | 1237 ± 168 | 0 | 27.3 | 2.6 |
| 1.43 | EF policed | 60.5 ± 3.3 | 59.7 / 113 | 556 ± 281 | 796 ± 16 | 0 | 20.0 (capped) | 10.4 |
| 1.43 | best-effort | 66 ± 3 (n = 19) | 68 / 168 | 504 ± 253 | – | – | 20.7 | 13–24 |
| 1.58 | EF work-cons. | 85 ± 27 | 82 / 484 | 341 ± 271 | 1502 ± 372 | **38 000 ± 22 000** | 28.3 | 2.6 |
| 1.58 | EF policed | 63.3 ± 3.5 | 62.4 / 131 | 666 ± 13 | 842 ± 31 | 0 | 20.0 (capped) | 10.4 |
| 1.58 | best-effort | 76 ± 27 (n = 19) | 82 / 191 | 296 ± 280 | – | – | 20.6 | 21–24 |

Full percentiles (p5/p25/median/p75/p95/p99, CoV) per condition and metric are in
`analysis/stats_boundary.csv`; the best-effort arms of the two runs are pooled (n = 20).

## What the sweep shows

1. **Sanity check passed.** Policed EF at 0.95 of its rate is indistinguishable from the paper's
   EF baseline: 18.3 ms, 6.1 ms OWD, no gaps, no drops, ~65-packet peak backlog in both modes.
2. **The boundary is the EF rate, in both modes, and it is a delay boundary.** The first point
   above the rate (1.11) already leaves the 20 ms budget: 31 ms work-conserving, 51 ms policed.
   No EF packet is dropped anywhere until the aggregate exceeds what the class can forward.
3. **Policed EF degrades by shaping.** The class forwards exactly 19.9 Mb/s; the queue fills to
   670–840 packets (≈ 35–42 ms at 20 Mb/s) and the sources are back-pressured, so the excess is
   never dropped in the network, but delivered rate falls to 20.0 Mb/s, gaps >16 ms appear on
   every stream (700–830 per window) and t_trip rises in a step to 51 ms, then slowly to 63 ms.
   Above the rate, policed EF is only marginally better than best-effort (and worse in gaps).
4. **Work-conserving EF degrades later and more gently, then collapses.** Up to 1.27 it delivers
   the whole aggregate with 300–350 packets of queue (t_trip 31–33 ms, still above budget, no
   gaps). At 1.43 it reaches its borrowing limit (≈ 28.3 Mb/s forwarded = rate + share of the
   excess; background squeezed to 2.6 Mb/s) with 1200+ packets queued and t_trip 49 ms. At 1.58
   (above the 30 Mb/s ceiling) the OVS EF class drops 38 000 ± 22 000 packets per window and EF is
   no better than best-effort (85 vs 76 ms).
5. **Admission-control statement for the paper.** The EF guarantee protects protection traffic
   only while the aggregate stays below the EF rate; the 20 ms bound is lost within one
   half-MU above it whether the class is policed or work-conserving. Policing yields a
   predictable but useless 50–63 ms; borrowing buys ~30 ms up to the link ceiling and then
   fails. Dimensioning must therefore keep Σ R-SV (at Layer 2, 6.34 Mb/s per 4-channel stream)
   below the EF rate — the three-stream campaign of the paper sits at 0.95.

## Caveats (read before quoting numbers)

- **Layer-2 accounting.** Ratios use the on-wire 198 B frame (what HTB meters). At IP level the
  same ladder reads 0.88 / 1.03 / 1.18 / 1.32 / 1.47.
- **Publisher memory leak → policed run resumed.** The iec61850-lab publisher leaks ~30 MB/min
  per process while its socket is back-pressured; vMU3 was OOM-killed at 1.7 GB during
  repetition 9 of the policed run. Repetitions 1–8 come from `raw_boundary_policed_reps1-8_*.csv`,
  9–10 from `raw_boundary_policed_reps9-10_*.csv` (fresh warm-up). Since then the driver restarts
  all publisher processes at every repetition (`publishers_restart()`); the work-conserving run
  used that from the start. t_trip/OWD showed no drift across repetitions before the kill.
- **R-GOOSE storm from the vIED (present in both campaigns).** The vIED debounced the *last*
  stream's threshold state instead of the OR over streams, so with a never-stepping load stream
  present it toggled the trip on every received ASDU after the step: 80 k–260 k R-GOOSE per 30 s
  window at every point ≥ 1.11, in both arms and modes (measured with tcpdump at vMU1). Effects:
  (a) EF-arm t_trip is unaffected — vMU1's own crossing is always the first "true" after its step;
  (b) three best-effort t_trip values (14.7, 16.6, 17.1 ms) are below the 18 ms loop floor
  (another stream's trip arrived first) and are excluded in `table_boundary.tex` (footnotes);
  (c) the storm loaded the vIED CPU during the second half of those windows. The vIED now OR-s
  per-stream states (`GoosePublisherWrapper::PublishMessage(appId, value)`); a validation run with
  the fixed binary gave 21 R-GOOSE frames in total and the same metrics (rsv3.0 EF 18.34 ms;
  rsv4.5 EF work-conserving 41.1 ms, OWD 45.6 ms, 0.19 % loss, 0 subscriber drops — within the
  campaign's 49 ± 12 ms / 55 ± 18 ms).
- **Episodic receiver overload in the work-conserving run.** The vIED's UDP receive buffers
  dropped ~107 k packets in repetitions 1–2 (rsv4.5 EF: 74 k / 62 k lost samples, 11–14 %) and
  ≈ 1 k per window afterwards; a fresh diagnostic reproduced 22–65 drops. Those two repetitions
  inflate the 1.43 work-conserving loss/std; network-side counters (EF drops = 0, backlog) are
  unaffected. `sub_rcvbuf_drops` is recorded in future runs.
- **Background loss** (`bg_loss_pct`) is NA by design: the iperf3 receiver summary does not exist
  when the client is interrupted at window end. Best-effort-class drops (`be_class_drops`) and the
  sender-side `bg_mbps_measured` (also throttled by back-pressure: 11 Mb/s of 24 in most
  conditions) cover the background's fate.
- **No topology change.** vMU4/vMU5 are extra publisher processes in vmu2/vmu3 (IP aliases
  10.10.40.4/.5, UDP 105/106, HTTP 8084/8085); the OVS marks 105/106 as EF as well.

## Reproduce

```
.venv/bin/python -u qos_sweep.py --campaign boundary --ef-mode policed
.venv/bin/python -u qos_sweep.py --campaign boundary --ef-mode work-conserving
.venv/bin/python analysis/stats_table.py test-results/boundary_both_20260915.csv analysis --label boundary
.venv/bin/python analysis/make_figs_boundary.py figures test-results/boundary_policed_20260915.csv test-results/boundary_workconserving_20260915.csv
```
