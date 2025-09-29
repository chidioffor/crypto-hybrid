#!/usr/bin/env bash
set -euo pipefail

# Safely stop dev processes started from within this repository.
# Only kills processes whose current working directory (cwd) is inside $ROOT_DIR.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "Stopping CryptoHybrid dev services within: $ROOT_DIR"

# Require lsof for cwd inspection (macOS/Linux)
if ! command -v lsof >/dev/null 2>&1; then
  echo "Error: lsof is required but not found. Install lsof and try again."
  exit 1
fi

kill_in_root() {
  local pattern="$1"
  # Find candidate PIDs by command-line pattern
  local pids
  IFS=$'\n' read -r -d '' -a pids < <(pgrep -f "$pattern" && printf '\0' || true)

  for pid in "${pids[@]:-}"; do
    # Determine the process cwd via lsof (portable on macOS)
    local cwd
    cwd="$(lsof -p "$pid" 2>/dev/null | awk '$4=="cwd" {for(i=9;i<=NF;i++) printf $i" "; print ""}')" || true

    # Trim trailing space
    cwd="${cwd%% }"

    if [[ -n "$cwd" && "$cwd" == "$ROOT_DIR"* ]]; then
      echo "Killing PID $pid (cwd: $cwd) matching: $pattern"
      kill "$pid" 2>/dev/null || true
      # Give it a moment, then SIGKILL if still alive
      sleep 0.5
      if kill -0 "$pid" 2>/dev/null; then
        echo "Force killing PID $pid"
        kill -9 "$pid" 2>/dev/null || true
      fi
    fi
  done
}

# Microservices entrypoints (dev mode usually runs via nodemon)
kill_in_root "services/api-gateway"
kill_in_root "services/user-service"
kill_in_root "services/wallet-service"
kill_in_root "services/payment-service"
kill_in_root "services/card-service"

# Frontend (react dev server or similar)
kill_in_root "frontend"
kill_in_root "react-scripts start"

echo "Done. (Only processes launched inside $ROOT_DIR were targeted.)"
