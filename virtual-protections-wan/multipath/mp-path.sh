#!/usr/bin/env bash
# ============================================================
# mp-path.sh a|b — pin ALL site-to-site traffic (R-SV, background, R-GOOSE) to one path.
#
# Forwarding table (table 1) on both switches; table 0 on ovs-a is the marking (mp-ovs.sh):
#
#   priority 200  in_port = the OTHER tunnel       -> drop      (nothing is accepted from it)
#   priority 150  IP  to the other site's subnet   -> output: the selected tunnel
#   priority 150  ARP for the other site's subnet  -> output: the selected tunnel
#   priority 0    everything else                  -> NORMAL    (local delivery; the tunnel ports
#                                                               are no-flood, see mp-ovs.sh)
#
# Traffic is never switched with NORMAL toward the tunnels: with two tunnels in one bridge that
# would loop. BFD is unaffected by these flows (OVS handles it at the interface, before the flow
# table), so both tunnels keep their BFD session whichever path is selected.
#
# Not atomic (table 1 is emptied, then refilled): pin before traffic starts, as the driver does.
# The driver reads the pin back from both switches; this script only installs it.
# ============================================================
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/params.env"

case "${1:-}" in
  a) SEL=$A_TUN; OTHER=$B_TUN ;;
  b) SEL=$B_TUN; OTHER=$A_TUN ;;
  *) echo "usage: $0 a|b"; exit 2 ;;
esac

pin() {   # $1 = switch, $2 = the other site's subnet
  docker exec -i "$PFX-$1" sh -c 'ovs-ofctl del-flows br0 "table=1" && ovs-ofctl add-flows br0 -' <<EOF || { echo "[mp-path] FAILED on $1"; exit 1; }
table=1,priority=200,in_port=$OTHER,actions=drop
table=1,priority=150,ip,nw_dst=$2,actions=output:$SEL
table=1,priority=150,arp,arp_tpa=$2,actions=output:$SEL
table=1,priority=0,actions=NORMAL
EOF
}
pin ovs-a "$LAN_B_NET"
pin ovs-b "$LAN_A_NET"
echo "[mp-path] pinned to path $1 (tunnel $SEL) on ovs-a and ovs-b"
