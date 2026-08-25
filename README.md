# vied-lab — lab deployment

Everything needed to bring up the containerlab testbed for the R-SV QoS work.

- `vied-lab.clab.yml`  — topology: vMUs + load-src -> ovs-core (20M cap, DiffServ edge) -> router1 -> router2 -> vied
- `lab-up.sh`          — full bring-up (also run by systemd at boot): modprobe openvswitch, containerlab deploy, ovs-restore, wan-qos, subscriber relink
- `ovs-restore.sh`     — OVS bridge + HTB cap + EF/BE queues + DSCP-EF marking flows
- `wan-qos.sh`         — per-hop DSCP->EF queue + 2.5 ms netem on the WAN routers
- `clab-vied-lab.service` — source of the installed systemd unit (/etc/systemd/system)

Symlinks in ~ point here, so the systemd unit and old habits keep working.
Manual bring-up after any VM restart: `bash ~/lab-up.sh` (systemd does it automatically).
