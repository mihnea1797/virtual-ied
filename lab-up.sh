#!/usr/bin/env bash
# ============================================================
# lab-up.sh — full vied-lab recovery after a VM restart.
#
# A host VM reboot restarts the containers but drops everything containerlab and
# OVS set up at deploy time: the openvswitch kernel module, the veth data links,
# the OVS bridge + HTB cap + queues, and the subscriber binary (CMake outputs it
# to /opt, which is in the container's ephemeral layer). This script rebuilds all
# of it, in order. Idempotent — safe to re-run.
#
# Runs as root (systemd unit below, or: sudo ./lab-up.sh).
# ============================================================
set -uo pipefail

# Everything lives next to this script (the virtual-protections-wan repo),
# so the repo can move/rename without breaking paths.
DIR="$(cd "$(dirname "$0")" && pwd)"
TOPO="$DIR/vied-lab.clab.yml"
OVS_RESTORE="$DIR/ovs-restore.sh"
WAN_QOS="$DIR/wan-qos.sh"
SUB=clab-vied-lab-vied
PUB=clab-vied-lab-vmu1

echo "[lab-up] 1/4 openvswitch kernel module"
lsmod | grep -q openvswitch || modprobe openvswitch

echo "[lab-up] 2/4 containerlab deploy (recreate veth links + IP/route exec steps)"
containerlab deploy --reconfigure -t "$TOPO"

echo "[lab-up] 3/5 OVS bridge + 20 Mb/s HTB cap + EF/BE queues + DiffServ edge marking"
bash "$OVS_RESTORE"

echo "[lab-up] 3b/5 WAN per-hop PHB (DSCP->EF queue) + propagation delay on router1/router2"
bash "$WAN_QOS"

echo "[lab-up] 4/5 relink subscriber (redeploy wipes /opt; .o's persist on the bind mount)"
docker exec "$SUB" mkdir -p /opt/virtual-merging-unit
docker exec "$SUB" bash -lc 'cd /root/virtual-merging-unit/build && cmake --build . -j"$(nproc)"' >/dev/null 2>&1 \
  && echo "  subscriber binary: /opt/virtual-merging-unit/merging-unit" \
  || echo "  [WARN] subscriber relink failed — build it manually in $SUB"

echo "[lab-up] verify:"
docker exec "$PUB" sh -c 'ping -c1 -W1 10.10.30.1 >/dev/null 2>&1 && echo "  vmu1 -> vied: OK" || echo "  vmu1 -> vied: FAIL"'
docker exec clab-vied-lab-ovs-core tc qdisc show dev eth5 2>/dev/null | grep -q htb \
  && echo "  HTB cap on eth5: present" || echo "  HTB cap on eth5: MISSING"
echo "[lab-up] done — infrastructure ready (start the sim via sweep.sh / your driver)."
