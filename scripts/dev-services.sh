#!/usr/bin/env bash
set -euo pipefail

# Starts all microservices in watch mode via their local package scripts.
# Requires: npm, concurrently (installed at repo root), and nodemon in each service.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found. Please install Node.js/npm."
  exit 1
fi

# Use root-level concurrently to run each service's dev script
npx concurrently   "cd services/api-gateway && npm run dev"   "cd services/user-service && npm run dev"   "cd services/wallet-service && npm run dev"   "cd services/payment-service && npm run dev"   "cd services/card-service && npm run dev"
