#!/usr/bin/env bash
# validate-env.sh — validates .env.example and .env syntax and completeness.
# Used at build time in Docker and local pre-flight checks.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

if command -v node >/dev/null 2>&1; then
  node "${SCRIPT_DIR}/validate-env.js" "$@"
else
  # Fallback lightweight bash validator when Node is not available
  echo "==> Node not found, running lightweight shell validation on .env.example..."
  if [[ ! -f ".env.example" ]]; then
    echo "ERROR: .env.example missing at ${ROOT_DIR}/.env.example" >&2
    exit 1
  fi

  for key in ETH_RPC_URL ANVIL_PORT PRIVATE_KEY NEXT_PUBLIC_ETH_RPC_URL NEXT_PUBLIC_APP_ENV; do
    if ! grep -q "^${key}=" .env.example; then
      echo "ERROR: Required key '${key}' missing in .env.example" >&2
      exit 1
    fi
  done
  echo "[OK] .env.example contains essential keys."
fi
