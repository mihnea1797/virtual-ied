# vied-mp — the paper lab with two WAN paths (phase 1)

A copy of the paper lab (`../vied-lab.clab.yml`) in which the publishers and the vIED are joined
by two disjoint WAN paths. Spec: `docs/handoff-multipath-phase1.md`. The paper lab's files are not
touched by anything here; only one of the two labs can be deployed at a time.

```
vmu1-3, load-src -> ovs-a ==(path A: r1a - r2a)== ovs-b -> vied
                          ==(path B: r1b - r2b)==
```

- One VXLAN tunnel per path between `ovs-a` and `ovs-b` (`vxa`, `vxb`), BFD on both.
- R-SV is marked DSCP 46 at `ovs-a` ingress as in the paper; `tos=inherit` copies it to the
  outer header, and every hop classifies on that.
- A per-run pin sends R-SV, background and R-GOOSE through one tunnel. No failover, no groups.
- Every shaping rate and ceiling is the paper's x 1.25 (tunnel overhead: 198 B -> 248 B frames).

| File | Role |
|---|---|
| `params.env` | every parameter: addresses, VNIs, rates, quanta, delays, background levels |
| `vied-mp.clab.yml` | wiring only (nodes, images, links) |
| `mp-lab-up.sh` | bring-up: deploy, then the four scripts below, then relink the vIED |
| `mp-net.sh` | addresses, underlay MTU, static routes |
| `mp-ovs.sh` | both switches: tunnels + BFD, marking, default pin, access-hop shaper |
| `mp-path.sh a\|b` | pin all site-to-site traffic to one path |
| `mp-wan-qos.sh` | the four routers: EF/best-effort classes + netem per direction |
| `mp_sweep.py` | driver: the paper driver's measurement code + path pin + extended read-back |
| `mp_accept_checks.py` | acceptance tests 3 and 4: `capture` (outer DSCP on the core link), `bfd-cut` (BFD while a core link is cut) |
| `paper_control.py` | the acceptance sequence on the PAPER lab, with the paper driver's own code: a same-day control |
| `stall_watch.py` | notes every moment a CPU of the VM stops running for more than 12 ms; light enough to run beside a measurement |
| `tests/test_mp_checks.py` | self-check of the read-back parsers (no lab needed) |
| `test-results/` | kept results; fresh runs write `mp_sweep_<stamp>_path<x>.csv` here, untracked |

## Operating

```
multipath/mp-lab-up.sh --replace-paper-lab        # takes the paper lab's deployment down first
.venv/bin/python -u multipath/mp_sweep.py --path a --readback-only
.venv/bin/python -u multipath/mp_sweep.py --path a      # acceptance: no background + 140 %, 10 x 30 s
.venv/bin/python multipath/tests/test_mp_checks.py
```

(all from `virtual-protections-wan/`). The driver aborts if anything it reads from the data plane
differs from `params.env` or from the requested path, and restores marking, the default pin and
path B's delay on every exit. It also aborts when the VM's clock is being slewed or the VM was
paused during a window (`chronyc tracking`; fix with `sudo chronyc makestep`).

Back to the paper lab: `containerlab destroy -t multipath/vied-mp.clab.yml`, then `./lab-up.sh`
(or reboot: the systemd unit redeploys the paper lab, and this lab's containers come back without
links until `mp-lab-up.sh` is run again).
