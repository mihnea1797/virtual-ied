# Fill-in sheet — [TBD] values for Table I and the parameters table

Campaign: `qos_sweep_20260829_093156.csv` (3 R-SV streams, 10 reps × 30 s, warm-up discarded).
Every value below is read from the repo, the lab configuration, the CSV or a pcap; the source
is given next to each. Items that cannot be determined are marked **NOT DETERMINABLE**.

Companion outputs: `analysis/stats_table1.csv` (all statistics, long form),
`analysis/table_table1.tex` (LaTeX rows in the paper's column order),
`figures/fig5-trip-cdf.{pdf,jpg}`.

---

## 1. Interface MTU on the bottleneck path

| Interface | MTU (B) |
|---|---|
| vmu1/vmu2/vmu3 eth1, load-src eth1 (substation A hosts) | 9500 |
| ovs-core eth1–eth5 and br0 (access switch; eth5 = capped uplink) | 9500 |
| router1 eth1/eth2, router2 eth1/eth2 (aggregation, core) | 9500 |
| vied eth1 (subscriber) | 9500 |
| every container's management eth0 (not on the data path) | 1500 |

Source: `ip -o link show` inside each container on 2026-09-15. The containers were recreated
from the unchanged `vied-lab.clab.yml` (no `mtu:` key → containerlab default of 9500 B on veth
links), so this is the MTU in force during the Aug-29 campaign as well; it was not logged at the
time. No flow is anywhere near it: the largest packet on the path is the 1242 B iperf3 datagram
(and 198 B for R-SV), so there is no fragmentation in either arm.

## 2. R-SV packet size (application payload and on-wire)

Source: `analysis/rsv_vmu2_400pkts.pcap` — 400 consecutive frames captured at vmu2 eth1 on
2026-09-15 with the campaign's `config-vmu2.json` (4 channels, RefrTm enabled, AES-128-GCM,
no signature). All 400 frames are 198 B; the layering was decoded from the hex dump against
`libiec61850/src/r_session/r_session.c` (SPDU encoder, protocol version 2).

| Layer | Bytes | Notes |
|---|---:|---|
| IEC 61850-9-2 SV APDU (savPdu, 1 ASDU: svID `sv2`, datSet `dataset2`, smpCnt, confRev, RefrTm, smpSynch, 4 × (FLOAT32 + Quality) = 32 B sample data, 1 UTC timestamp) | **89** | application payload proper |
| + 90-5 payload-element header (payload type, simulation, APPID, APDU length: 6 B) | 95 | R-session "user payload" (encrypted part) |
| + R-session header 43 B (CLTP 2, SI 1 = 0xA2, header len 1, common-header tag/len 2, SPDU length 4, SPDU number 4, version 2, TimeOfCurrentKey 4, TimeToNextKey 2, KeyID 4, IV length 1 + IV 12, payload length 4) + GCM tag block 18 B (0x85 0x10 + 16 B tag) | **156** | = UDP payload (`UDP, length 156`) |
| + UDP 8 | 164 | |
| + IPv4 20 (TOS 0x00 at the source; the OVS edge remarks to 0xB8 = DSCP 46 in the EF arm) | **184** | IP datagram (`length 184`) |
| + Ethernet 14 (no FCS/preamble on veth) | **198** | on-wire frame; what `tc`/HTB counts (`linklayer ethernet`, overhead 0) |

Per-stream rate at 4000 sa/s (source rate measured 4000.0 pps: 39 625 frames in 9.906 s):

| Accounting | per stream (Mb/s) | 3 streams (Mb/s) | vs 20 Mb/s EF guarantee | vs 30 Mb/s ceiling |
|---|---:|---:|---:|---:|
| UDP payload (156 B) | 4.992 | 14.98 | 0.75 | 50 % |
| IP (184 B) | 5.888 | 17.66 | 0.88 | 59 % |
| **Layer 2 (198 B) — the HTB shaper's view** | **6.336** | **19.01** | **0.95** | **63 %** |

The paper's "≈6 Mb/s per stream / ≈18 Mb/s aggregate" is the IP-level figure. At the
shaper (L2) the three streams already sit at **95 % of the EF guarantee**, not 90 %. This
matters for Task B (see §7) and should be stated explicitly in the parameters table
(suggest: "6.3 Mb/s per stream at Layer 2, 19.0 Mb/s aggregate").

## 3. iperf3 background — exact invocation

Source: `qos_sweep.py` (commit 70549a2, the driver that produced the CSV), lines 136 and 140.

```
# sink, in vied (iperf 3.18):
iperf3 -s -p 5201
# source, in load-src (iperf 3.19.1), per condition, rate ∈ {9M, 13M, 18M, 24M}:
iperf3 -c 10.10.30.1 -p 5201 -u -b <rate> -l 1200 -t 45
```

- UDP: yes (`-u`).
- Constant bit rate: yes — iperf3's UDP sender paces to the `-b` target with its default
  1 ms pacing timer (`--pacing-timer 1000`; no `--fq-rate`), i.e. constant rate at 1 ms
  granularity. The driver checks the client is alive 2 s after launch and aborts otherwise.
- Datagram: `-l 1200` → 1200 B UDP payload = 1228 B IP = 1242 B on the wire; packet rates
  937.5 / 1354 / 1875 / 2500 pkt/s for 9 / 13 / 18 / 24 Mb/s.
- `-t 45` (= DUR + 15) outlives the 30 s window; the driver kills the client after the window.
- **`-b` is an application-payload rate.** On the wire it is × 1242/1200 = 1.035:
  9.31 / 13.46 / 18.63 / 24.84 Mb/s.

## 4. Were the 90/105/120/140 % loads computed at payload or wire rate?

Neither consistently. The nominal figures in the driver comment and in the paper are
(≈18 + background `-b`)/30 with R-SV taken as "≈18 Mb/s" (≈ IP level) and background at
iperf3 payload rate: (18+9)/30 = 90 %, (18+13)/30 = 103 % (quoted as 105 %),
(18+18)/30 = 120 %, (18+24)/30 = 140 %.

Recomputed consistently at Layer 2 (what the 30 Mb/s HTB ceiling actually meters):

| Condition | R-SV L2 (Mb/s) | bg `-b` (Mb/s) | bg L2 (Mb/s) | total L2 (Mb/s) | **offered load, L2** | nominal in paper |
|---|---:|---:|---:|---:|---:|---:|
| baseline | 19.01 | 0 | 0 | 19.01 | **63 %** | 60 % |
| load9M | 19.01 | 9 | 9.31 | 28.32 | **94 %** | 90 % |
| load13M | 19.01 | 13 | 13.46 | 32.46 | **108 %** | 105 % |
| load18M | 19.01 | 18 | 18.63 | 37.64 | **125 %** | 120 % |
| load24M | 19.01 | 24 | 24.84 | 43.85 | **146 %** | 140 % |

Recommendation for the paper: keep the nominal labels but add one sentence: "loads are quoted
at IP/payload level; at Layer 2, which the shaper meters, they are 63/94/108/125/146 %".
The qualitative picture is unchanged (90 % → 94 % is still below capacity; all others above).

## 5. Measured aggregate R-SV rate and measured background per condition

**The CSV has no `rate_mbps` column.** That column existed only in the superseded
`obsolete/sweep.sh` output (`test-results/sweep_20260614_112946.csv`, tcpdump byte count at
the subscriber). The campaign CSV records per-stream `rate_sas` = samples/s *delivered* at the
subscriber after decryption. Converting with the 198 B frame gives the delivered aggregate:

| Condition | QoS | delivered sa/s (Σ 3 streams, mean of 10 reps) | delivered aggregate, UDP / IP / L2 (Mb/s) |
|---|---|---:|---|
| baseline 60 % | EF | 12000 | 14.98 / 17.66 / 19.01 |
| 90 % | BE | 12000 | 14.98 / 17.66 / 19.01 |
| 90 % | EF | 12000 | 14.98 / 17.66 / 19.01 |
| 105 % | BE | 10441 | 13.03 / 15.37 / 16.54 |
| 105 % | EF | 12000 | 14.98 / 17.66 / 19.01 |
| 120 % | BE | 10905 | 13.61 / 16.05 / 17.27 |
| 120 % | EF | 12000 | 14.98 / 17.66 / 19.01 |
| 140 % | BE | 11720 | 14.63 / 17.25 / 18.57 |
| 140 % | EF | 12000 | 14.98 / 17.66 / 19.01 |

(Under best-effort above capacity the *offered* rate at the source is also reduced by
back-pressure — the paper's "delayed at the source" mechanism — so delivered ≈ offered there.)

**Measured background rates: NOT DETERMINABLE for this campaign.** The driver only verified
that iperf3 was running; its report went to `/tmp/iperf_bg.log` inside load-src, was
overwritten every run and the container has since been recreated. The Task B driver now
records `bg_mbps_measured` (iperf3 JSON end summary, sender side) and `bg_loss_pct` for every
condition, so the new campaign will have this column.

## 6. Overvoltage pickup and step amplitudes used in THIS campaign

Publisher side — `iec61850-lab/config.json`, `config-vmu2.json`, `config-vmu3.json`
(identical values; `amp1/amp2/stepTime/threshold` lines unchanged since commit edefb7c of
2026-05-10, `config-vmu3.json` created in commit 9759adc at 2026-08-29 09:31:44, one minute
before the campaign started at 09:31:56; working tree clean):

| Parameter | Value | Meaning (`main.cpp`) |
|---|---|---|
| `amp1` | **210.0** | pre-step amplitude, V RMS: samples = amp × √2 × sin(2π·50·t), 4 identical channels, FLOAT32 |
| `amp2` | **250.0** | post-step amplitude, V RMS (+19 %) |
| `stepTime` | 10.0 s | step applied 10 s after POST /start on every publisher (falls ≈6 s into the 30 s window: SETTLE_S = 4 s) |
| `threshold` | 230.0 | publisher-side only: timestamps the first instantaneous sample > 230·√2 for the harness log; **not** the relay pickup |
| `sampleRate` | 4000 | 80 samples/cycle at 50 Hz |
| `freq` | 50.0 Hz | |

vIED side — `virtual-ied/config.json` (commit 6e703a0, 2026-08-29 09:31:46), all three streams:

| Parameter | Value | Meaning (`SampledValuesSubscriberWrapper.cpp`, `RmsComputationObject.cpp`) |
|---|---|---|
| `threshold` | **230** | pickup, V RMS per phase: trip state = any phase RMS **> 230** |
| `samplesPerPeriod` | 80 | sliding RMS window = 80 samples = one 50 Hz cycle at 4000 sa/s |
| `scalingConstant` | 1000 | samples scaled ×1000 to int32 before RMS |
| filter `order` | 0 | Butterworth of order 0 = pass-through (cutoff 200 Hz unused) |
| `numberOfPhases` / format | 4 / `voltageFirst`,`single` → voltage-only element | 4 voltage channels, no current element |
| GOOSE | state-change debounced; first R-GOOSE after the step defines t_trip at vMU1 (`10.10.40.1:102`) |

So the campaign injects a **210 → 250 V RMS step** (peak 297 → 354 V) against a **230 V RMS
pickup** (1.095 × pre-step, 0.92 × post-step), with a one-cycle RMS window; t_trip therefore
contains ≈ one cycle of RMS build-up (the paper's "≈8 ms detection + processing").

## 7. Other parameters read back from the data plane (for the parameters table)

Source: `tc -d -s class show`, `tc qdisc show`, `ovs-vsctl list queue/qos`, CSV globals.

| Parameter | Value | Where |
|---|---|---|
| Bottleneck ceiling | 30 Mbit HTB root, `linklayer ethernet` | OVS eth5 (`link_bw_mbps = 30.0` in CSV) and root class 1:1 on router1/router2 eth2 |
| EF class | rate **20 Mbit**, ceil 30 Mbit, quantum 200 000 B | OVS q1 → class 1:2; routers class 1:20 (`u32 match ip dsfield 0xb8 0xfc`) |
| BE class | OVS: rate 1 Mbit, ceil 30 Mbit, quantum 12 500 B; routers: rate 10 Mbit, ceil 30 Mbit, quantum 125 000 B (default class) | OVS q0 → 1:1; routers 1:10 |
| Propagation | netem 2.5 ms per router per direction (`limit 1000` packets under each HTB leaf) = 5 ms one-way | router1/router2 eth2 (fwd) and eth1 (rev); CSV `netem_hops = 2.5+2.5` |
| Ping RTT baseline | 10.132 ms (vmu1 → vied, idle) | CSV `ping_rtt_ms` |
| R-session security | AES-128-GCM, no signature (`R_SESSION_SIG_ALGO_NONE`), 2 keys rotated every 5 s, protocol version 2 | `main.cpp`, pcap |
| Streams | 3 × 4000 sa/s, one R-session per stream on UDP 102/103/104, APPID 0x4000–0x4002 | configs, CSV `appid` |

Note for Task B: the EF class is **work-conserving** (ceil 30 Mbit, quantum 16:1 over BE at the
OVS). Its 20 Mbit "guarantee" is a floor, not a cap: with both classes saturated the OVS EF
class can take ≈ 20 + 9·200000/212500 ≈ 28.5 Mb/s, and the routers' EF class can borrow
whatever the (already trimmed) best-effort share leaves. The boundary sweep will therefore
locate the drop onset empirically; it should not be assumed to be at 20 Mb/s.
