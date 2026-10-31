#!/usr/bin/env bash
set -e
OVS=clab-vied-lab-ovs-core

# 0. Host: ensure the OVS datapath module is loaded
lsmod | grep -q openvswitch || sudo modprobe openvswitch

# 1. Start the OVS daemons (only if not already running)
docker exec $OVS bash -c '
  mkdir -p /var/run/openvswitch /etc/openvswitch /var/log/openvswitch
  [ -f /etc/openvswitch/conf.db ] || ovsdb-tool create /etc/openvswitch/conf.db /usr/share/openvswitch/vswitch.ovsschema
  pidof ovsdb-server  >/dev/null || ovsdb-server --remote=punix:/var/run/openvswitch/db.sock --remote=db:Open_vSwitch,Open_vSwitch,manager_options --pidfile --detach --log-file
  ovs-vsctl --no-wait init
  pidof ovs-vswitchd  >/dev/null || ovs-vswitchd --pidfile --detach --log-file
'

# 2. Bridge + ports (--may-exist makes this safe to re-run)
docker exec $OVS bash -c '
  ovs-vsctl --may-exist add-br br0
  for i in 1 2 3 4 5; do ip link set eth$i up; ovs-vsctl --may-exist add-port br0 eth$i; done
'

# 3. QoS: clear any stale rows, then recreate the WAN cap + two queues on eth5.
#    30 Mb/s cap sized so the aggregate R-SV (3 streams x ~6 Mb/s = ~18 Mb/s) is
#    ~60% of the link; q1 (priority, R-SV) min-rate covers that aggregate (18M+2M
#    headroom), q0 (best-effort) gets the rest. Both may borrow up to the cap.
docker exec $OVS bash -c '
  ovs-vsctl clear port eth5 qos      || true
  ovs-vsctl --all destroy qos        || true
  ovs-vsctl --all destroy queue      || true
  ovs-vsctl set port eth5 qos=@newqos -- --id=@newqos create qos type=linux-htb other-config:max-rate=30000000 queues:0=@q0 queues:1=@q1 -- --id=@q0 create queue other-config:min-rate=1000000 other-config:max-rate=30000000 -- --id=@q1 create queue other-config:min-rate=20000000 other-config:max-rate=30000000
'

# 4. DiffServ EF at the edge (default = QoS on; qos_sweep.py toggles per condition).
#    Marker flows: R-SV (one UDP port per merging-unit R-session; per-MU sessions let
#    the vIED decrypt streams in parallel) -> mark DSCP EF(46) = TOS 184 AND ride the
#    priority queue on this hop. Bleach flow: any other IP -> DSCP 0 (trust boundary:
#    remark at the edge, never trust host markings). Downstream WAN hops classify by
#    DSCP alone (tc filter dsfield 0xb8/0xfc) — "mark once, honored end-to-end".
#    QoS off (single queue) = delete all ip flows: no mark -> no hop matches EF.
docker exec $OVS bash -c '
  ovs-ofctl del-flows br0 "ip" || true
  for p in 102 103 104 105 106; do   # 105/106: boundary-sweep load streams (qos_sweep.py LOAD_PUBLISHERS)
    ovs-ofctl add-flow br0 "priority=300,udp,tp_dst=$p,actions=mod_nw_tos:184,set_queue:1,NORMAL"
  done
  ovs-ofctl add-flow br0 "priority=100,ip,actions=mod_nw_tos:0,NORMAL"
'

echo "=== OVS restored ==="
docker exec $OVS ovs-vsctl list qos
docker exec $OVS ovs-ofctl dump-flows br0
