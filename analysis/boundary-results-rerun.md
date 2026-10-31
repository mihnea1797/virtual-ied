# Admission-control boundary sweep (Task B) — re-run of 2026-09-30 with the fixed vIED

Re-run of the 2026-09-15 campaign on the unchanged 3-hop testbed (30 Mb/s HTB ceiling, 20 Mb/s EF
rate, 2.5 + 2.5 ms netem, DSCP-EF marking at the OVS edge, read-back of HTB rate, netem and ping
RTT at setup), same ladder, same settings, so that the three caveats of 2026-09-15 are **eliminated
instead of disclosed**:

| 2026-09-15 caveat | what was done for this run | measured in this run |
|---|---|---|
| R-GOOSE storm (vIED debounced the last stream's state, 80 k–260 k frames per window) | vIED OR-s per-stream threshold states (`GoosePublisherWrapper::PublishMessage(appId, value)`); deployed binary verified by symbol and fingerprint (sha256 0a579afa…, 2026-09-30 21:20 UTC) | new column `rgoose_frames_per_window` = tcpdump count at vMU1 of the frames the vIED sends it: **1 per window at every point up to 1.43 in both EF modes**, max 67 anywhere (see check 1) |
| Publisher memory leak → vMU3 OOM in policed repetition 9 | `publishers_restart()` at the start of every repetition (both campaigns, from the first repetition) | both campaigns completed without abort or resume; 10 complete repetitions in every condition |
| vIED UDP receive-buffer overflow (~107 k drops in work-conserving repetitions 1–2 at 1.43/1.58) | host `net.core.rmem_max` 4 → 16 MiB (lab-up.sh step 0/5); every vIED UDP socket requests `SO_RCVBUF` = 8 MiB, kernel grants 16 MiB (read back and logged) | `sub_rcvbuf_drops` = 0 in all 840 rows; cumulative UDP `RcvbufErrors` in the vied container 0 after both campaigns |

Campaigns: work-conserving 21:25–22:39 UTC, policed 22:39–23:52 UTC (74 min each, one discarded
warm-up pass + 10 × 30 s per condition, background 24 Mb/s iperf3 UDP, both QoS arms). Mapping of
the EF configurations (driver flag kept as is):

| driver `--ef-mode` | paper term | EF class on OVS q1 / router class 1:20 |
|---|---|---|
| `work-conserving` | work-conserving | rate 20 Mbit, ceil 30 Mbit (the paper's configuration) |
| `policed` | **rate-capped** | rate 20 Mbit, **ceil 20 Mbit** on all three hops |

Ladder (vMU1–3 at 4000 sa/s are the only t_trip source; vMU4/vMU5 are load only, never step):
rsv3.0 = 19.0 Mb/s L2 (0.95) · rsv3.5 = 22.2 (1.11) · rsv4.0 = 25.3 (1.27) · rsv4.5 = 28.5 (1.43) ·
rsv5.0 = 31.7 (1.58, above the 30 Mb/s ceiling). Ratios use the on-wire 198 B frame.

Files: `test-results/boundary_workconserving_20260930.csv`, `test-results/boundary_policed_20260930.csv`,
merged `test-results/boundary_both_20260930.csv` (840 rows, every 2026-09-15 column kept, plus
`sub_rcvbuf_drops` and `rgoose_frames_per_window`); statistics `analysis/stats_boundary.csv`
(+ `stats_boundary-wc.csv`, `stats_boundary-policed.csv`); LaTeX `analysis/table_boundary.tex` in the
paper's column order (ratio | arm | Rate | OWD mean/max | Gaps mean±std | t_trip mean±std | p95/CoV),
**no excluded runs, no footnoted t_trip**; figures `figures/fig6a-trip-vs-ratio.*`,
`figures/fig6b-efqueue-vs-ratio.*`. The 2026-09-15 CSVs are untouched; the 2026-09-15 statistics,
tables and figures were kept as `*_20260915.*` copies before regenerating.

## Results (mean ± std over repetitions; OWD and gaps over repetitions × streams)

| ratio | arm | t_trip (ms) | OWD mean / max (ms) | gaps >16 ms / window | peak EF backlog (pkt) | EF drops / window | delivered R-SV (Mb/s) | background got (Mb/s) | loss % | R-GOOSE / window | rcvbuf drops |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.95 | best-effort | 61.4 ± 9.6 (n = 20) | 54.0 / 105 | 52 ± 169 | – | – | 18.9 | 11.4 | 0.18 | 1.0 (max 1) | 0 |
| 0.95 | EF policed (rate-capped) | 18.3 ± 0.1 (n = 10) | 6.1 / 22 | 0 ± 0 | 64 ± 2 | 0 ± 0 | 19.0 | 11.4 | 0.02 | 1.0 (max 1) | 0 |
| 0.95 | EF work-conserving | 18.3 ± 0.1 (n = 10) | 6.1 / 16 | 0 ± 0 | 68 ± 11 | 0 ± 0 | 19.0 | 11.3 | 0.03 | 1.0 (max 1) | 0 |
| 1.11 | best-effort | 63.7 ± 12.4 (n = 20) | 55.8 / 109 | 403 ± 332 | – | – | 19.5 | 10.9 | 0.13 | 1.0 (max 1) | 0 |
| 1.11 | EF policed (rate-capped) | 49.8 ± 0.3 (n = 10) | 47.5 / 105 | 696 ± 407 | 655 ± 33 | 0 ± 0 | 20.0 | 10.4 | 0.02 | 1.0 (max 1) | 0 |
| 1.11 | EF work-conserving | 22.8 ± 2.1 (n = 10) | 11.3 / 45 | 0 ± 0 | 167 ± 108 | 0 ± 0 | 22.2 | 8.2 | 0.07 | 1.0 (max 1) | 0 |
| 1.27 | best-effort | 58.8 ± 6.5 (n = 20) | 57.9 / 163 | 736 ± 25 | – | – | 19.1 | 11.3 | 0.01 | 1.0 (max 1) | 0 |
| 1.27 | EF policed (rate-capped) | 54.2 ± 0.4 (n = 10) | 51.6 / 95 | 823 ± 23 | 690 ± 20 | 0 ± 0 | 20.0 | 10.4 | 0.00 | 1.0 (max 1) | 0 |
| 1.27 | EF work-conserving | 24.2 ± 2.0 (n = 10) | 11.5 / 45 | 0 ± 0 | 207 ± 54 | 0 ± 0 | 25.3 | 5.3 | 0.15 | 1.0 (max 1) | 0 |
| 1.43 | best-effort | 65.4 ± 12.7 (n = 20) | 62.0 / 157 | 522 ± 261 | – | – | 20.4 | 12.6 | 1.10 | 2.3 (max 25) | 0 |
| 1.43 | EF policed (rate-capped) | 61.1 ± 0.5 (n = 10) | 58.9 / 110 | 547 ± 277 | 782 ± 17 | 0 ± 0 | 20.0 | 10.4 | 0.03 | 1.0 (max 1) | 0 |
| 1.43 | EF work-conserving | 38.7 ± 1.6 (n = 10) | 40.5 / 99 | 9 ± 15 | 1065 ± 34 | 0 ± 0 | 28.5 | 2.6 | 0.15 | 1.0 (max 1) | 0 |
| 1.58 | best-effort | 85.2 ± 16.6 (n = 20) | 76.0 / 144 | 191 ± 276 | – | – | 20.6 | 20.5 | 25.60 | 27.9 (max 67) | 0 |
| 1.58 | EF policed (rate-capped) | 64.1 ± 0.5 (n = 10) | 62.1 / 168 | 651 ± 23 | 848 ± 128 | 22338 ± 70640 | 20.0 | 10.4 | 3.72 | 1.0 (max 1) | 0 |
| 1.58 | EF work-conserving | 60.4 ± 9.2 (n = 10) | 54.8 / 113 | 396 ± 384 | 1028 ± 85 | 17140 ± 27306 | 28.5 | 2.6 | 3.27 | 24.6 (max 58) | 0 |

"R-GOOSE / window" is mean (max) over repetitions of `rgoose_frames_per_window`; "rcvbuf drops" is the
sum of `sub_rcvbuf_drops` over the condition. "loss %" is the mean per-stream sample loss at the vIED.
Full percentiles (p5/p25/median/p75/p95/p99, CoV) per condition and metric: `analysis/stats_boundary.csv`.

## What the re-run shows (and what changes against 2026-09-15)

1. **Sanity check passed again.** At 0.95 both EF modes give 18.3 ± 0.1 ms, 6.1 ms OWD, no gaps, no
   drops, 64–68 packets of peak backlog — identical to 2026-09-15 and to the paper's EF baseline.
2. **The boundary is still the EF rate, in both modes, and it is still a delay boundary.** The first
   point above the rate (1.11) leaves the 20 ms budget in both modes: 22.8 ± 2.1 ms (p95 26.4 ms)
   work-conserving, 49.8 ± 0.3 ms rate-capped. No EF packet is dropped at any hop until the
   aggregate exceeds the link ceiling (1.58), in either mode (one exception, see caveat 2).
3. **Rate-capped EF is unchanged.** Means move by at most 1.7 ms against 2026-09-15 and the
   standard deviations shrink 3–7× (0.3–0.5 ms vs 1.9–3.5 ms) now that the vIED is not fighting a
   storm. The class shapes to 19.9 Mb/s, queues 650–850 packets, back-pressures the sources, gaps
   >16 ms appear on every stream (550–820 per window) and t_trip steps to 50 ms at 1.11, then 54,
   61, 64 ms. Above the rate it is only marginally better than best-effort.
4. **Work-conserving EF is materially better than 2026-09-15 reported, and the old numbers were
   inflated by the caveats.** t_trip is 22.8 / 24.2 / 38.7 / 60.4 ms at 1.11 / 1.27 / 1.43 / 1.58
   against 31.1 / 32.9 / 49.2 / 84.6 ms before (−8.3, −8.7, −10.5, −24.2 ms), with std 2.1 / 2.0 /
   1.6 / 9.2 ms against 6.4 / 7.4 / 12.4 / 27.2 ms; peak EF backlog 167 / 207 / 1065 / 1028 packets
   against 298 / 354 / 1237 / 1502; EF drops at 1.58 17 k ± 27 k per window against 38 k ± 22 k.
   Up to 1.27 the class delivers the whole aggregate with no gaps and t_trip 3–4 ms over budget
   (not 11–13 ms); at 1.43 it reaches its borrowing limit (28.3 Mb/s forwarded, background squeezed
   to 2.6 Mb/s, 1065 packets queued) at 39 ms; at 1.58 the OVS EF class drops in 4 of 10
   repetitions (41 k–64 k) and t_trip is 60 ± 9 ms, now clearly better than best-effort (85 ± 17 ms)
   rather than equal to it.
5. **Best-effort is unchanged within its own spread** (Δ mean −4.9 … +9.2 ms, all inside one std).
   Its bimodality persists: in a given 30 s window either the iperf3 flow takes its full 24 Mb/s and
   R-SV loses ~33 % (t_trip 87–104 ms at 1.58), or R-SV wins and the background gets ~11 Mb/s
   (t_trip ~63 ms). This is why gaps carry the "bimodal" footnotes in `table_boundary.tex`.
6. **Admission-control statement for the paper: unchanged in substance, softer in the
   work-conserving numbers.** The EF guarantee protects protection traffic only while Σ R-SV stays
   below the EF rate (6.34 Mb/s per 4-channel 4000 sa/s stream at Layer 2); the 20 ms bound is lost
   within one half-MU above it whether the class is rate-capped (50 ms, predictable) or
   work-conserving (23 ms, i.e. borrowing buys ~27 ms of the 32 ms that capping costs, up to the
   link ceiling). Sentences in the draft that quote 31–33 ms, 49 ms or "no better than best-effort
   at 1.58" for the work-conserving arm must be updated to this table.

## Per-point comparison against the reference campaign (new − reference)

t_trip statistics exclude values below the 18 ms loop floor on both sides, as the reference table did (n is therefore 9/19 for three reference conditions; no exclusion was needed in the new data).

| ratio | arm | t_trip mean: new / ref / Δ (ms) | t_trip std: new / ref / Δ (ms) | EF backlog mean: new / ref / Δ (pkt) | EF drops mean: new / ref / Δ |
|---|---|---|---|---|---|
| 0.95 | best-effort | 61.4 / 66.3 / -4.9 | 9.6 / 11.2 / -1.6 | – | – |
| 0.95 | EF policed (rate-capped) | 18.3 / 18.3 / -0.0 | 0.1 / 0.1 / -0.0 | 64 / 68 / -5 | 0 / 0 / +0 |
| 0.95 | EF work-conserving | 18.3 / 18.3 / +0.0 | 0.1 / 0.1 / -0.0 | 68 / 64 / +3 | 0 / 0 / +0 |
| 1.11 | best-effort | 63.7 / 64.5 / -0.8 | 12.4 / 7.6 / +4.7 | – | – |
| 1.11 | EF policed (rate-capped) | 49.8 / 51.4 / -1.7 | 0.3 / 1.9 / -1.5 | 655 / 670 / -15 | 0 / 0 / +0 |
| 1.11 | EF work-conserving | 22.8 / 31.1 / -8.3 | 2.1 / 6.4 / -4.3 | 167 / 298 / -131 | 0 / 0 / +0 |
| 1.27 | best-effort | 58.8 / 60.4 / -1.5 | 6.5 / 3.9 / +2.6 | – | – |
| 1.27 | EF policed (rate-capped) | 54.2 / 55.6 / -1.4 | 0.4 / 2.3 / -1.9 | 690 / 710 / -20 | 0 / 0 / +0 |
| 1.27 | EF work-conserving | 24.2 / 32.9 / -8.7 | 2.0 / 7.4 / -5.4 | 207 / 354 / -146 | 0 / 0 / +0 |
| 1.43 | best-effort | 65.4 / 66.5 / -1.1 | 12.7 / 3.2 / +9.4 | – | – |
| 1.43 | EF policed (rate-capped) | 61.1 / 60.5 / +0.6 | 0.5 / 3.3 / -2.8 | 782 / 796 / -14 | 0 / 0 / +0 |
| 1.43 | EF work-conserving | 38.7 / 49.2 / -10.5 | 1.6 / 12.4 / -10.9 | 1065 / 1237 / -172 | 0 / 0 / +0 |
| 1.58 | best-effort | 85.2 / 75.9 / +9.2 | 16.6 / 26.5 / -9.9 | – | – |
| 1.58 | EF policed (rate-capped) | 64.1 / 63.3 / +0.8 | 0.5 / 3.5 / -3.0 | 848 / 842 / +6 | 22338 / 0 / +22338 |
| 1.58 | EF work-conserving | 60.4 / 84.6 / -24.2 | 9.2 / 27.2 / -18.0 | 1028 / 1502 / -474 | 17140 / 38000 / -20860 |

Reference = `test-results/boundary_both_20260915.csv` (rate-capped campaign resumed at repetition 9
after the OOM; recorded with the R-GOOSE storm present). EF backlog and EF drops are means over
repetitions of the per-window values (sum of the three hops; backlog = max of 3-s polls).

## Go / no-go checks


- **R-GOOSE storm absent: yes.** rgoose_frames_per_window over all 840 rows (840 populated): max 67.0 at rsv5.0 qos=off policed rep 7, mean 5.76; storm threshold 1000 (2026-09-15: 80 000–260 000 per window at every point ≥ 1.11). t_trip below the 18 ms loop floor: 0 (none excluded).
  Per point, mean (max) frames per window: 0.95 best-effort: 1 (max 1), 0.95 EF policed (rate-capped): 1 (max 1), 0.95 EF work-conserving: 1 (max 1), 1.11 best-effort: 1 (max 1), 1.11 EF policed (rate-capped): 1 (max 1), 1.11 EF work-conserving: 1 (max 1), 1.27 best-effort: 1 (max 1), 1.27 EF policed (rate-capped): 1 (max 1), 1.27 EF work-conserving: 1 (max 1), 1.43 best-effort: 2 (max 25), 1.43 EF policed (rate-capped): 1 (max 1), 1.43 EF work-conserving: 1 (max 1), 1.58 best-effort: 28 (max 67), 1.58 EF policed (rate-capped): 1 (max 1), 1.58 EF work-conserving: 25 (max 58).
- **No publisher restart failures: yes.** Every condition × EF mode has repetitions 1..10 with one row per active stream .
- **sub_rcvbuf_drops = 0 at all points: yes.** Sum over all rows = 0, NA cells = 0 (2026-09-15: ~107 k in work-conserving reps 1–2).
- Required columns populated in every row (840 rows): yes.

### Reading the R-GOOSE counts (check 1)

One frame per window is the expected value: the vIED publishes only on a change of the OR-ed trip
state, and the only change inside a window is vMU1–3 crossing the threshold at their step (the
release happens at the re-arm, before t0). That is exactly what every window shows up to 1.43 in
both EF modes and at every point in the rate-capped mode, including 1.58 with 3.7 % loss. Windows
with more than one frame occur only in the two conditions where a shared queue tail-drops R-SV:
best-effort at 1.43 (1 repetition of 20, 25 frames) and 1.58 (median 20–29, max 67), and
work-conserving EF at 1.58 (median 24, max 58; 6 of 10 repetitions). The vIED's RMS is a sliding
window over the last 80 *received* samples (`RmsComputationObject`), so a burst of consecutive lost
samples makes the window span more than one cycle and its value ripple; with amplitudes of 210
(load, below) and 250 (stepped, above) against a threshold of 230 the margin is 8.7 % either way,
and a burst that hits all three stepped streams at once (a full shared queue drops every arrival)
can release and re-assert the aggregate, two frames per event. The count is not proportional to the
loss (37 % uniform loss in rate-capped 1.58 repetition 1 gave 1 frame; 6–9 % loss in best-effort 1.43
repetition 8 gave 25), which fits burst structure rather than loss volume. This is an interpretation
of the counts, not a measured mechanism. Two orders of magnitude separate these counts from the
2026-09-15 storm (10⁴–10⁵ frames, toggling on every ASDU regardless of loss), no t_trip is below
the 18 ms loop floor and the EF-arm t_trip spread is 0.3–2.1 ms at every point up to 1.43, so the
storm is absent and t_trip is not contaminated by another stream's transition.

## Caveats (read before quoting numbers)

1. **Layer-2 accounting** as before: ratios use the 198 B on-wire frame. At IP level the ladder
   reads 0.88 / 1.03 / 1.18 / 1.32 / 1.47.
2. **One rate-capped repetition with EF drops.** In repetition 1 of the policed campaign at 1.58 the
   OVS EF class dropped 223 384 packets in the window (backlog 1211 packets vs 790–820 in the other
   nine), all five streams lost 36–37 % (vs 0.00–0.02 %), the class still forwarded 19.9 Mb/s and
   t_trip was 63.8 ms (condition mean 64.1 ± 0.5): the source back-pressure that normally absorbs
   the excess did not engage in that window and the shaper tail-dropped instead. It is the only
   repetition in either campaign where the rate-capped EF class dropped anything, and it is the
   whole of the "22 338 ± 70 640" EF-drops entry at 1.58 rate-capped (median 0). Not excluded: it
   is a genuine policing outcome and does not move t_trip. Quote the median (0) or name the
   repetition if the mean is used.
3. **Residual loss with zero network drops and zero receiver drops** (0.00–0.15 % in the EF arms up
   to 1.43, 3.3–3.7 % at 1.58) is sender-side by elimination: the publisher skips samples while its
   UDP socket is back-pressured by the full EF queue. Delivered rate (`aggregate_rsv_mbps_measured`)
   is the number to quote for throughput.
4. **`bg_loss_pct` is NA by design** (iperf3 receiver summary does not exist when the client is
   interrupted at window end); `be_class_drops` and the sender-side `bg_mbps_measured` cover the
   background's fate, as on 2026-09-15.
5. **Comparison basis.** The reference t_trip statistics apply the same 18 ms floor exclusion as
   the published 2026-09-15 table (n = 9 at 1.43 work-conserving, n = 19 for best-effort at 1.43 and
   1.58); nothing was excluded from the new data.
6. **No topology change**, as before: vMU4/vMU5 are extra publisher processes in vmu2/vmu3 (IP
   aliases 10.10.40.4/.5, UDP 105/106, HTTP 8084/8085); the OVS marks 105/106 as EF.

## Pre-flight record

- Deployed vIED binary: `/opt/virtual-merging-unit/merging-unit` in the vied container, built
  2026-09-30 21:20 UTC from the virtual-ied working tree (HEAD 6e703a0 + uncommitted OR-fix +
  SO_RCVBUF), `nm` shows `GoosePublisherWrapper::PublishMessage(unsigned short, bool)`,
  sha256 0a579afa4ddf30d0adecef3469e6bc8be7482d64cb694fd9865c28a20cf2fa47. Superseded binaries kept
  as `virtual-ied/build/merging-unit.bak-20260915` and `.bak-20260930`. The containers run the generic
  `dev-container:latest` image, so the binary fingerprint, not an image tag, identifies the build.
- Receive buffers: host `net.core.rmem_max` 4 194 304 → 16 777 216 (global sysctl, read-only in
  container netns; set live through a privileged container in the host netns because the VM has no
  passwordless sudo, persisted in `lab-up.sh` step 0/5). vIED sockets: `SO_RCVBUF` requested
  8 388 608, effective 16 777 216 on all six UDP sockets (`ss -ulnpm` rb, and the vIED log).
- Smoke test (rsv4.5, EF work-conserving, one 30 s window, independent tcpdump at vMU1 over the
  whole run): 10 R-GOOSE frames in total (1 inside the window; the rest are the transitions at setup,
  publisher restart and final re-arm), `sub_rcvbuf_drops` 0, 5/5 publishers alive, t_trip 39.8 ms.
  CSV kept as `test-results/smoke_rsv4.5_20260930_212127.csv`.

## Reproduce

```
.venv/bin/python -u qos_sweep.py --campaign boundary --ef-mode work-conserving
.venv/bin/python -u qos_sweep.py --campaign boundary --ef-mode policed
.venv/bin/python analysis/merge_csv.py test-results/boundary_both_20260930.csv test-results/boundary_workconserving_20260930.csv test-results/boundary_policed_20260930.csv
.venv/bin/python analysis/stats_table.py test-results/boundary_both_20260930.csv analysis --label boundary
.venv/bin/python analysis/make_figs_boundary.py figures test-results/boundary_policed_20260930.csv test-results/boundary_workconserving_20260930.csv
.venv/bin/python analysis/compare_boundary_reruns.py test-results/boundary_both_20260930.csv test-results/boundary_both_20260915.csv
```

## Changes made for this run (all uncommitted)

- `virtual-ied` submodule `dependencies/libiec61850/hal/socket/linux/socket_linux.c`,
  `UdpSocket_createUsingNamespace`: request `SO_RCVBUF` 8 MiB on every UDP socket, read back and log.
- `virtual-protections-wan/lab-up.sh`: step 0/5 `sysctl -w net.core.rmem_max=16777216`.
- `virtual-protections-wan/qos_sweep.py`: column `rgoose_frames_per_window` (tcpdump at vMU1,
  filter `udp and src host 10.10.30.1 and dst port 102`, spans exactly the measured window, +1 s per
  condition for tcpdump to attach); `--arms` flag for smoke tests (default `off,on`, unchanged order).
- `virtual-protections-wan/analysis/compare_boundary_reruns.py`: this document's tables and checks.
