#!/usr/bin/env bash
# ============================================================
# Unattended R-SV QoS contention sweep (network-level metrics).
# Brings up R-SV publisher (vmu1: sv_goose_latency_web) + subscriber
# (vied: /opt/virtual-merging-unit/merging-unit), runs QoS off/on across
# background load levels, logs to timestamped files.
#
# Publisher source jitter is a KNOWN, un-addressed artifact (schedule);
# the summary is baseline-subtracted to keep it out of the comparison.
# ============================================================
set -u
OVS=clab-vied-lab-ovs-core
PUB=clab-vied-lab-vmu1
SUB=clab-vied-lab-vied
LOAD=clab-vied-lab-load-src

DUR=30                          # seconds measured per condition
SV_PORT=102
EXP_PPS=4000
SINK_IP=10.10.30.1              # vied (R-SV destination)
SV_SRC=10.10.40.1               # vmu1 (R-SV source = config.json svLocalIP)
LOADS=("5M" "7M" "10M" "12M")   # background ≈ 79 / 99 / 129 / 149% of the 10M cap
STALL_S=0.005                   # 5 ms
DARK_S=0.016                    # 16 ms network-darkness bound
SV_PPS_MIN=3000                 # guard band: a single correctly-paced publisher emits ~4000 pps
SV_PPS_MAX=5000                 # (= config.json sampleRate). Outside this ⇒ stacking/mis-pacing ⇒ abort.

STAMP=$(date +%Y%m%d_%H%M%S)
LOG="sweep_${STAMP}.log"; CSV="sweep_${STAMP}.csv"
exec > >(tee -a "$LOG") 2>&1
echo "cond,qos,bg_rate,recv_pkts,rate_mbps,loss_pct,jit_mean_ms,jit_max_ms,stalls_5ms,darkness_16ms" > "$CSV"

flow_on()  { docker exec $OVS ovs-ofctl add-flow br0 "priority=200,udp,tp_dst=${SV_PORT},actions=set_queue:1,NORMAL" >/dev/null; }
flow_off() { docker exec $OVS ovs-ofctl del-flows br0 "udp,tp_dst=${SV_PORT}" >/dev/null; }
bg_start() { docker exec -d $LOAD iperf3 -c $SINK_IP -u -b "$1" -t $((DUR+8)) >/dev/null 2>&1; sleep 2; }
bg_stop()  { docker exec $LOAD pkill iperf3 2>/dev/null || true; }
# NB: probe at vied eth1 (a normal veth), NOT ovs eth5 — tcpdump is BLIND to OVS-datapath-
# forwarded traffic on this kernel/OVS build (the frames cross eth5 per the HTB counters, but
# never hit the netdev tap). Directional filter = real R-SV (src vmu1 → dst vied), not reverse rGOOSE.
live()     { docker exec $SUB timeout 4 tcpdump -i eth1 -nn "src ${SV_SRC} and dst ${SINK_IP} and udp port ${SV_PORT}" -c 5 >/dev/null 2>&1; }
wait_live(){ for i in $(seq 1 15); do live && return 0; echo "  ...waiting for R-SV ($i)"; sleep 4; done; return 1; }

# Guard against process stacking: multiple overlapping sv_goose_latency_web instances
# (leftover from prior/aborted runs) multiply the on-wire R-SV rate (e.g. 4 ⇒ ~16k pps,
# ~35 Mbps) and silently invalidate every metric. Verify exactly ONE live binary instance
# emitting ~sampleRate pps at the source before measuring.
pub_live() {  # count live (non-zombie) publisher BINARY instances on vmu1 (exclude the bash wrapper)
  docker exec $PUB sh -c 'ps -eo stat,args | grep "[s]v_goose_latency_web" | grep -v "bash -lc" | grep -vc "^Z"' 2>/dev/null | tr -d '[:space:]'
}
src_pps() {   # measured R-SV pps at the publisher's own egress (eth1), 3 s window
  local n; n=$(docker exec $PUB sh -c "timeout 3 tcpdump -i eth1 -nn 'udp port ${SV_PORT}' 2>/dev/null | wc -l")
  echo $(( n / 3 ))
}
assert_single_publisher() {
  local c pps; c=$(pub_live)
  if [ "$c" != "1" ]; then
    echo "[ABORT] expected exactly 1 live publisher, found ${c:-0} — process stacking inflates R-SV."
    echo "        clean up with:  docker exec $PUB pkill -9 -f sv_goose_latency_web"
    exit 1; fi
  pps=$(src_pps)
  if [ "$pps" -lt "$SV_PPS_MIN" ] || [ "$pps" -gt "$SV_PPS_MAX" ]; then
    echo "[ABORT] publisher source rate ${pps} pps outside [${SV_PPS_MIN},${SV_PPS_MAX}] (expected ~4000)."
    echo "        >${SV_PPS_MAX} ⇒ stacking; <${SV_PPS_MIN} ⇒ publisher not running / mis-paced."
    exit 1; fi
  echo "[setup] publisher guard OK: 1 live instance, ${pps} pps at source."
}

measure() {  # $1=cond  $2=qos  $3=bg
  local cond="$1" qos="$2" bg="$3"
  local cap="/dev/shm/sv_${cond}_${qos}.pcap"   # RAM-backed (64M, bounded): never fills the 30G disk
  if ! live; then echo "  [WARN] stream down before ${cond}/${qos} — logging DEAD, not a pass";
       echo "${cond},${qos},${bg},DEAD,,,,,," >> "$CSV"; return; fi
  docker exec $SUB sh -c "rm -f $cap; timeout $DUR tcpdump -i eth1 -w $cap 'src ${SV_SRC} and dst ${SINK_IP} and udp port ${SV_PORT}' 2>/dev/null"
  read -r recv rate loss jmean jmax st dark < <(
    docker exec $SUB tshark -r $cap -T fields -e frame.time_delta -e frame.len 2>/dev/null | \
    awk -v dur="$DUR" -v eps="$EXP_PPS" -v sth="$STALL_S" -v dth="$DARK_S" '
      {n++; bytes+=$2; if(NR>1 && $1!=""){s+=$1; dn++; if($1>m)m=$1; if($1>sth)st++; if($1>dth)dk++}}
      END{ mbps=bytes*8/dur/1e6; epk=eps*dur; loss=(epk-n)/epk*100; if(loss<0)loss=0;
           printf "%d %.2f %.1f %.3f %.1f %d %d", n, mbps, loss, (dn?s/dn*1000:0), m*1000, st+0, dk+0 }')
  docker exec $SUB rm -f "$cap"   # free RAM immediately; metrics already extracted
  printf "  [%s qos=%s bg=%s] recv=%s rate=%sM loss=%s%% jmean=%sms jmax=%sms stalls>5ms=%s DARK>16ms=%s\n" \
         "$cond" "$qos" "$bg" "$recv" "$rate" "$loss" "$jmean" "$jmax" "$st" "$dark"
  echo "${cond},${qos},${bg},${recv},${rate},${loss},${jmean},${jmax},${st},${dark}" >> "$CSV"
}

# ---- prechecks ----
docker exec $OVS ovs-vsctl list queue 2>/dev/null | grep -q min-rate || {
  echo "[ABORT] OVS queues missing — run ./ovs-restore.sh first."; exit 1; }

# ---- bring up subscriber (vied merging-unit) + R-SV publisher (vmu1) ----
echo "[setup] starting subscriber (merging-unit) on vied ..."
docker exec $SUB pkill -f merging-unit 2>/dev/null || true
# vied process: R-SV subscriber + RMS + GOOSE publisher. Reads the hardcoded
# /root/virtual-merging-unit/config.json; writes output-*.txt to cwd, so run in /tmp.
docker exec -d $SUB bash -lc 'cd /tmp && /opt/virtual-merging-unit/merging-unit >/dev/null 2>&1'
sleep 3
echo "[setup] starting R-SV publisher (sv_goose_latency_web) on vmu1 ..."
docker exec $PUB pkill -f sv_goose_latency_web 2>/dev/null || true
# Publisher serves a web UI on :8080; config.json has autoStart=false and iface=eth1
# (the lab link toward vied). We start it, then POST /start to begin R-SV publishing.
docker exec -d $PUB bash -lc 'cd /home/root/iec61850-lab && ./build/sv_goose_latency_web config.json >/dev/null 2>&1'
sleep 3
echo "[setup] arming R-SV publish via POST /start ..."
for i in $(seq 1 10); do
  # NB: explicit empty body (--data "") — a POST with no Content-Length makes
  # this httplib server block ~4s and return 400.
  docker exec $PUB curl -fs -X POST --data "" http://localhost:8080/start >/dev/null 2>&1 && { echo "  /start OK"; break; }
  echo "  ...web server not ready yet ($i)"; sleep 2
done
echo "[setup] starting iperf3 sink on vied ..."
docker exec -d $SUB iperf3 -s >/dev/null 2>&1 || true
echo "[setup] waiting for R-SV ..."
wait_live || { echo "[ABORT] R-SV never appeared — check your two start commands."; exit 1; }
echo "[setup] R-SV live."
assert_single_publisher

# ---- sweep ----
echo "=== SWEEP start $(date) — ${DUR}s/condition ==="
flow_on; measure baseline on none
for bg in "${LOADS[@]}"; do
  flow_off; bg_start "$bg"; measure "load${bg}" off "$bg"; bg_stop
  flow_on;  bg_start "$bg"; measure "load${bg}" on  "$bg"; bg_stop
done
echo "=== SWEEP done $(date) ==="

# ---- headline summary (baseline-subtracted reading is up to you from the CSV) ----
awk -F, 'NR>1 && $3!="none" && $4!="DEAD"{
  if($2=="off"){doff[$3]=$10;soff[$3]=$9} else {don[$3]=$10;son[$3]=$9}}
  END{print "\n== QoS off -> on  (darkness>16ms | stalls>5ms), per load =="
      for(k in doff) printf "  bg=%-5s  darkness %s -> %s   stalls %s -> %s\n", k, doff[k], don[k], soff[k], son[k]}' "$CSV"

# ---- teardown (leaves pub/sub running; restores QoS ON) ----
bg_stop; docker exec $SUB pkill iperf3 2>/dev/null || true; flow_on
echo "Results: $CSV"
echo "Log:     $LOG"
echo "(publisher/subscriber left running)"
