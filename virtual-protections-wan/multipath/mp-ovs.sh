#!/usr/bin/env bash
# ============================================================
# mp-ovs.sh — the two switches of the two-path lab: bridge, tunnels + BFD, EF marking,
# default path pin, and the access-hop shaper. Everything comes from params.env.
#
# Differences from the paper's ovs-restore.sh, all forced by the tunnels:
#   - The bridge is created fail-mode=secure: a fresh OVS bridge switches with NORMAL, and two
#     tunnels between two such bridges are a loop. In secure mode nothing is forwarded until the
#     flows below are installed.
#   - Marking flows (table 0, ovs-a only) are the paper's — same ports, DSCP 46 for R-SV, DSCP 0
#     for all other IP — but end in goto_table:1 (the path pin, mp-path.sh) instead of NORMAL.
#   - tos=inherit on the tunnel ports copies the (re)marked DSCP to the outer header, so every
#     hop can classify the encapsulated packet.
#   - The access-hop shaper is the paper's HTB tree (same class ids, bursts and quanta as OVS
#     generated on ovs-core:eth5, rates x1.25), but installed with tc on the two UNDERLAY
#     interfaces, where the encapsulated packets leave and the tunnel bytes are counted. An OVS
#     QoS row cannot sit there (they are routed interfaces, not bridge ports), so EF is selected
#     by the outer DSCP with the same u32 filter as on the routers, not by set_queue.
#
# Idempotent — safe to re-run. Called by mp-lab-up.sh after mp-net.sh.
# ============================================================
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/params.env"

fail() { echo "[mp-ovs] FAILED: $*"; exit 1; }

for SW in ovs-a ovs-b; do
  echo "[mp-ovs] $SW: OVS daemons + bridge br0 (fail-mode secure)"
  docker exec "$PFX-$SW" bash -c '
    mkdir -p /var/run/openvswitch /etc/openvswitch /var/log/openvswitch
    [ -f /etc/openvswitch/conf.db ] || ovsdb-tool create /etc/openvswitch/conf.db /usr/share/openvswitch/vswitch.ovsschema
    pidof ovsdb-server >/dev/null || ovsdb-server --remote=punix:/var/run/openvswitch/db.sock --remote=db:Open_vSwitch,Open_vSwitch,manager_options --pidfile --detach --log-file
    ovs-vsctl --no-wait init
    pidof ovs-vswitchd >/dev/null || ovs-vswitchd --pidfile --detach --log-file
    ovs-vsctl --may-exist add-br br0 -- set-fail-mode br0 secure
  ' || fail "$SW daemons/bridge"
done

# LAN ports: OpenFlow port number = interface number.
docker exec "$PFX-ovs-a" bash -c '
  for i in 1 2 3 4; do ip link set eth$i up; ovs-vsctl --may-exist add-port br0 eth$i -- set interface eth$i ofport_request=$i; done
' || fail "ovs-a LAN ports"
docker exec "$PFX-ovs-b" bash -c "
  ip link set $OVSB_LAN_DEV up; ovs-vsctl --may-exist add-port br0 $OVSB_LAN_DEV -- set interface $OVSB_LAN_DEV ofport_request=3
" || fail "ovs-b LAN port"

# One VXLAN port per path on each switch, bound to that path's underlay addresses.
tunnel() {   # switch, port name, OpenFlow port, VNI, local underlay address, remote underlay address
  docker exec "$PFX-$1" ovs-vsctl --may-exist add-port br0 "$2" -- set interface "$2" type=vxlan \
      ofport_request="$3" options:key="$4" options:local_ip="$5" options:remote_ip="$6" \
      options:dst_port="$VXLAN_PORT" options:tos=inherit bfd:enable=true || fail "$1 tunnel $2"
  docker exec "$PFX-$1" ovs-ofctl mod-port br0 "$2" no-flood || fail "$1 $2 no-flood"
}
echo "[mp-ovs] tunnels: $A_TUN (VNI $A_VNI, path A) and $B_TUN (VNI $B_VNI, path B), tos=inherit, BFD on"
tunnel ovs-a "$A_TUN" 11 "$A_VNI" "$A_OVSA_IP" "$A_OVSB_IP"
tunnel ovs-a "$B_TUN" 12 "$B_VNI" "$B_OVSA_IP" "$B_OVSB_IP"
tunnel ovs-b "$A_TUN" 11 "$A_VNI" "$A_OVSB_IP" "$A_OVSA_IP"
tunnel ovs-b "$B_TUN" 12 "$B_VNI" "$B_OVSB_IP" "$B_OVSA_IP"

echo "[mp-ovs] ovs-a table 0: EF marking (DSCP 46 on UDP $SV_PORTS, DSCP 0 on other IP) = QoS on"
{
  for p in $SV_PORTS; do echo "table=0,priority=300,udp,tp_dst=$p,actions=mod_nw_tos:$EF_TOS,goto_table:1"; done
  echo "table=0,priority=100,ip,actions=mod_nw_tos:0,goto_table:1"
  echo "table=0,priority=0,actions=goto_table:1"
} | docker exec -i "$PFX-ovs-a" sh -c 'ovs-ofctl del-flows br0 "table=0" && ovs-ofctl add-flows br0 -' || fail "ovs-a marking flows"
echo "table=0,priority=0,actions=goto_table:1" \
  | docker exec -i "$PFX-ovs-b" sh -c 'ovs-ofctl del-flows br0 "table=0" && ovs-ofctl add-flows br0 -' || fail "ovs-b table 0"

bash "$DIR/mp-path.sh" "$PATH_DEFAULT" || fail "path pin"

# Access-hop shaper on both underlay interfaces of ovs-a (forward egress of each path).
for DEV in "$A_OVSA_DEV" "$B_OVSA_DEV"; do
  echo "[mp-ovs] ovs-a $DEV: HTB ${CEIL_KBIT}k, EF ${EF_RATE_KBIT}k/${EF_CEIL_KBIT}k by outer DSCP 46, best effort ${BE_ACCESS_RATE_KBIT}k/${CEIL_KBIT}k"
  docker exec "$PFX-ovs-a" sh -c "
    tc qdisc del dev $DEV root 2>/dev/null || true
    tc qdisc add dev $DEV root handle 1: htb default 1 &&
    tc class add dev $DEV parent 1: classid 1:fffe htb rate ${CEIL_KBIT}kbit ceil ${CEIL_KBIT}kbit \
       burst $ACCESS_ROOT_BURST_B cburst $ACCESS_ROOT_BURST_B mpu $ACCESS_MPU_B &&
    tc class add dev $DEV parent 1:fffe classid 1:1 htb rate ${BE_ACCESS_RATE_KBIT}kbit ceil ${CEIL_KBIT}kbit \
       burst $ACCESS_BURST_B cburst $ACCESS_BURST_B mpu $ACCESS_MPU_B quantum $ACCESS_BE_QUANTUM &&
    tc class add dev $DEV parent 1:fffe classid 1:2 htb rate ${EF_RATE_KBIT}kbit ceil ${EF_CEIL_KBIT}kbit \
       burst $ACCESS_BURST_B cburst $ACCESS_BURST_B mpu $ACCESS_MPU_B quantum $ACCESS_EF_QUANTUM &&
    tc filter add dev $DEV protocol ip parent 1: prio 1 u32 match ip dsfield 0xb8 0xfc flowid 1:2
  " || fail "ovs-a shaper on $DEV"
done

echo "=== switches configured ==="
for SW in ovs-a ovs-b; do
  echo "--- $SW"
  docker exec "$PFX-$SW" ovs-ofctl --names dump-flows br0 | sed -E 's/ cookie=0x0, duration=[^,]*,//; s/ n_packets=[^,]*, n_bytes=[^,]*,( idle_age=[^,]*,)?//'
done
