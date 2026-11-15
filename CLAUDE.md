# CLAUDE.md

Testbed for routable IEC 61850 protection traffic (R-SV in, R-GOOSE trip out) over a
QoS-managed 3-hop WAN, built for the EnergyCon 2026 paper (the paper itself lives in a
separate Overleaf repo, `~/6a2ebbb7d7922f199cab72a6`, and is not part of this tree).

## Layout

This repo is the virtual IED. On 2026-10-31 two other repos were merged in with their
history (`git subtree add`); before that the work spanned three repos.

| Path | Role | Runs in |
|---|---|---|
| `/` (`merging-unit/`, `CMakeLists.txt`, `config.json`) | **vIED**: R-SV subscriber, one receiver thread per stream, per-phase RMS, ORs the per-stream threshold states and sends one R-GOOSE trip to vMU1 on a change | `clab-vied-lab-vied`, binary at `/opt/virtual-merging-unit/merging-unit` |
| `iec61850-lab/` (was repo `iec61850-lab`) | **vMU publisher**: R-SV source with an amplitude step (210 -> 250 at 10 s after `/start`), HTTP control (`/start`, `/stop`, `/configure`), receives the R-GOOSE and logs t_trip | `clab-vied-lab-vmu1..3`, one process per stream |
| `virtual-protections-wan/` (was repo `virtual-protections-wan`) | **Lab control**: containerlab topology, OVS/WAN QoS scripts, `lab-up.sh` + systemd unit, experiment driver `qos_sweep.py`, analysis, results, figures | host |
| `patches/` | The two local libiec61850 commits as `git am` patches (neither is upstream) | |

Both components pin their own `libiec61850` submodule: `dependencies/` at `b56dde4f`
(upstream 69977efe + 8 MiB `SO_RCVBUF`), `iec61850-lab/dependencies/` at `3f2adc4`
(upstream v1.6 + debug hex-dump fix). A fresh `git submodule update` cannot fetch these
commits; re-apply them from `patches/`.

## Operating the lab

- Bring-up: `sudo virtual-protections-wan/lab-up.sh` (also run at boot by
  `clab-vied-lab.service`). It sets `net.core.rmem_max=16777216`, deploys containerlab,
  installs OVS cap/queues/marking and the router PHB, and relinks the vIED.
- `~/iec61850-lab` and `~/virtual-protections-wan` are symlinks into this tree; the topology
  bind-mounts `iec61850-lab/` into the vMU containers and the repo root into the vIED.
- No passwordless sudo on the VM. Root-only actions (global sysctls, moving root-owned
  `build/` dirs) go through a privileged container, e.g.
  `docker run --rm --privileged --net=host --entrypoint sh wbitt/network-multitool:latest -c '...'`.
- Rebuild the vIED: `docker exec clab-vied-lab-vied bash -lc 'cd /root/virtual-merging-unit/build && cmake --build . -j4'`.
- Driver: run from `virtual-protections-wan/` with `.venv/bin/python -u qos_sweep.py ...`.
  Raw output `qos_sweep_<stamp>.csv` lands there (ignored); promote kept runs to
  `test-results/` with dated names. Self-tests (no lab needed): `.venv/bin/python tests/test_htb_parse.py`
  and `.venv/bin/python tests/test_driver_checks.py`. vIED unit test (smpCnt loss/reordering
  accounting): `docker exec clab-vied-lab-vied bash -lc 'cd /root/virtual-merging-unit/build && cmake --build . --target smpcnt-tracker-test && ctest --output-on-failure'`.
- The driver aborts instead of writing bad rows when the vIED stops writing stats (10 s), when a
  QoS arm does not read back from OVS, or when vMU1 opens no new `loggerOutput/` CSV on `/start`.
  On every exit (normal, abort, Ctrl-C, `kill`) it stops iperf3 and restores marking and EF mode.

## Testbed

vMU1-3 (protection streams, 4000 sa/s, 198 B frames = 6.34 Mb/s each at L2) and two
load-only streams vMU4/vMU5 (extra processes in vmu2/vmu3, never step) -> OVS access
switch (30 Mb/s HTB, DSCP-EF marking at the edge, EF class 20 Mb/s guarantee) -> router1
-> router2 (same PHB, 2.5 ms netem each, 5 ms one way) -> vIED. Background: iperf3 UDP
from `load-src`. t_trip = vMU1 step -> first R-GOOSE back at vMU1; floor 18.2 ms on the
empty network, budget 20 ms.

## Testing done so far (three-repo era)

**Paper baseline (2026-08-29, `test-results/qos_sweep_20260829_093156.csv`).** 3 streams,
QoS on/off x background 9/13/18/24 Mb/s (offered 90-140 % of the ceiling), 10 x 30 s.
DiffServ EF held t_trip at ~18.3 ms with no >16 ms gaps at every load; best-effort lost
the budget (t_trip ~50-64 ms at 120 % load, Fig. 5 CDF).

**Admission-control boundary sweep, Task B (2026-09-15).** Aggregate R-SV stepped across
the EF rate: 0.95 / 1.11 / 1.27 / 1.43 / 1.58 x 20 Mb/s (3 to 5 MU equivalents), 24 Mb/s
background, both QoS arms, two EF modes (`work-conserving` = ceil 30, the paper's setup;
`policed` = ceil 20 on all hops, called "rate-capped" in the paper). Carried three defects,
disclosed as caveats: an R-GOOSE storm (vIED debounced the last stream instead of OR-ing,
80k-260k frames per window), a publisher memory leak (vMU3 OOM, run resumed), and vIED UDP
receive-buffer overflow (~107k drops). Write-up: `virtual-protections-wan/analysis/boundary-results.md`.

**Re-run with the fixed vIED (2026-09-30).** Same ladder and settings after the OR fix,
publisher restart at every repetition, and 16 MiB receive buffers; two new columns
`sub_rcvbuf_drops` and `rgoose_frames_per_window`. All three checks passed: storm absent
(1 frame per window up to 1.43), no restart failures, 0 receive-buffer drops in 840 rows.
Files: `test-results/boundary_{workconserving,policed,both}_20260930.csv`, write-up
`analysis/boundary-results-rerun.md`, figures `figures/fig6a/6b`.

| ratio | EF work-conserving t_trip | EF rate-capped t_trip | best-effort t_trip |
|---|---|---|---|
| 0.95 | 18.3 ± 0.1 ms | 18.3 ± 0.1 ms | 61 ± 10 ms |
| 1.11 | 22.8 ± 2.1 ms | 49.8 ± 0.3 ms | 64 ± 12 ms |
| 1.27 | 24.2 ± 2.0 ms | 54.2 ± 0.4 ms | 59 ± 7 ms |
| 1.43 | 38.7 ± 1.6 ms | 61.1 ± 0.5 ms | 65 ± 13 ms |
| 1.58 | 60.4 ± 9.2 ms | 64.1 ± 0.5 ms | 85 ± 17 ms |

Conclusion: the boundary is the EF rate in both modes and it is a delay boundary; one
half-MU above it the 20 ms budget is lost. No EF drops below the link ceiling (one
rate-capped repetition at 1.58 is the exception). Versus 2026-09-15, work-conserving EF is
8-24 ms faster with far smaller spread (the old numbers were inflated by the defects);
rate-capped and best-effort are unchanged.

A smoke test after the merge (2026-10-31, rsv4.5 EF work-conserving, one window) passed:
1 R-GOOSE frame, 0 receive-buffer drops, 5/5 publishers alive.

## Known caveats

- **t_trip attribution.** The vIED cannot tell which stream raised the trip; vMU1-3 all
  step, and vMU1 wins because the driver re-arms it ~25 ms before vMU2/vMU3. Consistent
  with all data (no t_trip below the floor) but argued, not measured. Option: set
  `amp2 = 210` in `iec61850-lab/config-vmu2.json` and `config-vmu3.json` so only vMU1 steps.
- **`lost` changed meaning on 2026-11-15.** CSVs up to 2026-10-31 (no `reordered` column) count
  every late sample twice in `lost`, plus one phantom loss per smpCnt wrap (16.4 s per stream).
  From then on `lost` is only what never arrived and late samples are in `reordered`. Same day,
  ratio 0.95 EF: old counter 561-730 "lost" per stream and window, new counter 0 lost, 441-469 reordered.
- Ratios use L2 accounting (198 B frames); at IP level the ladder reads 0.88..1.47.
- `bg_loss_pct` is NA by design (iperf3 is interrupted at window end).
- Nothing has been pushed since the merge; the old GitHub repos `iec61850-lab` and
  `virtual-protection-wan` still exist and should be archived after the first push.
