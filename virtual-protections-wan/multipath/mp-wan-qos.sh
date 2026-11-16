#!/usr/bin/env bash
# ============================================================
# mp-wan-qos.sh — per-hop DiffServ PHB + propagation delay on the four WAN routers.
#
# The paper's wan-qos.sh, on r1a/r2a (path A) and r1b/r2b (path B), with the rates x1.25:
#
#   forward egress (eth2, toward the vIED):
#     HTB ${CEIL} with two classes:
#       1:20 EF  rate ${EF_RATE}, ceil ${EF_CEIL}   <- u32 filter on DSCP 46 (the OUTER header here)
#       1:10 BE  rate ${BE_ROUTER_RATE}, ceil ${CEIL} (default)
#     + netem <delay> under EACH leaf = this hop's propagation delay
#   reverse egress (eth1, toward site A):
#     plain netem <delay> (no contention there)
#
# The HTB quanta are pinned to the values the kernel had derived in the paper lab (125000 /
# 200000); derived from the scaled rates they would be 156250 / 200000, a different split of spare
# capacity between the classes.
#
# The delay is per path: A_DELAY_MS / B_DELAY_MS from params.env. Setting either in the
# environment overrides it for this call (the driver's --delay-b-ms does that for path B).
#
# Idempotent — safe to re-run. Called by mp-lab-up.sh after mp-ovs.sh.
# ============================================================
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_A="${A_DELAY_MS:-}"; ENV_B="${B_DELAY_MS:-}"
. "$DIR/params.env"
[ -n "$ENV_A" ] && A_DELAY_MS="$ENV_A"
[ -n "$ENV_B" ] && B_DELAY_MS="$ENV_B"

phb() {   # router, delay in ms
  echo "[mp-wan-qos] $1: HTB(${CEIL_KBIT}k, EF ${EF_RATE_KBIT}k/${EF_CEIL_KBIT}k by DSCP 46, BE ${BE_ROUTER_RATE_KBIT}k) + netem ${2}ms per direction"
  docker exec "$PFX-$1" sh -c "
    tc qdisc del dev eth2 root 2>/dev/null || true
    tc qdisc add dev eth2 root handle 1: htb default 10 &&
    tc class add dev eth2 parent 1:  classid 1:1  htb rate ${CEIL_KBIT}kbit ceil ${CEIL_KBIT}kbit &&
    tc class add dev eth2 parent 1:1 classid 1:10 htb rate ${BE_ROUTER_RATE_KBIT}kbit ceil ${CEIL_KBIT}kbit quantum $ROUTER_BE_QUANTUM &&
    tc class add dev eth2 parent 1:1 classid 1:20 htb rate ${EF_RATE_KBIT}kbit ceil ${EF_CEIL_KBIT}kbit quantum $ROUTER_EF_QUANTUM &&
    tc filter add dev eth2 protocol ip parent 1: prio 1 u32 match ip dsfield 0xb8 0xfc flowid 1:20 &&
    tc qdisc add dev eth2 parent 1:10 handle 10: netem delay ${2}ms &&
    tc qdisc add dev eth2 parent 1:20 handle 20: netem delay ${2}ms &&
    tc qdisc replace dev eth1 root netem delay ${2}ms
  " || { echo "[mp-wan-qos] FAILED on $1"; exit 1; }
}
phb r1a "$A_DELAY_MS"; phb r2a "$A_DELAY_MS"
phb r1b "$B_DELAY_MS"; phb r2b "$B_DELAY_MS"

echo "[mp-wan-qos] verify:"
for R in r1a r2a r1b r2b; do
  docker exec "$PFX-$R" sh -c "tc qdisc show dev eth2 | head -3 | sed 's/^/  $R eth2: /'; tc qdisc show dev eth1 | sed 's/^/  $R eth1: /'"
done
