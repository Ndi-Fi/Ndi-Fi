#!/usr/bin/env bash
# bootstrap.sh — one-command local setup for Ndi-Fi contributors.
#
# Usage:
#   ./bootstrap.sh          # install deps, build, run tests
#   ./bootstrap.sh --help
#
# Prerequisites documented in CONTRIBUTING.md:
#   - Rust (via rustup)        https://rustup.rs
#   - Foundry (forge / cast)   https://book.getfoundry.sh/getting-started/installation
#   - Node.js >= 18            https://nodejs.org
#   - Stellar CLI 28.x         https://github.com/stellar/stellar-cli/releases
#
# The script checks for each tool and tells you exactly what to install
# before proceeding.

set -euo pipefail

# ── helpers ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[bootstrap]${NC} $*"; }
warn()  { echo -e "${YELLOW}[bootstrap]${NC} $*"; }
error() { echo -e "${RED}[bootstrap]${NC} $*" >&2; }

usage() {
  echo "Usage: $0 [--help]"
  echo
  echo "Bootstrap the Ndi-Fi repository for local development."
  echo "Runs: git submodule init, Foundry build + test, Stellar/Soroban build + test."
  exit 0
}

# ── argument parsing ──────────────────────────────────────────────────────────

for arg in "$@"; do
  case "$arg" in
    --help|-h) usage ;;
    *) error "Unknown argument: $arg"; usage ;;
  esac
done

# ── tool detection ────────────────────────────────────────────────────────────

missing=()

check_tool() {
  local name="$1"
  local cmd="$2"
  local install_hint="$3"
  if command -v "$cmd" &>/dev/null; then
    info "  found: $name ($($cmd --version 2>&1 | head -1))"
  else
    warn "  missing: $name"
    warn "  → $install_hint"
    missing+=("$name")
  fi
}

info "Checking required tools..."
check_tool "Rust / rustup" "rustup" "Install from https://rustup.rs"
check_tool "Foundry / forge" "forge" "Install from https://book.getfoundry.sh/getting-started/installation"
check_tool "Node.js" "node" "Install from https://nodejs.org (v18 or later required)"
check_tool "Stellar CLI" "stellar" "Install from https://github.com/stellar/stellar-cli/releases or: cargo install --locked stellar-cli"

if [ "${#missing[@]}" -gt 0 ]; then
  error ""
  error "The following tools are required but not found:"
  for t in "${missing[@]}"; do
    error "  - $t"
  done
  error ""
  error "Install them and re-run ./bootstrap.sh"
  exit 1
fi

# ── submodules ────────────────────────────────────────────────────────────────

info "Initialising git submodules..."
git submodule update --init --recursive

# ── Rust toolchain (Stellar) ──────────────────────────────────────────────────

info "Installing pinned Rust toolchain from stellar/rust-toolchain.toml..."
(cd stellar && rustup toolchain install)

# ── Foundry (Solidity) ────────────────────────────────────────────────────────

info "Building Solidity contracts with Foundry..."
forge build --sizes

info "Running Foundry tests..."
forge test -vvv

# ── Soroban (Stellar) ─────────────────────────────────────────────────────────

info "Running Stellar/Soroban tests..."
(cd stellar && cargo test --locked)

info "Building Stellar/Soroban contracts..."
(cd stellar && stellar contract build)

# ── done ──────────────────────────────────────────────────────────────────────

info ""
info "Bootstrap complete. You're ready to contribute."
info "See CONTRIBUTING.md for the branching and commit conventions."
