# Virtual Merging Unit

IEC 61850 virtual merging unit: subscribes to Sampled Values (rSV/SV) on an
Ethernet interface, computes RMS values, and publishes GOOSE / rGOOSE messages.
Built on [libiec61850](https://github.com/mz-automation/libiec61850).

## Repository layout

- `/` (this README, `merging-unit/`, `CMakeLists.txt`, `config.json`): the virtual IED, the R-SV subscriber
  that returns the R-GOOSE trip. Built inside the `clab-vied-lab-vied` container (see below).
- `iec61850-lab/`: the virtual merging unit, the R-SV publisher with the step/trip harness, one process per
  stream in the `vmu*` containers. Own CMake build and its own `dependencies/libiec61850` pin.
- `virtual-protections-wan/`: the testbed (containerlab topology, OVS/WAN QoS scripts, systemd unit), the
  experiment driver `qos_sweep.py`, analysis scripts, results and figures.
- `patches/`: the local libiec61850 commits of both submodules as `git am` patches (neither is upstream).

Merged from three repositories on 2026-10-31 with their histories (`git subtree add`); the host paths
`~/iec61850-lab` and `~/virtual-protections-wan` are symlinks into this tree.

## Building & Running in the containerlab container

**Context:** the lab runs in a `dev-container:latest` containerlab node with this
repo bind-mounted (`/home/mihnea/virtual-ied` → `/root/virtual-merging-unit`).
The image ships **without** mbedtls, and a `clab deploy`/redeploy wipes all
container-level state. The repo and `build/` directory live on the host bind mount
and survive redeploys, but **installed packages and the compiled binary do not** —
so the one-time setup below must be re-run after every redeploy.

### 1. Open a shell in the container

```bash
docker exec -it clab-vied-lab-vied bash
```

Everything below runs **inside** that shell (as root). Alternatively, prefix any
command with `docker exec clab-vied-lab-vied bash -lc '...'` to run it from the host.

### 2. One-time setup (re-run after each redeploy)

```bash
# mbedtls dev headers — required; the dev-container image doesn't ship them
apt-get update && apt-get install -y libmbedtls-dev

# the repo is owned by uid 1000 but you're root → allow git on it (for submodule update)
git config --global --add safe.directory '*'
```

### 3. Build

```bash
cd /root/virtual-merging-unit
rm -rf build && mkdir build && cd build
cmake ..          # checks out the libiec61850 submodule, detects mbedtls 3.6
make -j"$(nproc)"
```

Output binary: **`/opt/virtual-merging-unit/merging-unit`**

> After the first build you can skip `rm -rf build` and just re-run `make` for
> incremental rebuilds. Do a clean build only if the CMake config changed or
> mbedtls was just (re)installed.

### 4. Run

```bash
cd /tmp                              # writes output-sv.txt / output-goose.txt to cwd
/opt/virtual-merging-unit/merging-unit
```

The app reads `/root/virtual-merging-unit/config.json` (hardcoded path), starts the
SV listener on `eth1`, and the rGOOSE publisher. It runs in an infinite loop — stop
it with **Ctrl-C**.

Expected startup output (one line per configured stream):

```
Starting Listener...
```

To run for a fixed time instead of Ctrl-C:
`timeout 10 /opt/virtual-merging-unit/merging-unit`.

### All-in-one (paste into the host shell)

```bash
docker exec clab-vied-lab-vied bash -lc '
  apt-get update && apt-get install -y libmbedtls-dev
  git config --global --add safe.directory "*"
  cd /root/virtual-merging-unit && rm -rf build && mkdir build && cd build
  cmake .. && make -j"$(nproc)"
'
# then run it:
docker exec -it clab-vied-lab-vied bash -lc 'cd /tmp && /opt/virtual-merging-unit/merging-unit'
```

## Notes

- **Container names:** `clab-vied-lab-vied` (this app), `clab-vied-lab-vmu1`
  (SV source), `clab-vied-lab-router`.
- **Network:** the app uses `eth1` (`10.10.30.1/24`); SV traffic arrives from the
  `vmu1` node via the router.
- **libiec61850 carries one local commit** (`vied-udp-rcvbuf`, on top of upstream
  69977efe): every UDP socket asks for an 8 MiB receive buffer. The commit is not on the
  upstream remote, so after a fresh `git submodule update` that cannot find it, recreate it
  with `git -C dependencies/libiec61850 am ../../patches/libiec61850-udp-so-rcvbuf.patch`
  (or push the branch to a fork and point `.gitmodules` at it). The host must allow it:
  `sysctl -w net.core.rmem_max=16777216` (lab-up.sh does this at boot).
- **Making the mbedtls install durable:** add
  `bash -c "apt-get update && apt-get install -y libmbedtls-dev"` to the `vied`
  node's `exec:` steps in `vied-lab.clab.yml`, or bake `libmbedtls-dev` into the
  `dev-container` image.
