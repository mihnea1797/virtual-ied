# Multipath lab, phase 1 — report

- Spec: [`handoff-multipath-phase1.md`](handoff-multipath-phase1.md)
- Lab: [`virtual-protections-wan/multipath/`](../virtual-protections-wan/multipath/README.md), branch `multipath-phase1`
- Raw results: [`virtual-protections-wan/multipath/test-results/`](../virtual-protections-wan/multipath/test-results/)
- Date of all measurements: 2026-11-16

**Status: all five acceptance tests pass.** One finding is outside those tests and open: in 4 of
the 40 accepted windows the streams show short delay spikes with gaps above 16 ms, which none of
the paper lab's kept EF runs show. A same-day control on the paper lab showed the same kind of
spike in one of its two valid windows before the VM lost time again and stopped it, so the
spikes look like the host on this day rather than the two-path lab — on thin evidence (see
"Delay spikes").

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

## Delay spikes (open, outside the acceptance tests)

The acceptance tests look at t_trip, drops, marking and BFD. The per-stream gap and delay
columns show something those tests do not cover:

| Runs, EF arm, 3 streams | Windows | Windows with a gap above 16 ms | Worst one-way delay of a sample |
|---|---|---|---|
| Paper lab, kept runs (2026-08-29, 2026-09-30) | 70 | 0 | 28 ms |
| This lab, path A | 20 | 2 (3 gaps) | 61 ms |
| This lab, path B | 20 | 2 (7 gaps) | 684 ms (next worst 83 ms) |

- The spikes last tens of milliseconds, come with a burst of reordered samples, and lose
  nothing. They did not move any t_trip, because none coincided with a step.
- The kernel printed `htb: too many events!` five times today: twice at 19:23:20, as the driver
  moved the pin back from path B to path A after the path B build check, and three times during
  the path B run (20:45:48 inside the first spike window, 20:48:47 at the start of the second,
  20:49:24 four seconds after it). None was logged during the path A runs, which have spikes too.
  The kernel log only goes back to today's boot, so whether the paper lab ever produced that
  message is unknown.
- Why it matters: phase 2 measures outages of exactly this size.

**Same-day control on the paper lab** (`paper_control_20261116_partial.csv`, `_side.csv`,
`.log.txt`). `multipath/paper_control.py` runs the acceptance sequence on the paper lab with the
paper driver's own setup and `run_condition()`. The run stopped itself in its third measured
window, because the VM had lost time again (next section). What it measured before that:

| Paper lab, 2026-11-16 | t_trip | Gaps above 16 ms | Worst one-way delay | Reordered samples |
|---|---|---|---|---|
| no background, repetition 1 | 18.21 ms | 0 | 9 ms | 8 |
| 140 % level (24M), repetition 1 | 18.32 ms | 4 | 55 ms | 165 |

- One of the paper lab's two valid windows has the same kind of spike, and the kernel printed
  `htb: too many events!` at the start of that window (21:10:38).
- So the spikes are not specific to the two-path lab: the unchanged paper lab, which had none in
  70 kept windows on its campaign days, produced one within two windows today.
- This is two windows, not a campaign. It makes "the host on this day" the likely cause and
  "the two-path lab" unlikely as the only cause; it does not measure how often either lab spikes.
- The same host paused the whole VM twice today. Shorter stalls of the same kind (tens of
  milliseconds) would look exactly like these spikes from inside, and nothing inside the VM can
  tell them apart from a busy kernel. That is a hypothesis, not a measurement.
- Next: repeat the control in full once the host leaves the VM alone, on both labs back to back.

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
- Only the host can prevent the pauses.

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
| Paper-lab control | — | `paper_control.py`, partial run | to place the delay spikes |

## Open

- The delay spikes: repeat the paper-lab control in full, back to back with the two-path lab, once
  the host no longer pauses the VM.
- The driver logs one averaged ping at setup; logging the single pings would have explained the
  23.29 ms reading on path A.
- The paper lab's driver has no clock check; a paused VM would go unnoticed there too.
- BFD shares the routers' best-effort class. It did not flap at the 140 % level in 30 windows;
  phase 2 should decide its timers and whether it needs its own class.
