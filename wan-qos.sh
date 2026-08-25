#!/usr/bin/env bash
# ============================================================
# wan-qos.sh — per-hop DiffServ PHB + propagation delay on the WAN routers.
#
# Installs on EACH router hop (router1 = aggregation, router2 = core) an
# IDENTICAL per-hop behavior — that is the point of DiffServ: the edge
# (ovs-core) marks R-SV with DSCP EF(46); every hop then needs only:
#
#   forward egress (eth2, toward vied):
#     HTB 20 Mb/s (same capacity as the access cap) with two classes:
#       1:20 EF  min 13M (covers the ~12M R-SV aggregate)  <- filter DSCP 46
#       1:10 BE  min  7M (default)
#     + netem ${DELAY_MS} under EACH leaf = this hop's propagation delay
#       (netem can't share root with HTB, so it layers under the classes)
#   reverse egress (eth1, toward substation A):
#     plain netem ${DELAY_MS} (symmetric propagation; no contention there)
#
# 2 router hops x 2.5 ms = 5 ms one-way total, comparable to the Week-1
# single-hop 5 ms results. QoS on/off is toggled ONLY via marking at the
# edge: unmarked traffic never matches the EF filter, so with QoS off all
# hops degrade to single-queue best-effort automatically.
#
# Idempotent — safe to re-run. Called by lab-up.sh after ovs-restore.sh.
# ============================================================
set -uo pipefail

DELAY_MS=2.5
ROUTERS="clab-vied-lab-router1 clab-vied-lab-router2"

for R in $ROUTERS; do
  echo "[wan-qos] $R: HTB(20M, EF min 13M by DSCP 46) + netem ${DELAY_MS}ms per direction"
  docker exec "$R" sh -c "
    # forward egress: HTB with EF/BE + per-leaf netem
    tc qdisc del dev eth2 root 2>/dev/null || true
    tc qdisc add dev eth2 root handle 1: htb default 10 &&
    tc class add dev eth2 parent 1:  classid 1:1  htb rate 20mbit ceil 20mbit &&
    tc class add dev eth2 parent 1:1 classid 1:10 htb rate 7mbit  ceil 20mbit &&
    tc class add dev eth2 parent 1:1 classid 1:20 htb rate 13mbit ceil 20mbit &&
    tc filter add dev eth2 protocol ip parent 1: prio 1 u32 match ip dsfield 0xb8 0xfc flowid 1:20 &&
    tc qdisc add dev eth2 parent 1:10 handle 10: netem delay ${DELAY_MS}ms &&
    tc qdisc add dev eth2 parent 1:20 handle 20: netem delay ${DELAY_MS}ms &&
    # reverse egress: symmetric propagation only
    tc qdisc replace dev eth1 root netem delay ${DELAY_MS}ms
  " || { echo "[wan-qos] FAILED on $R"; exit 1; }
done

echo "[wan-qos] verify:"
for R in $ROUTERS; do
  docker exec "$R" sh -c "tc qdisc show dev eth2 | head -3 | sed 's/^/  $R eth2: /'"
done
