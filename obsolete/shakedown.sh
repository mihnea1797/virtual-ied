#!/usr/bin/env bash
# =============================================================
# Lab shakedown: R-SV behaviour under WAN contention, QoS off vs on.
# Network-level only (no trip harness needed). At the subscriber it
# measures received R-SV rate, packet loss, and inter-arrival jitter.
# PRECONDITION: your R-SV publisher must be running on vmu1.
# =============================================================
set -u
OVS=clab-vied-lab-ovs-core
SUB=clab-vied-lab-vied
LOAD=clab-vied-lab-load-src
DUR=20                 # seconds measured per condition
BG_RATE=12M            # background load (~150% of the 10 Mbps cap)
SV_PORT=102
EXP_PPS=1937           # expected R-SV packet rate (your capinfos number)

flow_on()  { docker exec $OVS ovs-ofctl add-flow br0 "priority=200,udp,tp_dst=${SV_PORT},actions=set_queue:1,NORMAL" >/dev/null; }
flow_off() { docker exec $OVS ovs-ofctl del-flows br0 "udp,tp_dst=${SV_PORT}" >/dev/null; }
bg_start() { docker exec -d $LOAD iperf3 -c 10.10.30.1 -u -b ${BG_RATE} -t $((DUR+6)) >/dev/null 2>&1; sleep 2; }
bg_stop()  { docker exec $LOAD pkill iperf3 2>/dev/null || true; }

check_live() {
  docker exec $OVS timeout 3 tcpdump -i eth5 -nn "udp port ${SV_PORT}" -c 5 >/dev/null 2>&1 \
    || { echo "[ABORT] no R-SV on the wire — start the publisher on vmu1 first."; exit 1; }
}

measure() {  # $1 = label
  local cap="/tmp/sv_$1.pcap"
  docker exec $SUB sh -c "rm -f $cap; timeout $DUR tcpdump -i eth1 -w $cap 'udp port ${SV_PORT}' 2>/dev/null"
  docker exec $SUB tshark -r $cap -T fields -e frame.time_delta -e frame.len 2>/dev/null | \
  awk -v dur="$DUR" -v eps="$EXP_PPS" '
    {n++; bytes+=$2; if(NR>1 && $1!=""){s+=$1; dn++; if($1>m)m=$1; if($1>0.005)st++}}
    END{ mbps=bytes*8/dur/1e6; epk=eps*dur; loss=(epk-n)/epk*100; if(loss<0)loss=0;
         printf "  recv_pkts=%d  rate=%.2f Mbps  loss=%.1f%%  jitter_mean=%.3fms  jitter_max=%.1fms  stalls>5ms=%d\n",
                n, mbps, loss, (dn?s/dn*1000:0), m*1000, st+0 }'
  docker exec $OVS ovs-ofctl queue-stats br0 2>/dev/null | grep eth5 | sed 's/^/    /'
}

echo "=== Lab shakedown (${DUR}s/condition, background ${BG_RATE}) ==="
check_live
docker exec -d $SUB iperf3 -s >/dev/null 2>&1 || true   # background sink

echo "[1/3] BASELINE  (no background, QoS on)"
flow_on;  measure baseline

echo "[2/3] CONTENTION, QoS OFF"
flow_off; bg_start; measure noqos; bg_stop

echo "[3/3] CONTENTION, QoS ON"
flow_on;  bg_start; measure qos;   bg_stop

echo "=== done.  Resting state: QoS ON. ==="
