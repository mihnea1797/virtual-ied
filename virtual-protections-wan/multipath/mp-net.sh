#!/usr/bin/env bash
# ============================================================
# mp-net.sh — addresses, underlay MTU and static routes of the two-path lab (from params.env).
#
#   hosts    : the paper's addresses; an on-link route to the other site (the tunnel joins the two
#              sites at Layer 2, so there is no gateway between them)
#   underlay : one /30 per link, three per path; each switch has one address per path
#   routes   : static only. Path A's nodes get routes to path A's subnets and nothing else, and the
#              same for path B, so a tunnel can only ever travel over its own two routers.
#
# Idempotent (ip ... replace). Called by mp-lab-up.sh after the deploy.
# ============================================================
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/params.env"

dx() { docker exec "$PFX-$1" sh -c "$2" || { echo "[mp-net] FAILED on $1: $2"; exit 1; }; }

echo "[mp-net] hosts: addresses + on-link route to the other site"
dx vmu1     "ip addr replace $VMU1_IP/24 dev eth1 && ip route replace $LAN_B_NET dev eth1"
dx vmu2     "ip addr replace $VMU2_IP/24 dev eth1 && ip route replace $LAN_B_NET dev eth1"
dx vmu3     "ip addr replace $VMU3_IP/24 dev eth1 && ip route replace $LAN_B_NET dev eth1"
dx load-src "ip addr replace $LOAD_IP/24 dev eth1 && ip route replace $LAN_B_NET dev eth1"
dx vied     "ip addr replace $VIED_IP/24 dev eth1 && ip route replace $LAN_A_NET dev eth1"

# One path: $1 = a|b, then the path's values in the order of params.env.
path() {
  local x=$1 net1=$2 ovsa_dev=$3 ovsa_ip=$4 r1_up=$5 net2=$6 r1_dn=$7 r2_up=$8 net3=$9 r2_dn=${10} ovsb_dev=${11} ovsb_ip=${12}
  echo "[mp-net] path $x: ovs-a $ovsa_dev $ovsa_ip -- r1$x -- r2$x -- ovs-b $ovsb_dev $ovsb_ip (MTU $UNDERLAY_MTU)"
  dx ovs-a "ip link set dev $ovsa_dev mtu $UNDERLAY_MTU up && ip addr replace $ovsa_ip/30 dev $ovsa_dev &&
            ip route replace $net3 via $r1_up dev $ovsa_dev"
  dx "r1$x" "sysctl -qw net.ipv4.ip_forward=1 &&
            ip link set dev eth1 mtu $UNDERLAY_MTU up && ip addr replace $r1_up/30 dev eth1 &&
            ip link set dev eth2 mtu $UNDERLAY_MTU up && ip addr replace $r1_dn/30 dev eth2 &&
            ip route replace $net3 via $r2_up dev eth2"
  dx "r2$x" "sysctl -qw net.ipv4.ip_forward=1 &&
            ip link set dev eth1 mtu $UNDERLAY_MTU up && ip addr replace $r2_up/30 dev eth1 &&
            ip link set dev eth2 mtu $UNDERLAY_MTU up && ip addr replace $r2_dn/30 dev eth2 &&
            ip route replace $net1 via $r1_dn dev eth1"
  dx ovs-b "ip link set dev $ovsb_dev mtu $UNDERLAY_MTU up && ip addr replace $ovsb_ip/30 dev $ovsb_dev &&
            ip route replace $net1 via $r2_dn dev $ovsb_dev"
}
path a "$A_NET1" "$A_OVSA_DEV" "$A_OVSA_IP" "$A_R1_UP_IP" "$A_NET2" "$A_R1_DN_IP" "$A_R2_UP_IP" "$A_NET3" "$A_R2_DN_IP" "$A_OVSB_DEV" "$A_OVSB_IP"
path b "$B_NET1" "$B_OVSA_DEV" "$B_OVSA_IP" "$B_R1_UP_IP" "$B_NET2" "$B_R1_DN_IP" "$B_R2_UP_IP" "$B_NET3" "$B_R2_DN_IP" "$B_OVSB_DEV" "$B_OVSB_IP"

echo "[mp-net] verify: each tunnel endpoint reaches its peer over its own path"
docker exec "$PFX-ovs-a" sh -c "ping -c1 -W2 -I $A_OVSA_IP $A_OVSB_IP >/dev/null 2>&1" \
  && echo "  path A underlay $A_OVSA_IP -> $A_OVSB_IP: OK" || echo "  path A underlay: FAIL"
docker exec "$PFX-ovs-a" sh -c "ping -c1 -W2 -I $B_OVSA_IP $B_OVSB_IP >/dev/null 2>&1" \
  && echo "  path B underlay $B_OVSA_IP -> $B_OVSB_IP: OK" || echo "  path B underlay: FAIL"
