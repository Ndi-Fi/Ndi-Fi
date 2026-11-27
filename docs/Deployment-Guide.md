# Ndi-Fi Ethereum Deployment Guide

This guide covers deploying the Ndi-Fi Solidity contracts to Sepolia testnet and Ethereum mainnet using Foundry's `forge script`.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Deployment Scripts](#deployment-scripts)
- [Deploying to Testnet (Sepolia)](#deploying-to-testnet-sepolia)
- [Deploying to Mainnet](#deploying-to-mainnet)
- [Post-Deploy Initialization](#post-deploy-initialization)
- [Contract Verification](#contract-verification)
- [Deployment Checklist](#deployment-checklist)

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Foundry | ≥ 1.2.3 | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Node.js | ≥ 18 | https://nodejs.org |

Confirm installation:

```bash
forge --version   # foundry 1.2.3 or later
cast --version
```

---

## Environment Setup

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

**Required variables for deployment:**

| Variable | Description |
|---|---|
| `PRIVATE_KEY` | Deployer private key (hex, with `0x` prefix) — **never commit a real key** |
| `ETH_RPC_URL` | JSON-RPC endpoint for the target network |
| `ETHERSCAN_API_KEY` | Etherscan API key — required for contract verification |
| `CHAIN_ID` | Chain ID (`11155111` = Sepolia, `1` = mainnet) |

**Key management:**

- For testnet use a dedicated throwaway key funded from the [Sepolia faucet](https://sepoliafaucet.com/).
- For mainnet use a hardware wallet via `--ledger` flag instead of `PRIVATE_KEY`.
- Never export a mainnet key into a `.env` file.

---

## Deployment Scripts

| Script | Purpose |
|---|---|
| `script/Deploy.s.sol` | Deploys core contracts: `NdiFiVault`, `NdiFiLending`, `NdiFiStaking`, `NdiPoint` |
| `script/SetupProtocol.s.sol` | Runs post-deploy initialization: sets collateral factors, liquidation thresholds, whitelists collateral tokens |
| `script/DeployNdiPoint.s.sol` | Standalone deployment of `NdiPoint` only |

---

## Deploying to Testnet (Sepolia)

### 1. Fund deployer

Request Sepolia ETH from https://sepoliafaucet.com using the address derived from your `PRIVATE_KEY`.

### 2. Dry-run (simulation)

```bash
source .env

forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$ETH_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --chain-id "$CHAIN_ID" \
  -vvvv
```

Inspect the output. If the simulation passes with no errors, proceed to broadcast.

### 3. Broadcast deployment

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$ETH_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --chain-id "$CHAIN_ID" \
  --broadcast \
  --verify \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  -vvvv
```

Foundry writes deployment artifacts to `broadcast/Deploy.s.sol/<chain_id>/run-latest.json`.

### 4. Record contract addresses

Copy the deployed addresses from the broadcast artifact into `.env`:

```dotenv
NDI_VAULT_ADDRESS=0x...
NDI_LENDING_ADDRESS=0x...
NDI_STAKING_ADDRESS=0x...
NDI_POINT_ADDRESS=0x...
```

---

## Deploying to Mainnet

> ⚠️ Mainnet deployments are irreversible. Run the full checklist below before broadcasting.

### Hardware wallet (recommended)

Use Foundry's Ledger integration instead of a raw private key:

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$ETH_RPC_URL" \
  --ledger \
  --hd-paths "m/44'/60'/0'/0/0" \
  --chain-id 1 \
  --broadcast \
  --verify \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  -vvvv
```

### Gas price

Always set an explicit gas price or use EIP-1559 options:

```bash
  --gas-price 20gwei
# or
  --priority-gas-price 2gwei
```

---

## Post-Deploy Initialization

After deployment, run `SetupProtocol.s.sol` to initialize protocol parameters:

```bash
forge script script/SetupProtocol.s.sol:SetupProtocol \
  --rpc-url "$ETH_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --chain-id "$CHAIN_ID" \
  --broadcast \
  -vvvv
```

**What it does:**

1. Calls `NdiFiLending.initialize()` with:
   - `collateralFactor` — e.g. `75` (75 %)
   - `liquidationThreshold` — e.g. `85` (85 %)
   - `originationFeeRate` — e.g. `50` (0.5 % in basis points)
   - `liquidationPenalty` — e.g. `500` (5 % in basis points)
2. Calls `addCollateralToken()` for each approved collateral asset and its Chainlink price feed.
3. Grants `MINTER_ROLE` and `REWARD_DISTRIBUTOR_ROLE` on `NdiPoint` to `NdiFiStaking`.

Verify initialization completed:

```bash
cast call "$NDI_LENDING_ADDRESS" "isInitialized()(bool)" --rpc-url "$ETH_RPC_URL"
# → true
```

---

## Contract Verification

If `--verify` was not passed during deployment, verify manually:

```bash
forge verify-contract \
  "$NDI_VAULT_ADDRESS" \
  "src/NdiFiVault.sol:NdiFiVault" \
  --chain-id "$CHAIN_ID" \
  --rpc-url "$ETH_RPC_URL" \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --watch
```

Repeat for each contract. Verification links appear in the Etherscan transaction pages.

You can also trigger the GitHub Actions workflow manually:
**Actions → Verify Solidity Contracts (Etherscan) → Run workflow**

---

## Deployment Checklist

### Pre-deploy

- [ ] All Forge tests pass: `forge test -vvv`
- [ ] `forge build --sizes` builds with no errors; check contract sizes are under 24 KB
- [ ] `forge fmt --check` passes (no unformatted code)
- [ ] `.env` configured with correct `ETH_RPC_URL`, `CHAIN_ID`, and `ETHERSCAN_API_KEY`
- [ ] Deployer account funded (check with `cast balance <address> --rpc-url $ETH_RPC_URL`)
- [ ] Dry-run simulation completed without errors
- [ ] Security review completed; `docs/AUDIT_READINESS.md` checklist verified

### Deployment

- [ ] `Deploy.s.sol` broadcast succeeded; `run-latest.json` artifact saved
- [ ] Contract addresses recorded in `.env` and in release notes
- [ ] All contracts verified on Etherscan

### Post-deploy

- [ ] `SetupProtocol.s.sol` broadcast succeeded
- [ ] `isInitialized()` returns `true`
- [ ] `collateralFactor` set to intended value: `cast call "$NDI_LENDING_ADDRESS" "collateralFactor()(uint256)"`
- [ ] At least one collateral token added and price feed functional
- [ ] `NdiFiStaking` has `REWARD_DISTRIBUTOR_ROLE` on `NdiPoint`
- [ ] Smoke test: deposit collateral, take a small loan, repay it
- [ ] Protocol monitoring active (see `docs/ORACLE.md` for price-feed health checks)
- [ ] Deployment summary posted in GitHub release notes
