#!/usr/bin/env bash
# Builds and deploys NdiToken, NdiLending and NdiStaking to Stellar testnet,
# then writes the contract IDs to deployments/testnet.json.
#
# Usage (from anywhere):
#   ./stellar/scripts/deploy_testnet.sh
#
# Optional environment variables:
#   STELLAR_IDENTITY   CLI identity name to deploy with      (default: ndi-deployer)
#   LENDING_ASSET_ID   SEP-41 asset for the lending vault    (default: native XLM SAC)
#   LP_TOKEN_ID        SEP-41 LP token to stake (e.g. a Soroswap pair).
#                      Default: a testnet-only placeholder asset "NDILP" issued by
#                      the deployer and wrapped in a Stellar Asset Contract.
#   DEPOSIT_CAP        Lending deposit cap in stroops       (default: 100,000 units)
#   INTEREST_RATE      Borrower APR scaled by 1e7            (default: 500000 = 5%)
#   REWARD_RATE        Staking APR scaled by 1e7             (default: 1000000 = 10%)
#   MIN_STAKE          Minimum stake in stroops              (default: 1 unit)
#   MAX_STAKE          Maximum stake in stroops              (default: 1,000,000 units)
#   COOLDOWN_SECONDS   Unstake cooldown                      (default: 1814400 = 21 days)
#
# The script never prints or writes secret keys. Keys live in the Stellar CLI
# config directory (~/.config/stellar by default), which is outside this repo.

set -euo pipefail

NETWORK="testnet"
UNIT=10000000
IDENTITY="${STELLAR_IDENTITY:-ndi-deployer}"
DEPOSIT_CAP="${DEPOSIT_CAP:-$((100000 * UNIT))}"
INTEREST_RATE="${INTEREST_RATE:-500000}"
REWARD_RATE="${REWARD_RATE:-1000000}"
MIN_STAKE="${MIN_STAKE:-${UNIT}}"
MAX_STAKE="${MAX_STAKE:-$((1000000 * UNIT))}"
COOLDOWN_SECONDS="${COOLDOWN_SECONDS:-1814400}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STELLAR_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WASM_DIR="${STELLAR_DIR}/target/wasm32v1-none/release"
OUT_FILE="${STELLAR_DIR}/deployments/${NETWORK}.json"

log() { printf '==> %s\n' "$*" >&2; }

command -v stellar >/dev/null 2>&1 || {
  echo "error: the 'stellar' CLI is not installed. See stellar/README.md." >&2
  exit 1
}

# 1. Identity: reuse if it exists, otherwise generate. Only the public key is shown.
if stellar keys public-key "${IDENTITY}" >/dev/null 2>&1; then
  log "Reusing identity '${IDENTITY}'"
else
  log "Generating identity '${IDENTITY}'"
  stellar keys generate "${IDENTITY}" >/dev/null
fi
DEPLOYER="$(stellar keys public-key "${IDENTITY}")"
log "Deployer: ${DEPLOYER}"

# 2. Fund through Friendbot (safe to repeat).
log "Funding deployer with Friendbot"
stellar keys fund "${IDENTITY}" --network "${NETWORK}" >/dev/null 2>&1 \
  || log "Friendbot funding skipped (account probably already funded)"

# 3. Build all contracts.
log "Building contracts"
(cd "${STELLAR_DIR}" && stellar contract build >/dev/null)
for wasm in ndi_token ndi_lending ndi_staking; do
  [[ -f "${WASM_DIR}/${wasm}.wasm" ]] || { echo "error: missing ${wasm}.wasm" >&2; exit 1; }
done

deploy() {
  local wasm="$1"
  shift
  stellar contract deploy \
    --wasm "${WASM_DIR}/${wasm}.wasm" \
    --source-account "${IDENTITY}" \
    --network "${NETWORK}" \
    -- "$@"
}

# 4. Resolve the assets.
if [[ -n "${LENDING_ASSET_ID:-}" ]]; then
  LENDING_ASSET="${LENDING_ASSET_ID}"
else
  LENDING_ASSET="$(stellar contract id asset --asset native --network "${NETWORK}")"
fi
log "Lending asset: ${LENDING_ASSET}"

if [[ -n "${LP_TOKEN_ID:-}" ]]; then
  LP_TOKEN="${LP_TOKEN_ID}"
else
  LP_ASSET="NDILP:${DEPLOYER}"
  LP_TOKEN="$(stellar contract id asset --asset "${LP_ASSET}" --network "${NETWORK}")"
  log "Deploying placeholder LP token SAC for ${LP_ASSET} (testnet only)"
  stellar contract asset deploy --asset "${LP_ASSET}" \
    --source-account "${IDENTITY}" --network "${NETWORK}" >/dev/null 2>&1 \
    || log "Placeholder LP token SAC already deployed"
fi
log "LP token: ${LP_TOKEN}"

# 5. Deploy contracts with constructor arguments.
log "Deploying NdiToken"
NDI_TOKEN="$(deploy ndi_token --owner "${DEPLOYER}")"
log "NdiToken: ${NDI_TOKEN}"

log "Deploying NdiLending"
NDI_LENDING="$(deploy ndi_lending \
  --owner "${DEPLOYER}" \
  --asset "${LENDING_ASSET}" \
  --name "Ndi Lending Share" \
  --symbol "nLEND" \
  --deposit_cap "${DEPOSIT_CAP}" \
  --interest_rate "${INTEREST_RATE}")"
log "NdiLending: ${NDI_LENDING}"

log "Deploying NdiStaking"
NDI_STAKING="$(deploy ndi_staking \
  --owner "${DEPLOYER}" \
  --stake_token "${LP_TOKEN}" \
  --reward_token "${NDI_TOKEN}" \
  --reward_rate "${REWARD_RATE}" \
  --min_stake "${MIN_STAKE}" \
  --max_stake "${MAX_STAKE}" \
  --cooldown "${COOLDOWN_SECONDS}")"
log "NdiStaking: ${NDI_STAKING}"

# 6. Record the deployment (public data only).
mkdir -p "$(dirname "${OUT_FILE}")"
cat >"${OUT_FILE}" <<EOF
{
  "network": "${NETWORK}",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployer": "${DEPLOYER}",
  "contracts": {
    "ndi_token": "${NDI_TOKEN}",
    "ndi_lending": "${NDI_LENDING}",
    "ndi_staking": "${NDI_STAKING}"
  },
  "assets": {
    "lending_asset": "${LENDING_ASSET}",
    "lp_token": "${LP_TOKEN}"
  }
}
EOF
log "Wrote ${OUT_FILE}"
log "Next: fund the staking reward pool, e.g."
log "  stellar contract invoke --id ${NDI_STAKING} --source-account ${IDENTITY} --network ${NETWORK} -- fund_rewards --from ${DEPLOYER} --amount <stroops>"
