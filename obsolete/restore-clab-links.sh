#!/usr/bin/env bash
#
# restore-clab-links.sh
#
# Recreate the containerlab inter-node links (eth1/eth2) and their IP/route
# config after a host-VM reboot, WITHOUT redeploying the lab.
#
# Why this exists: on a host reboot Docker restarts the same containers (so the
# container filesystems -- installed apt packages, etc. -- and the bind-mounted
# build/ dir all survive), but the veth links that containerlab created at
# deploy time are gone and never get recreated. This script rebuilds just those
# links, mirroring the `links:` and `exec:` sections of vied-lab.clab.yml.
#
# Usage:  sudo ./restore-clab-links.sh
#
set -euo pipefail

VMU=clab-vied-lab-vmu1
VIED=clab-vied-lab-vied
ROUTER=clab-vied-lab-router

if [ "$(id -u)" -ne 0 ]; then
  echo "error: must run as root (use: sudo $0)" >&2
  exit 1
fi

# Expose each container's network namespace to iproute2 under /var/run/netns,
# so we can drive it with `ip netns exec` from the host.
register_netns() {
  local container="$1" nsname="$2" pid
  pid=$(docker inspect -f '{{.State.Pid}}' "$container" 2>/dev/null) || {
    echo "error: container $container not found (is the lab deployed?)" >&2
    exit 1
  }
  if [ "${pid:-0}" -eq 0 ]; then
    echo "error: container $container is not running" >&2
    exit 1
  fi
  mkdir -p /var/run/netns
  ln -sf "/proc/$pid/ns/net" "/var/run/netns/$nsname"
}

# Create one veth link between two namespaces, with the given interface names.
# Idempotent: removes any existing interface of that name first.
#   make_link <ns_a> <if_a> <ns_b> <if_b>
make_link() {
  local ns_a="$1" if_a="$2" ns_b="$3" if_b="$4"
  ip netns exec "$ns_a" ip link del "$if_a" 2>/dev/null || true
  ip netns exec "$ns_b" ip link del "$if_b" 2>/dev/null || true
  # Temp names live in the host ns only momentarily (must be <= 15 chars).
  local tmp_a="v_${ns_a}_${if_a}" tmp_b="v_${ns_b}_${if_b}"
  ip link del "$tmp_a" 2>/dev/null || true
  ip link del "$tmp_b" 2>/dev/null || true
  ip link add "$tmp_a" type veth peer name "$tmp_b"
  ip link set "$tmp_a" netns "$ns_a" name "$if_a"
  ip link set "$tmp_b" netns "$ns_b" name "$if_b"
  ip netns exec "$ns_a" ip link set "$if_a" up
  ip netns exec "$ns_b" ip link set "$if_b" up
}

# addr <ns> <if> <cidr>   -- idempotent address assignment
addr() {
  ip netns exec "$1" ip addr add "$3" dev "$2" 2>/dev/null || true
}
# route <ns> <prefix> <via>   -- idempotent route
route() {
  ip netns exec "$1" ip route add "$2" via "$3" 2>/dev/null || true
}

echo ">> registering container network namespaces"
register_netns "$VMU"    vmu1
register_netns "$VIED"   vied
register_netns "$ROUTER" router

echo ">> recreating links (vmu1:eth1<->router:eth1, vied:eth1<->router:eth2)"
make_link vmu1 eth1 router eth1
make_link vied eth1 router eth2

echo ">> assigning addresses and routes"
addr  vmu1   eth1 10.10.40.1/24
route vmu1   10.10.30.0/24 10.10.40.100

addr  vied   eth1 10.10.30.1/24
route vied   10.10.40.0/24 10.10.30.100

addr  router eth1 10.10.40.100/24
addr  router eth2 10.10.30.100/24
ip netns exec router sysctl -wq net.ipv4.ip_forward=1

# Tidy up the temporary netns symlinks.
rm -f /var/run/netns/vmu1 /var/run/netns/vied /var/run/netns/router

echo ">> done. current state:"
for c in "$VMU" "$VIED" "$ROUTER"; do
  echo "--- $c ---"
  docker exec "$c" ip -br addr show 2>/dev/null | grep -E 'eth1|eth2' || echo "  (no eth1/eth2)"
done

echo ">> connectivity check (vmu1 -> vied 10.10.30.1):"
docker exec "$VMU" ping -c1 -W2 10.10.30.1 >/dev/null 2>&1 \
  && echo "  OK" || echo "  FAILED (check router/forwarding)"
