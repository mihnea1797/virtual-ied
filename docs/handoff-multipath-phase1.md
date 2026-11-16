# Handoff spec: multipath lab, phase 1 (build and accept)

- Date: 2026-11-16
- Owner: Mihnea
- Planning doc: "Closing the SDN line: multipath R-SV lab and test plan" (Claude Doc in the PhD project)
- Suggested location: `docs/handoff-multipath-phase1.md`

## Goal

Build a copy of the EPSR paper's lab with **two separate WAN paths** between the R-SV publishers and the vIED. Then show that **each path on its own reproduces the paper's baseline**.

Phase 1 runs no redundancy tests: no failover, no duplication, no fault campaigns. Those come in phase 2.

## Working mode

- Build it yourself, but explain each step in short, plain bullets as you go. (Owner: change this line if you want guidance only.)
- Stop at every **checkpoint** below and wait for approval.
- Never guess a parameter. If something here is unclear, or conflicts with the existing lab, stop and ask.
- Report only measured results. Never tune the lab to reach a target number without saying so.

## Start here

1. Read the existing paper lab: topology, OVS and router configuration, tc settings, publishers, vIED, the experiment driver and its read-back checks.
2. Write a short summary of how it is built and how a run is driven.
3. **Do not change the paper lab.** Work on a copy (new directory or git branch). The paper lab must stay runnable exactly as published.

**Checkpoint 0:** the summary, plus the plan for the copy.

## Target topology

```
vMU1-vMU3, bg source
        |
      OVS-A  (access switch, EF marking, tunnel ends)
      /    \
   R1a      R1b      (aggregation)
    |        |
   R2a      R2b      (core)
      \    /
      OVS-B  (protection-site switch, tunnel ends)
        |
       vIED  (R-GOOSE trip back to vMU1)
```

- Path A = R1a, R2a. Path B = R1b, R2b. The two paths share no router and no link between OVS-A and OVS-B.
- OVS-B is new: it joins both paths onto one link to the vIED.
- The R-GOOSE trip returns over the same path as the forward R-SV traffic.

## Decisions already made

| Topic | Decision |
|---|---|
| Routing in the core | Fixed (static) routes only. No routing protocol. |
| Tunnels | One VXLAN tunnel per path, between OVS-A and OVS-B. Each switch has one underlay address per path; the static routes pin tunnel A to R1a-R2a and tunnel B to R1b-R2b. |
| EF marking | R-SV is marked DSCP 46 (EF) at OVS-A ingress, as in the paper. The DSCP **must be copied to the VXLAN outer header**, or the routers will treat R-SV as best effort. |
| Failure detection | BFD enabled on each tunnel. Phase 1 only checks that it comes up, and goes down when its own path is cut. |
| Path selection | A per-run setting pins all traffic (R-SV, background, R-GOOSE) to path A or to path B. No OpenFlow groups yet. |
| Router queues and delay | Copy the paper's per-router settings (HTB, EF class, netem 2.5 ms per router per direction) onto all four routers, with the rates scaled as in the next section. Path B's delay is a per-run setting; for acceptance it equals path A's. |
| Link OVS-B to vIED | Not shaped (it stands for the substation LAN). |
| Background source | Attached at OVS-A as in the paper, pinned to the selected path. |
| Publishers and vIED | Unchanged in phase 1. |
| Host | All containers share one host: log host CPU during every run. |

## Tunnel overhead: re-dimension the EF class

Why: VXLAN adds 50 bytes per packet (outer Ethernet 14 + IP 20 + UDP 8 + VXLAN 8). The 198-byte R-SV frame becomes 248 bytes, so three streams grow from 19.0 to 23.8 Mb/s. That is 1.19 times the paper's 20 Mb/s EF rate, and the paper showed the 20 ms reference is already missed at 1.11 times. Left unchanged, the baseline would fail.

Required:

- Scale every WAN shaping rate and ceiling by **1.25** (about 248/198). For example: EF rate 25 Mb/s, aggregate ceiling 37.5 Mb/s, EF ceiling 37.5 Mb/s in the work-conserving configuration. Scale the best-effort class rates the same way. R-SV then sits at about 95% of the EF rate, as in the paper.
- Shape where the encapsulated packets leave (the underlay interfaces), so the shaper counts the tunnel bytes. Keep the paper's queue structure; only the rates change.
- Recompute the background rates so that the paper's load levels (60, 90, 105, 120, 140%) refer to the scaled ceiling, counted at the tunnel layer.
- Check that the largest background frame plus 50 bytes fits the MTU without fragmentation.

**Checkpoint 1:** show all computed rates and the MTU check before configuring anything.

## Read-back (extend the paper's driver)

Before each run, read these from the data plane (not from your own config files) and log them:

- class rates and ceilings on every shaped interface;
- netem delay on every router, per direction, per path;
- which path the run is pinned to;
- both VXLAN tunnels present, and the outer-DSCP copy enabled;
- BFD state of both tunnels;
- ping RTT through the selected path (the paper's single-path baseline was 10.13 ms; a small increase from encapsulation is expected).

**Checkpoint 2:** topology up, plus one full read-back printout.

## Acceptance tests

Phase 1 is done when all of these pass:

1. **Path A alone, EF, work-conserving:** background at 0% and at 140%; one discarded warm-up pass, then 10 repetitions of 30 s (same procedure as the paper). Report the mean, minimum and maximum t_trip, and the number of runs above 20 ms.
2. **Path B alone:** same as test 1, with path B's delay equal to path A's.
3. **Marking survives the tunnel:** a capture on one core link shows R-SV inside VXLAN, with DSCP 46 on the outer header.
4. **BFD sees its own path:** cutting the R1a-R2a link takes tunnel A's BFD down and leaves tunnel B up, and the same the other way round. Observe only; no failover in phase 1.
5. **No EF drops** in the 0% background runs.

Tolerance: if a path's mean t_trip differs from the paper's 18.3 ms by more than 1 ms, stop and report. Do not tune. (The 1 ms threshold is the owner's default; it can be changed.)

**Checkpoint 3:** the acceptance results.

## Outputs

- The new topology and configuration in the copy, with every parameter in one place.
- The extended read-back.
- A short report in `docs/`: what was built, the computed rates, the acceptance results with links to the raw CSV files, and anything that differed from this spec.

## Not in phase 1

- OpenFlow fast-failover and ALL groups.
- Duplicate removal in the vIED.
- Fault injection campaigns.
- An SDN controller.
- Campaigns with a longer path B.
- PRP.
