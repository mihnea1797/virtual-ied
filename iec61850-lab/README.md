# iec61850-lab

A web-controlled IEC 61850 Sampled Values (SV) publisher and GOOSE / R-GOOSE
latency tool, built on [libiec61850](https://github.com/mz-automation/libiec61850).
It serves a small web UI (with a live SSE event stream) for configuring and
measuring SV/GOOSE latency.

## Building & running in the containerlab container

The repo lives on the host at `/home/mihnea/iec61850-lab` and is bind-mounted
into the `clab-vied-lab-vmu1` container at `/home/root/iec61850-lab`. Source
edits and the `libiec61850` submodule persist on the host; **apt packages and
the `build/` dir do not survive a container redeploy.**

### 1. One-time host setup (only if the submodule is empty)

The `dependencies/libiec61850` submodule must be populated. Run on the **host**:

```bash
cd /home/mihnea/iec61850-lab
git submodule update --init --recursive
```

(If `.gitmodules` is ever missing, recreate it pointing
`dependencies/libiec61850` → `https://github.com/mz-automation/libiec61850.git`,
then run the command above.)

### 2. Enter the container

```bash
docker exec -it clab-vied-lab-vmu1 bash
```

### 3. Install build dependencies (needed after every redeploy)

```bash
apt-get update
apt-get install -y libpcap-dev libmbedtls-dev
```

(`nlohmann-json`, cmake, g++ and make are already in the image.)

### 4. Configure & build

```bash
cd /home/root/iec61850-lab
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
```

After a redeploy, clear the stale build dir first: `rm -rf build`. The binary
lands at `build/iec61850-lab`.

### 5. Run

**Foreground** (interactive shell, Ctrl-C to stop):

```bash
cd /home/root/iec61850-lab
./build/iec61850-lab config.json
```

You'll see `Listening on 0.0.0.0:8080`. It serves the web UI; `autoStart` is
`false`, so SV/GOOSE only begins on a `/start`.

**Detached** (survives closing your shell — run from the **host**, not from
inside an `exec` session, since plain backgrounding gets killed when the exec
exits):

```bash
docker exec -d clab-vied-lab-vmu1 \
  bash -c 'cd /home/root/iec61850-lab && ./build/iec61850-lab config.json > /tmp/svweb.log 2>&1'
```

### 6. Verify / control

```bash
# from inside the container (or prefix each with: docker exec clab-vied-lab-vmu1 ...)
curl http://localhost:8080/                 # web UI (HTTP 200)
curl -N http://localhost:8080/events        # live SSE status/timer stream
curl -X POST http://localhost:8080/start    # begin SV publish + GOOSE/R-GOOSE
curl -X POST http://localhost:8080/stop     # stop
pgrep -fa iec61850-lab              # check it's running
cat /tmp/svweb.log                          # logs (if started detached)
```

## Notes

- The default config arg is `config.json` — you can pass a different path:
  `./build/iec61850-lab /path/to/other.json`.
- Lab link is `eth1` (10.10.40.1/24); mgmt is `eth0`. `config.json` currently
  sets `iface: "eth0"` — switch it to `eth1` if you want SV/GOOSE on the lab
  network toward `vied` (10.10.30.x).
- To skip the per-redeploy apt step, bake `libpcap-dev` + `libmbedtls-dev` into
  `dev-container:latest` or add them as an `exec:` step in `vied-lab.clab.yml`.
