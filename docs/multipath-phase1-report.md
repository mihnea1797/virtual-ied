# Multipath lab, phase 1 — report

- Spec: [`handoff-multipath-phase1.md`](handoff-multipath-phase1.md)
- Lab: [`virtual-protections-wan/multipath/`](../virtual-protections-wan/multipath/README.md), branch `multipath-phase1`
- Raw results: [`virtual-protections-wan/multipath/test-results/`](../virtual-protections-wan/multipath/test-results/)
- Date of all measurements: 2026-11-16

**Status: all five acceptance tests pass**, and each path has a second clean set of trips from a
back-to-back run with the paper lab. One finding is outside those tests: occasional delay spikes
with gaps above 16 ms. They appeared in both labs today and are not specific to the two-path lab;
whether it has a small extra rate of its own is not settled (see "Delay spikes").

## What was built

```
vmu1-3, load-src -> ovs-a ==(path A: r1a - r2a)== ovs-b -> vied
                          ==(path B: r1b - r2b)==
```

- A separate containerlab lab (`vied-mp`) next to the paper lab; no file of the paper lab changed.
- One VXLAN tunnel per path between `ovs-a` and `ovs-b` (VNI 101 and 102), each bound to its
  path's underlay addresses. Static routes only; neither path has a route to the other's subnets.
- R-SV is marked DSCP 46 at `ovs-a` ingress with the paper's flows; `tos=inherit` copies the mark
  to the outer header. The access hop and all four routers classify on the outer DSCP.
- BFD on both tunnels with the OVS defaults (1000 ms in use, multiplier 3).
- A per-run pin (`mp_sweep.py --path a|b`) sends R-SV, background and R-GOOSE through one tunnel
  and drops whatever arrives from the other.
- The driver imports the paper driver, so publishers, vIED and all paper metrics are measured by
  the same code. It reads the data plane back before every run and aborts on any difference from
  `params.env`.

## Computed rates

Every shaping rate and ceiling is the paper's × 1.25 (198 B frames become 248 B in the tunnel).

| Where | Class | Paper (Mb/s) | This lab (Mb/s) |
|---|---|---|---|
| `ovs-a` `eth5` / `eth6` (access hop) | total | 30 / 30 | 37.5 / 37.5 |
| | best effort | 1 / 30 | 1.25 / 37.5 |
| | EF | 20 / 30 | 25 / 37.5 |
| `r1a` `r2a` `r1b` `r2b` `eth2` | total | 30 / 30 | 37.5 / 37.5 |
| | best effort | 10 / 30 | 12.5 / 37.5 |
| | EF | 20 / 30 | 25 / 37.5 |

- Three R-SV streams: 23.81 Mb/s at the tunnel layer = 95.2 % of the EF rate (paper 95.0 %),
  63.5 % of the ceiling (paper 63.4 %).
- Background levels offer the same fraction of the ceiling, at the shaper, as the paper's run
  really did (it ran 94.4 / 108.2 / 125.5 / 146.2 % under the labels 90 / 105 / 120 / 140 %):
  `iperf3 -b` 10770K / 15577K / 21585K / 28794K, 1200 B payload.
- MTU: underlay 9550, host links 9500. The largest background packet is 1278 B in the tunnel.
- Netem 2.5 ms per router per direction on both paths; bursts and HTB quanta as read back from
  the paper lab.

## Acceptance results

| Test | Result | Raw data |
|---|---|---|
| 1. Path A alone | **pass** | `acceptance_pathA_20261116.csv`, `_readback.json`, `.log.txt` |
| 2. Path B alone | **pass** | `acceptance_pathB_20261116.csv`, `_readback.json`, `.log.txt` |
| 3. Marking survives the tunnel | **pass** | `capture_core_r1a-r2a_20261116.pcap`, `.txt` |
| 4. BFD sees its own path | **pass** | `bfd_cut_20261116.csv` |
| 5. No EF drops without background | **pass**: 0 drops in 10 + 10 windows | as tests 1 and 2 |

### Tests 1 and 2 (EF, work-conserving, 1 discarded warm-up pass + 10 × 30 s per condition)

| Path | Condition | n | t_trip mean | min – max | above 20 ms | EF drops |
|---|---|---|---|---|---|---|
| A | no background (63.5 % of the ceiling) | 10 | 18.26 ms | 18.16 – 18.35 | 0 | 0 |
| A | 140 % level (146.2 %) | 10 | 18.27 ms | 18.25 – 18.33 | 0 | 0 |
| B | no background | 10 | 18.24 ms | 18.16 – 18.42 | 0 | 0 |
| B | 140 % level | 10 | 18.31 ms | 18.16 – 18.45 | 0 | 0 |
| paper | no background | 10 | 18.26 ms | 18.17 – 18.39 | 0 | — |
| paper | 140 % level | 10 | 18.27 ms | 18.20 – 18.39 | 0 | — |

All four means are within 0.06 ms of the paper's 18.3 ms (tolerance 1 ms). In all 40 windows:

- 0 samples lost, 0 EF drops on any hop, 0 receive-buffer drops at the vIED, 1 R-GOOSE frame;
- 248.0 B frames in the EF class, and matching packet counts in the EF class of all three hops
  (within 0.2 %, the hops being read one after another);
- 37–40 packets on the unselected path per window (its BFD session and nothing else);
- BFD up on both tunnels at the start and end of every window, no flap, also at the 140 % level;
- the background generator delivered 13.6 Mb/s of the 28.8 Mb/s it offered and no best-effort
  packet was dropped: it is held back at the source, as in the paper lab (11.4 of 24 Mb/s there);
- clock adjustment 0.12–0.38 ms per window, no VM pause;
- host CPU 7–48 % averaged over a window, with single seconds up to 57 %.

Ping RTT with the streams running: 10.14 ms on path B. On path A the run's own reading was
23.29 ms, an average of 10 pings taken once at setup; the same path read 10.15 ms in the two runs
before it. The 20 trip times that followed are not consistent with a path that slow, so this reads
as one or more pings caught by a delay spike (next section), but the single pings were not logged.

### Test 3, marking survives the tunnel

A 5 s capture at `r2a` `eth1` of what arrives from `r1a`, with the three streams running on path A:

- 59 676 R-SV packets inside VXLAN (VNI 101); **all 59 676 have DSCP 46 on the outer header**,
  DSCP 46 on the inner header and a frame length of 248 B.
- 7 other packets in the tunnel in the same 5 s, none with DSCP 46.

### Test 4, BFD sees its own path

Each core link was cut for 12 s with an ingress drop filter on both ends; BFD state was sampled
about four times a second at both switches.

| Cut | Own tunnel | Other tunnel | After removing the cut |
|---|---|---|---|
| `r1a`–`r2a` | `vxa` down at both ends 2.9 s after the cut | `vxb` up in all 48 samples | all sessions up after 1.9 s |
| `r1b`–`r2b` | `vxb` down at both ends 2.5 – 2.7 s after the cut | `vxa` up in all 47 samples | all sessions up after 1.3 s |

Nothing failed over (none is configured). Shapers, netem, tunnels and pin read back unchanged
afterwards. The test ran while the VM clock was 8.3 % fast (next section but one), so the seconds
above are about 8 % shorter than real seconds; the up/down outcome does not depend on that.

## Delay spikes (outside the acceptance tests)

The acceptance tests look at t_trip, drops, marking and BFD. The per-stream gap and delay
columns show something those tests do not cover: now and then a window has a delay spike of
tens of milliseconds, with a burst of reordered samples and gaps above 16 ms. Nothing is lost,
and no t_trip moved, because no spike coincided with a step.

All runs below are EF, 3 streams, 30 s windows, without background and at the 140 % level.

| When | Lab | Windows | Windows with a gap above 16 ms | Worst one-way delay |
|---|---|---|---|---|
| Campaign days (2026-08-29, 2026-09-30) | paper, kept runs | 70 | 0 | 28 ms |
| Today, laptop sleeping at intervals | two-path, the accepted runs | 40 | 4 (10 gaps) | 684 ms (next 83 ms) |
| | paper, partial control | 2 | 1 (4 gaps) | 55 ms |
| Today, laptop kept awake, back to back | paper, full control | 20 | 0 | 15 ms |
| | two-path, path A then path B | 40 | 1 (5 gaps) | 69 ms |

Raw files: `paper_control_20261116_partial.*`, `paper_control_20261116.*`,
`backtoback_pathA_20261116.*`, `backtoback_pathB_20261116.*`.

t_trip in the back-to-back runs: paper 18.24 / 18.26 ms, path A 18.24 / 18.24 ms, path B
18.28 / 18.27 ms (no background / 140 % level), none above 20 ms, no drops, no losses. That gives
each path a second clean set of 20 trips.

What the table supports, and what it does not:

- **The spikes are not specific to the two-path lab.** The unchanged paper lab produced one today
  (in the two windows it got between two laptop sleeps), after none in 70 kept windows.
- **With the laptop awake both labs were nearly clean:** 0 of 20 and 1 of 40. Those two rates
  cannot be told apart (Fisher exact p = 1.0), so no difference between the labs is shown.
- **Keeping the laptop awake looks like it helped** (two-path: 4 of 40 before, 1 of 40 after), but
  that difference is not established either (p = 0.36).
- A small rate of spikes in the two-path lab that the paper lab does not have cannot be ruled
  out with these counts. Settling it needs on the order of a hundred windows per lab, back to back.

Two more observations:

- The kernel printed `htb: too many events!` nine times today, in both labs, and at four of the
  six spike windows. As I read the kernel source (not verified here): each shaper prints it at
  most once in its lifetime, so a missing message means little; and it is printed when the
  shaper's bookkeeping loop, a handful of instructions, is still running two clock ticks (2 ms)
  after it started. If that reading is right, the virtual CPU stopped running for that long.
- `multipath/stall_watch.py` (one process per CPU, noting wake-ups more than 12 ms late) ran
  beside the last path B run (`stall_watch_pathB_20261116.csv`). In 15 minutes it saw 11 late
  wake-ups of 13–26 ms, each on a single CPU, never on all four at once, and that run had no spike
  window. So there was nothing to match a spike against; the watcher is ready for the next time.

For phase 2: outages of a few tens of milliseconds are what failover tests measure. On this
host an occasional one appears with no fault injected, so each fault test needs a no-fault
control of the same length, and the per-window clock and stall records kept.

## The VM pause

The first path A run is kept (`acceptance_pathA_20261116_vm-paused.csv`) but is not the
acceptance result: the VM was paused for about 23.7 minutes in the middle of it.

- Evidence: the time daemon reported the clock wrong by 1422.76 s at 19:42:57 after being in sync
  since boot; an external HTTP `Date` header and the emulated RTC (which follows the host) agreed.
  The kernel logged a display-driver timeout at 19:37:22 (its log starts at today's boot).
- That run: no background 18.31 ms (18.20 – 18.76), 140 % level 18.61 ms (18.12 – 21.46, one trip
  above 20 ms), 0 EF drops. The two windows around the pause carry 110–140 ms stalls and 47 gaps
  above 16 ms. From 19:42:57 the daemon ran the clock 8.3 % fast (83 334 ppm against the raw
  hardware clock, measured); the last four windows, including the 21.46 ms trip, fall wholly or
  partly in that state.
- The owner stepped the clock (`sudo chronyc makestep`) before the two accepted runs.
- **It happened again.** Between about 21:06:48 and 21:07:52, while the labs were being switched
  for the control run, the VM lost another 188.85 s. This time the emulated RTC lost them too, so
  the RTC comparison saw nothing; the run stopped three minutes later, when the daemon began to
  slew the clock inside a window. The two control windows before that were measured on an
  unsynchronised but unslewed clock (0.2 ms adjustment each).
- The driver checks three things. Before a run it aborts if the clock is being slewed, is seconds
  away from the host RTC, or is more than 0.5 s from internet time. Per window it records
  `clock_adj_ms`, `vm_pause_s` and `ntp_step_s` (one SNTP exchange at each end of the window,
  added after the second pause) and stops the run without writing the row if any of them shows a
  slew or a pause.
- It happened a third time at 21:16 (2083 s), caught at once by the internet-time check. The
  owner then stopped the laptop's automatic sleep and restarted the time daemon; the control and
  the back-to-back runs (21:58 – 22:48) had no pause and no clock step.
- Only the host can prevent the pauses: the VM is frozen whenever the laptop sleeps.

## What differs from the spec

| Topic | Spec | As built | Why |
|---|---|---|---|
| Host routes | publishers and vIED unchanged | on-link route to the other site instead of a router gateway | the tunnel joins the sites at Layer 2; binaries and JSON configs are untouched |
| Access-hop shaper | keep the paper's queue structure | same HTB tree, installed with `tc` on the underlay interfaces, EF selected by outer DSCP | an OVS QoS row with `set_queue` cannot sit on a routed interface |
| Underlay MTU | check the fit | 9550 on the underlay, 9500 on host links | so any packet a host can send fits the tunnel |
| Background rates | levels refer to the scaled ceiling | same real fraction of the ceiling as the paper offered (146.2 % for "140 %") | owner's choice at checkpoint 1 |
| Ping RTT | read before each run | read with the streams running | the paper's 10.13 ms was measured that way; an idle lab reads about 11 ms in both labs |
| Read-back | six items | plus MTU, HTB quanta and bursts, and the VM clock | found necessary while building |
| Idle `controller` node, host port 8080 | — | left out | no controller in phase 1; the port would collide with the paper lab at boot |
| Path A | one run | two runs, the first kept but not accepted | the VM pause |
| Paper-lab control | — | `paper_control.py` (one partial run, one full), then both paths again | to place the delay spikes |

## Open

- The delay spikes: a longer back-to-back comparison (about a hundred windows per lab) if a small
  extra rate in the two-path lab has to be ruled out; otherwise a no-fault control beside every
  phase 2 fault test.
- The driver logs one averaged ping at setup; logging the single pings would have explained the
  23.29 ms reading on path A.
- The paper lab's driver has no clock check; a paused VM would go unnoticed there too.
- BFD shares the routers' best-effort class. It did not flap at the 140 % level in 30 windows;
  phase 2 should decide its timers and whether it needs its own class.
