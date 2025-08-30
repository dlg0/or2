#!/usr/bin/env bash
set -euo pipefail

# Kill local dev servers for this monorepo by port.
# - Server: PORT (default 2567)
# - Web: Next.js dev (default range 3000-3010)
# Usage:
#   scripts/kill-dev.sh        # dry run: list processes
#   scripts/kill-dev.sh -f     # actually kill
# Env overrides:
#   SERVER_PORT=2567 WEB_PORT_START=3000 WEB_PORT_END=3010 EXTRA_PORTS="3002 3011"

FORCE=0
if [[ "${1:-}" == "-f" || "${1:-}" == "--force" ]]; then
  FORCE=1
fi

SERVER_PORT="${SERVER_PORT:-2567}"
WEB_PORT_START="${WEB_PORT_START:-3000}"
WEB_PORT_END="${WEB_PORT_END:-3010}"
EXTRA_PORTS="${EXTRA_PORTS:-}"

ports=()
ports+=("${SERVER_PORT}")

start=${WEB_PORT_START}
end=${WEB_PORT_END}
if [[ ${start} -le ${end} ]]; then
  for ((p=start; p<=end; p++)); do
    ports+=("$p")
  done
fi

if [[ -n "${EXTRA_PORTS}" ]]; then
  for p in ${EXTRA_PORTS}; do
    ports+=("$p")
  done
fi

found_pids=$(mktemp)
trap 'rm -f "$found_pids"' EXIT

echo "Scanning ports: ${ports[*]}" >&2
for port in "${ports[@]}"; do
  # lsof -ti returns PIDs only; -iTCP with -sTCP:LISTEN to get listeners
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null || true
  fi
done | awk 'NF' | sort -u >"$found_pids"

if [[ ! -s "$found_pids" ]]; then
  echo "No dev listeners found on target ports." >&2
  exit 0
fi

echo "Found processes listening on target ports:" >&2
while read -r pid; do
  if ps -p "$pid" >/dev/null 2>&1; then
    ps -o pid=,comm=,args= -p "$pid"
  fi
done <"$found_pids"

if [[ $FORCE -eq 0 ]]; then
  echo "\nDry run. Re-run with -f to terminate the above PIDs." >&2
  exit 0
fi

echo "\nTerminating processes..." >&2
while read -r pid; do
  if ! ps -p "$pid" >/dev/null 2>&1; then
    continue
  fi
  echo "- PID $pid: SIGTERM" >&2
  kill -TERM "$pid" 2>/dev/null || true
done <"$found_pids"

sleep 1

while read -r pid; do
  if ps -p "$pid" >/dev/null 2>&1; then
    echo "- PID $pid still alive: SIGKILL" >&2
    kill -KILL "$pid" 2>/dev/null || true
  fi
done <"$found_pids"

echo "Done." >&2

