#!/usr/bin/env bash
# ============================================================
# mp-lab-up.sh — bring up the two-path lab (vied-mp). Idempotent; redeploys from scratch.
#
#   ./mp-lab-up.sh                       refuses to start while the paper lab is deployed
#   ./mp-lab-up.sh --replace-paper-lab   takes the paper lab's DEPLOYMENT down first (its files
#                                        are not touched; ../lab-up.sh or a reboot brings it back)
#
# One lab at a time: both labs share the host's CPUs, the bind-mounted publisher directory
# (loggerOutput/ is the t_trip source) and the vIED build directory.
#
# After a VM reboot the systemd unit redeploys the PAPER lab, and this lab's containers come
# back without their links: run this script again (with --replace-paper-lab) to use it.
#
# Runs as a normal user in the docker and clab_admins groups (containerlab is setuid). The two
# host-wide prerequisites are normally already in place, because the paper lab's unit sets them
# at boot; they are checked here and set if this script happens to run as root.
# ============================================================
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/params.env"
TOPO="$DIR/vied-mp.clab.yml"
PAPER_TOPO="$DIR/../vied-lab.clab.yml"
SUB="$PFX-vied"

echo "[mp-lab-up] 0/6 one lab at a time"
if docker ps --format '{{.Names}}' | grep -q '^clab-vied-lab-'; then
  if [ "${1:-}" = "--replace-paper-lab" ]; then
    echo "  paper lab is deployed: taking its deployment down (files untouched)"
    containerlab destroy -t "$PAPER_TOPO" || { echo "  [ABORT] could not destroy the paper lab"; exit 1; }
  else
    echo "  [ABORT] the paper lab (clab-vied-lab-*) is deployed. Re-run with --replace-paper-lab to take it down first."
    exit 1
  fi
fi

echo "[mp-lab-up] 1/6 host prerequisites"
# The vIED asks for an 8 MiB SO_RCVBUF per R-session; the kernel caps it at this global sysctl.
RMEM=$(cat /proc/sys/net/core/rmem_max)
if [ "$RMEM" -lt 16777216 ]; then
  sysctl -w net.core.rmem_max=16777216 2>/dev/null \
    || { echo "  [ABORT] net.core.rmem_max=$RMEM (< 16777216) and this script is not root: set it first (see CLAUDE.md)"; exit 1; }
fi
echo "  net.core.rmem_max=$(cat /proc/sys/net/core/rmem_max)"
if ! lsmod | grep -q '^openvswitch'; then
  modprobe openvswitch 2>/dev/null \
    || { echo "  [ABORT] kernel module openvswitch is not loaded and this script is not root"; exit 1; }
fi
echo "  openvswitch module: loaded"

echo "[mp-lab-up] 2/6 containerlab deploy (containers + veth links; no addresses in the topology file)"
containerlab deploy --reconfigure -t "$TOPO" || { echo "  [ABORT] deploy failed"; exit 1; }

echo "[mp-lab-up] 3/6 addresses, underlay MTU, static routes"
bash "$DIR/mp-net.sh" || exit 1

echo "[mp-lab-up] 4/6 switches: tunnels + BFD, EF marking, path pin ($PATH_DEFAULT), access-hop shaper"
bash "$DIR/mp-ovs.sh" || exit 1

echo "[mp-lab-up] 5/6 routers: per-hop PHB + propagation delay"
bash "$DIR/mp-wan-qos.sh" || exit 1

echo "[mp-lab-up] 6/6 relink the vIED (a redeploy wipes /opt; the objects persist on the bind mount)"
docker exec "$SUB" mkdir -p /opt/virtual-merging-unit
docker exec "$SUB" bash -lc 'cd /root/virtual-merging-unit/build && cmake --build . -j"$(nproc)"' >/dev/null 2>&1 \
  && echo "  vIED binary: /opt/virtual-merging-unit/merging-unit" \
  || echo "  [WARN] vIED relink failed — build it manually in $SUB"

echo "[mp-lab-up] verify:"
docker exec "$PFX-vmu1" sh -c "ping -c1 -W2 $VIED_IP >/dev/null 2>&1" \
  && echo "  vmu1 -> vied through the tunnel (path $PATH_DEFAULT): OK" || echo "  vmu1 -> vied: FAIL"
for T in "$A_TUN" "$B_TUN"; do
  echo "  BFD $T at ovs-a: $(docker exec "$PFX-ovs-a" ovs-vsctl get interface "$T" bfd_status)"
done
echo "[mp-lab-up] done — full read-back: .venv/bin/python -u multipath/mp_sweep.py --path a --readback-only"
