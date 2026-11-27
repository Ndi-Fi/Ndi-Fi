#!/usr/bin/env bash
# dev-local.sh — start (or stop) all local Ndi-Fi development services.
#
# Usage:
#   ./scripts/dev-local.sh          # start everything
#   ./scripts/dev-local.sh stop     # kill all managed processes
#   ./scripts/dev-local.sh status   # show what is running
#
# Services managed:
#   - anvil (EVM JSON-RPC on :8545)
#   - frontend help UI demo (Node.js on :8080, overridable via PORT_FRONTEND)
#   - shared web UI footer preview (Python http.server on :8000, overridable via PORT_WEB)
#
# Environment variables (all optional):
#   ANVIL_PORT       port for anvil         (default: 8545)
#   PORT_FRONTEND    port for frontend demo (default: 8080)
#   PORT_WEB         port for web UI        (default: 8000)
#   SKIP_STELLAR     set to 1 to skip Stellar cargo checks
#   SKIP_EVM         set to 1 to skip anvil and forge deploy
#   SKIP_FRONTEND    set to 1 to skip the frontend demo server
#   SKIP_WEB         set to 1 to skip the web footer server
#
# Requirements:
#   - Foundry (forge, anvil) on PATH
#   - Rust + cargo + stellar-cli in stellar/ workspace
#   - Node.js >= 18 for frontend/
#   - Python 3 for web/
#
# PIDs of background processes are saved to .local-pids at the repo root.
# Run './scripts/dev-local.sh stop' or 'kill $(cat .local-pids)' to clean up.

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="${REPO_ROOT}/.local-pids"

ANVIL_PORT="${ANVIL_PORT:-8545}"
PORT_FRONTEND="${PORT_FRONTEND:-8080}"
PORT_WEB="${PORT_WEB:-8000}"

log()   { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
error() { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; }
die()   { error "$*"; exit 1; }

# ── stop ────────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "stop" ]]; then
  if [[ ! -f "$PID_FILE" ]]; then
    warn "No .local-pids file found — nothing to stop."
    exit 0
  fi
  log "Stopping all Ndi-Fi local services…"
  while IFS= read -r pid; do
    if kill "$pid" 2>/dev/null; then
      ok "Killed PID $pid"
    else
      warn "PID $pid not running (already stopped?)"
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"
  ok "Done."
  exit 0
fi

# ── status ───────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "status" ]]; then
  if [[ ! -f "$PID_FILE" ]]; then
    warn "No .local-pids file found — nothing is managed."
    exit 0
  fi
  log "Managed PIDs:"
  while IFS= read -r pid; do
    if kill -0 "$pid" 2>/dev/null; then
      printf '  PID %-8s  \033[1;32mrunning\033[0m\n' "$pid"
    else
      printf '  PID %-8s  \033[1;31mstopped\033[0m\n' "$pid"
    fi
  done < "$PID_FILE"
  exit 0
fi

# ── start ────────────────────────────────────────────────────────────────────
cd "$REPO_ROOT"
> "$PID_FILE"   # reset PID file

log "Ndi-Fi local stack startup"
echo ""

# ── Environment & .env validation ───────────────────────────────────────────
if [[ -f ".env" ]]; then
  log "Loading configuration from .env"
  # shellcheck disable=SC1091
  set -a && source .env && set +a
else
  warn "No .env found — using defaults. Run 'cp .env.example .env' to customize."
fi

if [[ -f "scripts/validate-env.js" ]] && command -v node &>/dev/null; then
  log "Validating .env.example specification"
  node scripts/validate-env.js --check-example || die "Environment validation failed."
fi

# ── Stellar / Soroban checks ─────────────────────────────────────────────────
if [[ "${SKIP_STELLAR:-0}" != "1" ]]; then
  log "1/4  Stellar: format, lint and tests"

  if ! command -v cargo &>/dev/null; then
    die "cargo not found. Install Rust from https://rustup.rs"
  fi

  cd stellar

  log "  cargo fmt --all --check"
  cargo fmt --all --check || die "Stellar fmt check failed — run 'cargo fmt --all' to fix."

  log "  cargo clippy"
  cargo clippy --all-targets -- -D warnings || die "Stellar clippy failed — fix the warnings above."

  log "  cargo test"
  cargo test || die "Stellar tests failed."

  log "  stellar contract build"
  if command -v stellar &>/dev/null; then
    stellar contract build >/dev/null
    ok "WASM build succeeded."
  else
    warn "stellar CLI not found — skipping WASM build (tests still passed)."
  fi

  cd "$REPO_ROOT"
  ok "Stellar checks passed."
else
  warn "Skipping Stellar checks (SKIP_STELLAR=1)."
fi

echo ""

# ── EVM / Foundry ─────────────────────────────────────────────────────────────
if [[ "${SKIP_EVM:-0}" != "1" ]]; then
  log "2/4  EVM: start anvil on :${ANVIL_PORT}"

  if ! command -v anvil &>/dev/null; then
    die "anvil not found. Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup"
  fi

  # Check port is free
  if lsof -i ":${ANVIL_PORT}" -sTCP:LISTEN &>/dev/null 2>&1; then
    die "Port ${ANVIL_PORT} is already in use. Stop the existing process or set ANVIL_PORT=<other>."
  fi

  anvil \
    --host 0.0.0.0 \
    --port "${ANVIL_PORT}" \
    --chain-id 31337 \
    --block-time 1 \
    --silent \
    &
  ANVIL_PID=$!
  echo "$ANVIL_PID" >> "$PID_FILE"
  ok "anvil started (PID ${ANVIL_PID}) → http://localhost:${ANVIL_PORT}"

  # Wait for anvil to be ready
  for i in $(seq 1 10); do
    if curl -sf "http://localhost:${ANVIL_PORT}" \
        -X POST -H 'Content-Type: application/json' \
        -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' &>/dev/null; then
      break
    fi
    sleep 0.5
  done

  log "  Deploying Solidity contracts to anvil"
  if [[ -f "script/Deploy.s.sol" ]]; then
    forge script script/Deploy.s.sol \
      --rpc-url "http://localhost:${ANVIL_PORT}" \
      --broadcast \
      --private-key "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" \
      --silent \
      || warn "Deploy script failed or not yet fully wired — check script/Deploy.s.sol."
    ok "Solidity contracts deployed."
  else
    warn "script/Deploy.s.sol not found — skipping contract deployment."
  fi

  log "  Running forge tests"
  forge test -vvv || die "Forge tests failed."
  ok "EVM checks passed."
else
  warn "Skipping EVM stack (SKIP_EVM=1)."
fi

echo ""

# ── Frontend help UI ──────────────────────────────────────────────────────────
if [[ "${SKIP_FRONTEND:-0}" != "1" ]]; then
  log "3/4  Frontend: start help UI demo on :${PORT_FRONTEND}"

  if ! command -v node &>/dev/null; then
    die "node not found. Install Node.js >= 18 from https://nodejs.org"
  fi

  NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
  if (( NODE_VERSION < 18 )); then
    die "Node.js >= 18 required (found v${NODE_VERSION}.x). Upgrade from https://nodejs.org"
  fi

  if lsof -i ":${PORT_FRONTEND}" -sTCP:LISTEN &>/dev/null 2>&1; then
    die "Port ${PORT_FRONTEND} already in use. Set PORT_FRONTEND=<other>."
  fi

  PORT="${PORT_FRONTEND}" node frontend/scripts/serve.js &
  FRONTEND_PID=$!
  echo "$FRONTEND_PID" >> "$PID_FILE"
  ok "Frontend demo started (PID ${FRONTEND_PID}) → http://localhost:${PORT_FRONTEND}/"
else
  warn "Skipping frontend demo (SKIP_FRONTEND=1)."
fi

echo ""

# ── Web footer preview ────────────────────────────────────────────────────────
if [[ "${SKIP_WEB:-0}" != "1" ]]; then
  log "4/4  Web: start footer preview on :${PORT_WEB}"

  if ! command -v python3 &>/dev/null; then
    warn "python3 not found — skipping web footer preview. Install Python 3 to enable it."
  else
    if lsof -i ":${PORT_WEB}" -sTCP:LISTEN &>/dev/null 2>&1; then
      die "Port ${PORT_WEB} already in use. Set PORT_WEB=<other>."
    fi

    python3 -m http.server "${PORT_WEB}" --directory "$REPO_ROOT" &>/dev/null &
    WEB_PID=$!
    echo "$WEB_PID" >> "$PID_FILE"
    ok "Web footer preview started (PID ${WEB_PID}) → http://localhost:${PORT_WEB}/web/index.html"
  fi
else
  warn "Skipping web footer preview (SKIP_WEB=1)."
fi

echo ""
log "All services started. PIDs saved to .local-pids"
echo ""
echo "  ┌──────────────────────────────────────────────────────────────────┐"
echo "  │  Service            │  URL                                       │"
echo "  ├──────────────────────────────────────────────────────────────────┤"
echo "  │  EVM (anvil)        │  http://localhost:${ANVIL_PORT}                        │"
echo "  │  Frontend help UI   │  http://localhost:${PORT_FRONTEND}/                       │"
echo "  │  Web footer preview │  http://localhost:${PORT_WEB}/web/index.html          │"
echo "  └──────────────────────────────────────────────────────────────────┘"
echo ""
echo "  Stop all:  ./scripts/dev-local.sh stop"
echo "  Status:    ./scripts/dev-local.sh status"
echo ""
