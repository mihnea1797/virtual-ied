# vied-lab — lab deployment

Everything needed to bring up the containerlab testbed for the R-SV QoS work.

- `vied-lab.clab.yml`  — topology: vMUs + load-src -> ovs-core (20M cap, DiffServ edge) -> router1 -> router2 -> vied
- `lab-up.sh`          — full bring-up (also run by systemd at boot): modprobe openvswitch, containerlab deploy, ovs-restore, wan-qos, subscriber relink
- `ovs-restore.sh`     — OVS bridge + HTB cap + EF/BE queues + DSCP-EF marking flows
- `wan-qos.sh`         — per-hop DSCP->EF queue + 2.5 ms netem on the WAN routers
- `clab-vied-lab.service` — source of the installed systemd unit (/etc/systemd/system)

This directory lives in the virtual-ied monorepo; `~/virtual-protections-wan` and `~/iec61850-lab` are
symlinks into it, so the installed systemd unit and old habits keep working.
Manual bring-up after any VM restart: `bash ~/lab-up.sh` (systemd does it automatically).

## Testing
- `qos_sweep.py`     — the experiment driver: QoS on/off x background load x repetitions; per-stream rate/loss/jitter/darkness/OWD + t_trip; logs link bw + per-hop netem.
  Two campaigns: `--campaign legacy` (default: offered load 60-140% x QoS, 3 streams) and
  `--campaign boundary` (aggregate R-SV swept across the 20 Mb/s EF guarantee at a saturating
  background, 3 -> 5 MU equivalents, both QoS arms). Every run also records the HTB EF/BE class
  counters (drops, overlimits, backlog) read back from all three hops and the measured iperf3 rate.
  The two extra load streams are publisher processes hosted in vmu2/vmu3 (`config-vmu4/5.json`,
  IP aliases 10.10.40.4/.5, UDP 105/106) — no topology change. `--ef-mode policed` sets the EF
  class ceil to its rate (20 Mbit) on all three hops for the run and restores ceil = 30 Mbit after.
  Boundary campaign as run for the paper (≈70 min each, policed first):
  `.venv/bin/python -u qos_sweep.py --campaign boundary --ef-mode policed` then
  `.venv/bin/python -u qos_sweep.py --campaign boundary --ef-mode work-conserving`;
  post-process with `analysis/stats_table.py <csv> analysis --label boundary-<mode>` and
  `analysis/make_figs_boundary.py figures <policed.csv> <wc.csv>`.
- `test-results/`    — kept reference results (fresh runs write CSVs to the working dir, untracked until promoted here).
  Boundary sweep of 2026-09-15: `boundary_policed_20260915.csv`, `boundary_workconserving_20260915.csv`
  (merged into `boundary_both_20260915.csv`; raw policed parts kept as `raw_boundary_policed_*.csv`, the
  policed run was resumed at repetition 9 after a publisher OOM). Write-up: `analysis/boundary-results.md`.
  Re-run of 2026-09-30 with the fixed vIED (no R-GOOSE storm, publisher restart every repetition, 16 MiB
  UDP receive buffers; two new columns `sub_rcvbuf_drops`, `rgoose_frames_per_window`):
  `boundary_workconserving_20260930.csv`, `boundary_policed_20260930.csv`, merged `boundary_both_20260930.csv`.
  Write-up with per-point comparison against 2026-09-15: `analysis/boundary-results-rerun.md`
  (`analysis/compare_boundary_reruns.py <new_both.csv> <ref_both.csv>`).
- `analysis/`        — post-processing: `stats_table.py` (per-condition mean/std/median/IQR/p5/p95/p99/CoV -> CSV + LaTeX),
  `make_fig5.py` (t_trip CDF), `fill-in-sheet.md` (parameter values with sources), R-SV reference pcap.
  Python deps live in `.venv/` (`python3 -m venv --without-pip .venv`, then get-pip + `pip install numpy matplotlib`).
- `figures/`         — generated figures (PDF + JPG), paper style (constants in `analysis/make_fig5.py`)
