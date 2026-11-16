# Multipath lab, phase 1 — report

- Spec: [`handoff-multipath-phase1.md`](handoff-multipath-phase1.md)
- Lab: [`virtual-protections-wan/multipath/`](../virtual-protections-wan/multipath/README.md), branch `multipath-phase1`
- Raw results: [`virtual-protections-wan/multipath/test-results/`](../virtual-protections-wan/multipath/test-results/)
- Date of all measurements: 2026-11-16

**Status: not finished.** Tests 3 and 4 pass. Test 1 (path A) was measured once, in a run that the
VM's own pause disturbed; it is kept as measured and has to be repeated. Test 2 (path B) has not
been run. Both wait for the VM clock to be correct again (see "The VM pause").

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
| 1. Path A alone | measured in a disturbed run, **to be repeated** | `acceptance_pathA_20261116_vm-paused.csv` |
| 2. Path B alone | **not run yet** | — |
| 3. Marking survives the tunnel | **pass** | `capture_core_r1a-r2a_20261116.pcap`, `.txt` |
| 4. BFD sees its own path | **pass** | `bfd_cut_20261116.csv` |
| 5. No EF drops without background | path A: 0 drops in 10 windows; path B pending | as test 1 |

### Test 1, path A (EF, work-conserving, 1 warm-up pass + 10 × 30 s)

| Condition | n | t_trip mean | min – max | above 20 ms | EF drops | paper |
|---|---|---|---|---|---|---|
| no background (63.5 %) | 10 | 18.31 ms | 18.20 – 18.76 | 0 | 0 | 18.26 (18.17 – 18.39), 0 |
| 140 % level (146.2 %) | 10 | 18.61 ms | 18.12 – 21.46 | 1 | 0 | 18.27 (18.20 – 18.39), 0 |

Both means are within the 1 ms tolerance of 18.3 ms. In all 20 windows: 0 samples lost, 0 EF
drops, 0 receive-buffer drops, 1 R-GOOSE frame, 248.0 B frames in the EF class on all three hops,
BFD up on both tunnels with no flap. Ping RTT with the streams running: 10.15 ms (paper 10.13).

This run is not a clean acceptance result, for one reason outside the lab:

- **The VM was paused for about 23.7 minutes during the run**, around 19:37 VM time.
- The two windows around the pause (140 % repetition 4, no-background repetition 5) show stalls
  of 110–140 ms in all three streams and 47 gaps above 16 ms; no other window has any. Their
  t_trip values (18.40 and 18.31 ms) are unaffected because the stall missed the step.
- From 19:42:57 the time daemon ran the clock 8.3 % fast to catch up. The last four windows were
  measured wholly or partly in that state, including the one 21.46 ms trip (140 % repetition 9). Whether the
  clock state caused that trip is not known.
- The seven windows per condition before or between these two effects give 18.32 ms
  (18.20 – 18.76) without background and 18.28 ms (18.12 – 18.47) at the 140 % level, none above
  20 ms. This is a subset chosen after the fact and is not offered as the acceptance result.

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
afterwards. The test ran while the clock was 8.3 % fast, so the seconds above are about 8 % shorter
than real seconds; the up/down outcome does not depend on that.

## The VM pause

- Evidence: the time daemon reported the clock wrong by 1422.76 s at 19:42:57, after being in sync
  since boot; an external HTTP `Date` header and the emulated RTC (which follows the host) agree;
  the kernel logged a display-driver timeout at 19:37:22, the only one in its journal.
- Effect on a run: every timer and rate in the lab (publisher pacing, HTB, netem, t_trip) is timed
  by the VM's clock. While the daemon corrects a large offset, that clock runs 83 334 ppm fast
  against the raw hardware clock (measured), for about 4.6 hours.
- The driver now checks this. Before a run it aborts if the clock is being slewed or is seconds
  away from the host RTC. Per window it records `clock_adj_ms` and `vm_pause_s`, and stops the run
  without writing the row if either shows a slew or a pause.
- To continue: `sudo chronyc makestep` on the VM (or wait for the slew to end), and keep the host
  from pausing the VM during a run.

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

## Open

- Repeat test 1 and run test 2 on a correct clock (about 20 minutes each).
- The paper lab's driver has no clock check; a paused VM would go unnoticed there too.
- BFD shares the routers' best-effort class. It did not flap at the 140 % level in this run; phase 2
  should decide its timers and whether it needs its own class.
