# Running the Full Local Stack

This guide shows how to run all three subsystems of Ndi-Fi **simultaneously on one machine**:

| Subsystem | Runtime | Default port | What you get |
|---|---|---|---|
| **EVM contracts** | Foundry `anvil` | `8545` | Local Ethereum node with deployed NdiFiVault, NdiFiLending, NdiFiStaking, NdiPoint |
| **Stellar contracts** | `soroban-env` / in-process | *(tests only, no live RPC port)* | Soroban unit + integration tests via `cargo test` |
| **Frontend help UI** | Node.js HTTP server | `8080` | DeFi tooltip demo at [localhost:8080](http://localhost:8080) |
| **Shared web UI** | Python `http.server` | `8000` | Footer component preview at [localhost:8000/web/](http://localhost:8000/web/) |

> [!NOTE]
> The Stellar contracts run entirely inside the `soroban-sdk` test environment (no external node required locally). To deploy to an actual Stellar network you need Stellar CLI + Friendbot access — see [Deploy to Testnet](#6-deploy-to-testnet-stellar) below.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start — All Subsystems at Once](#quick-start--all-subsystems-at-once)
- [Docker Compose Stack (`backend` + `frontend`)](#docker-compose-stack-backend--frontend)
- [1. EVM Stack: anvil + Forge](#1-evm-stack-anvil--forge)
  - [1.1 Start anvil](#11-start-anvil)
  - [1.2 Deploy contracts to anvil](#12-deploy-contracts-to-anvil)
  - [1.3 Run the Foundry test suite](#13-run-the-foundry-test-suite)
- [2. Stellar / Soroban Stack](#2-stellar--soroban-stack)
  - [2.1 Build all WASM contracts](#21-build-all-wasm-contracts)
  - [2.2 Run the full test suite](#22-run-the-full-test-suite)
- [3. Frontend Help UI](#3-frontend-help-ui)
- [4. Shared Web UI (Footer Preview)](#4-shared-web-ui-footer-preview)
- [5. Ports and Environment Variables Reference](#5-ports-and-environment-variables-reference)
- [6. Deploy to Testnet (Stellar)](#6-deploy-to-testnet-stellar)
- [7. Troubleshooting Common Issues](#7-troubleshooting-common-issues)

---

## Prerequisites

Install the tools for the subsystems you want to run. You do **not** need everything to work on a single subsystem.

| Tool | Minimum version | Install |
|---|---|---|
| **Git** | 2.x | `https://git-scm.com` |
| **Rust + Cargo** | 1.99.1 (pinned) | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Stellar CLI** | 28.x | `cargo install --locked stellar-cli` |
| **Foundry** (`forge`, `anvil`, `cast`) | 1.2.3+ | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| **Node.js** | 18 or 20 | `https://nodejs.org` |
| **Python 3** | 3.8+ | `https://python.org` *(usually pre-installed)* |

**Clone and bootstrap:**

```bash
git clone https://github.com/Ndi-Fi/Ndi-Fi.git
cd Ndi-Fi
git submodule update --init --recursive   # Foundry / OpenZeppelin Solidity deps

# Pin the Rust toolchain (reads stellar/rust-toolchain.toml)
cd stellar && rustup toolchain install && cd ..
```

---

## Quick Start — All Subsystems at Once

A convenience script starts all long-running processes in the background and runs the full test suites:

```bash
./scripts/dev-local.sh
```

**What it does:**
1. Runs `cargo fmt --all --check` and `cargo clippy` for the Stellar contracts.
2. Runs `cargo test` (Stellar unit + integration tests).
3. Starts `anvil` on port `8545` (background, PID saved to `.local-pids`).
4. Deploys all Solidity contracts to `anvil` using `forge script`.
5. Runs `forge test` against the local node.
6. Starts the frontend help UI on port `8080` (background).
7. Starts the web footer preview on port `8000` (background).
8. Prints a summary of running services and their URLs.

**Stopping everything:**

```bash
./scripts/dev-local.sh stop
# or manually:
kill $(cat .local-pids)
rm .local-pids
```

> [!TIP]
> Prefer running individual subsystems during focused development. The all-in-one script is most useful for integration checks before opening a PR.

---

## Docker Compose Stack (`backend` + `frontend`)

Ndi-Fi provides a [`docker-compose.yml`](../docker-compose.yml) configuration that orchestrates the EVM backend and frontend services containerized with Docker.

### 1. Configuration & `.env` Setup

Both the `backend` and `frontend` services consume variables via the `env_file: .env` directive in `docker-compose.yml`:

```bash
# 1. Copy the validated template to .env
cp .env.example .env

# 2. (Optional) Run build-time validation locally before starting containers
node scripts/validate-env.js --check-example
```

> [!IMPORTANT]
> The `env_file: .env` directive in `docker-compose.yml` ensures that:
> - **Backend service** receives EVM node parameters (`ETH_RPC_URL`, `ANVIL_PORT`, `CHAIN_ID`, `PRIVATE_KEY`).
> - **Frontend service** receives `NEXT_PUBLIC_*` variables for client-side contract addresses and RPC endpoints, plus `PORT` and `NODE_ENV`.
> - **Build-time validation** in both `Dockerfile.backend` and `Dockerfile.frontend` executes `node ./scripts/validate-env.js --check-example` during `docker build`, preventing builds if `.env.example` has syntax errors, duplicate keys, or missing required variables.

### 2. Docker Compose Commands

```bash
# Build and start all services in the background
docker-compose up -d --build

# View container status and health
docker-compose ps

# Stream logs from all services (or specify backend/frontend)
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop and remove containers and local bridge networks
docker-compose down
```

### 3. Service Endpoints

| Container | Internal Port | Host Port | Health Check |
|---|---|---|---|
| `ndifi-backend` (Anvil EVM) | `8545` | `http://localhost:8545` | JSON-RPC `eth_chainId` |
| `ndifi-frontend` (Help UI) | `3000` | `http://localhost:3000` | HTTP GET `/` |

---

## 1. EVM Stack: anvil + Forge

### 1.1 Start anvil

[`anvil`](https://book.getfoundry.sh/reference/anvil/) is Foundry's local Ethereum node. It pre-funds 10 deterministic accounts and mines blocks on demand.

```bash
anvil --host 0.0.0.0 --port 8545
```

**Key anvil flags:**

| Flag | Default | Purpose |
|---|---|---|
| `--host` | `127.0.0.1` | Bind address. Use `0.0.0.0` to reach from other containers. |
| `--port` | `8545` | JSON-RPC port. Set `ANVIL_PORT` env var to override in scripts. |
| `--chain-id` | `31337` | Local chain ID expected by Foundry scripts. |
| `--accounts` | `10` | Number of funded test accounts. |
| `--balance` | `10000` | ETH balance per account (in ETH). |
| `--block-time` | *(on-demand)* | Add `--block-time 1` to auto-mine every second. |

Leave this terminal open or run with `anvil --port 8545 &`.

### 1.2 Deploy contracts to anvil

```bash
# From the repo root:
forge script script/Deploy.s.sol \
  --rpc-url http://localhost:8545 \
  --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

> [!NOTE]
> `0xac0974...` is the **first** default anvil private key. It is public and safe for local dev only — never use it on any real network.

After deployment, Foundry writes addresses to `broadcast/Deploy.s.sol/31337/run-latest.json`. Load them into your environment:

```bash
export NDI_VAULT=$(jq -r '.transactions[] | select(.contractName=="NdiFiVault") | .contractAddress' \
  broadcast/Deploy.s.sol/31337/run-latest.json)
export NDI_LENDING=$(jq -r '.transactions[] | select(.contractName=="NdiFiLending") | .contractAddress' \
  broadcast/Deploy.s.sol/31337/run-latest.json)
export NDI_STAKING=$(jq -r '.transactions[] | select(.contractName=="NdiFiStaking") | .contractAddress' \
  broadcast/Deploy.s.sol/31337/run-latest.json)
export NDI_POINT=$(jq -r '.transactions[] | select(.contractName=="NdiPoint") | .contractAddress' \
  broadcast/Deploy.s.sol/31337/run-latest.json)

echo "NdiFiVault:   $NDI_VAULT"
echo "NdiFiLending: $NDI_LENDING"
echo "NdiFiStaking: $NDI_STAKING"
echo "NdiPoint:     $NDI_POINT"
```

**Interacting with contracts via `cast`:**

```bash
# Check DAI balance of the vault (replace address as needed)
cast call $NDI_VAULT "totalAssets()" --rpc-url http://localhost:8545

# Deposit 100 DAI (requires prior ERC-20 approval)
cast send $NDI_VAULT "deposit(uint256,address)" 100ether 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 1.3 Run the Foundry test suite

```bash
forge fmt --check         # format check
forge build --sizes       # compile & print contract sizes
forge test -vvv           # run all tests with verbose output
```

The test suite does **not** require a running `anvil` — Forge spins up its own in-process EVM.

---

## 2. Stellar / Soroban Stack

Soroban contracts compile to WASM and run inside the `soroban-sdk` test environment. No external Stellar node is needed for local development.

### 2.1 Build all WASM contracts

```bash
cd stellar
stellar contract build
```

Output WASMs land in `stellar/target/wasm32v1-none/release/`:

```
ndi_token.wasm
ndi_lending.wasm
ndi_staking.wasm
```

### 2.2 Run the full test suite

```bash
cd stellar

# Format check
cargo fmt --all --check

# Lint — warnings are errors
cargo clippy --all-targets -- -D warnings

# Unit tests (contracts/*/src/test.rs) + integration (tests/integration.rs)
cargo test

# Single contract
cargo test -p ndi-token
cargo test -p ndi-lending
cargo test -p ndi-staking
```

**Key version pins** (from `stellar/rust-toolchain.toml` and `Cargo.toml`):

| Component | Pinned version |
|---|---|
| Rust toolchain | `1.99.1` |
| WASM target | `wasm32v1-none` |
| `soroban-sdk` | `28.0.0` |
| OpenZeppelin Stellar | `0.8.0` (`stellar-tokens`, `stellar-access`, `stellar-contract-utils`, `stellar-macros`) |
| Stellar CLI | `28.1.x` |

> [!IMPORTANT]
> `soroban-sdk 29.x` is **not compatible** with OpenZeppelin Stellar `0.8.0`. Do not upgrade either independently until a compatible pairing is released.

---

## 3. Frontend Help UI

The DeFi tooltip and inline-help system is a dependency-free web component package.

```bash
cd frontend
npm test          # run the Node.js test suite (no browser required)
npm run demo      # start dev server on http://localhost:8080
```

The demo server (`frontend/scripts/serve.js`) respects the `PORT` environment variable:

```bash
PORT=9090 npm run demo   # serve on http://localhost:9090 instead
```

---

## 4. Shared Web UI (Footer Preview)

```bash
cd web
npm test                           # run footer config tests
python3 -m http.server 8000        # serve from repo root on port 8000
```

Open [http://localhost:8000/web/index.html](http://localhost:8000/web/index.html) in your browser to preview the shared footer component.

> [!TIP]
> You can also use `npx serve` or any other static server. The footer is a plain ES module with no build step.

---

## 5. Ports and Environment Variables Reference

### Ports

| Service | Default port | Override |
|---|---|---|
| Anvil (EVM JSON-RPC) | `8545` | `anvil --port <n>` |
| Frontend help demo | `8080` | `PORT=<n> npm run demo` |
| Web footer preview | `8000` | `python3 -m http.server <n>` |

All three can run simultaneously on the same machine with no port conflicts.

### Foundry / EVM Environment Variables

| Variable | Description | Example |
|---|---|---|
| `FOUNDRY_PROFILE` | Foundry config profile | `ci` (used in CI), default is `default` |
| `ETH_RPC_URL` | Default RPC for `cast` and `forge script` | `http://localhost:8545` |
| `PRIVATE_KEY` | Deployer private key for scripts | `0xac0974bec...` *(anvil key #0)* |
| `ETHERSCAN_API_KEY` | Required only for `forge verify-contract` | see `.env.example` |

Create a `.env` file at the repo root (it is git-ignored) and source it:

```bash
cp .env.example .env   # if .env.example exists
source .env
```

### Stellar / Soroban Environment Variables

| Variable | Description | Default |
|---|---|---|
| `STELLAR_IDENTITY` | CLI identity name used by deploy script | `ndi-deployer` |
| `LENDING_ASSET_ID` | SEP-41 contract ID for the lending asset | XLM native SAC |
| `LP_TOKEN_ID` | SEP-41 LP token contract ID | Placeholder `NDILP` SAC |
| `DEPOSIT_CAP` | Lending deposit cap (stroops) | `1_000_000_000_000` (100,000 tokens) |
| `INTEREST_RATE` | Borrower APR × 1e7 | `500000` (5%) |
| `REWARD_RATE` | Staking APR × 1e7 | `1000000` (10%) |
| `COOLDOWN_SECONDS` | Unstake cooldown | `1814400` (21 days) |
| `CARGO_TERM_COLOR` | Cargo output colouring | `always` (CI), `auto` (local) |

### Frontend Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port for the frontend help UI demo server | `8080` |

---

## 6. Deploy to Testnet (Stellar)

Deploying to Stellar Testnet requires Stellar CLI and internet access (Friendbot):

```bash
# From the repo root:
./stellar/scripts/deploy_testnet.sh

# Check deployed addresses:
cat stellar/deployments/testnet.json
```

The script automatically:
1. Creates or reuses a local CLI identity (`ndi-deployer` by default).
2. Funds it via Friendbot.
3. Builds all WASM contracts.
4. Deploys NdiToken, NdiLending, and NdiStaking with constructor arguments.
5. Writes contract IDs to `stellar/deployments/testnet.json`.

**Override identity and parameters:**

```bash
STELLAR_IDENTITY=my-dev-key \
INTEREST_RATE=1000000 \
REWARD_RATE=2000000 \
  ./stellar/scripts/deploy_testnet.sh
```

**After deployment, seed the staking reward pool:**

```bash
NDI_STAKING=$(jq -r '.contracts.ndi_staking' stellar/deployments/testnet.json)
NDI_TOKEN=$(jq -r '.contracts.ndi_token' stellar/deployments/testnet.json)
IDENTITY=ndi-deployer

stellar contract invoke \
  --id "$NDI_STAKING" \
  --source-account "$IDENTITY" \
  --network testnet \
  -- fund_rewards \
  --from "$(stellar keys public-key $IDENTITY)" \
  --amount 1000000000  # 100 NDI (7 decimals)
```

---

## 7. Troubleshooting Common Issues

### EVM / Foundry

| Symptom | Likely cause | Fix |
|---|---|---|
| `forge: command not found` | Foundry not installed or not on `$PATH` | Run `foundryup` and add `~/.foundry/bin` to `$PATH` |
| `forge test` fails with `missing submodule` | Submodules not initialised | `git submodule update --init --recursive` |
| `Error: could not detect network` | anvil not running | Start `anvil` in a separate terminal first |
| `forge script` exits with `revert` | Constructor or approval missing | Check `script/Deploy.s.sol` — it may need a DAI mint step first |
| Port `8545` already in use | Another node or process is running | `lsof -i :8545` then kill the PID, or use `--port 8546` |
| `forge fmt --check` fails | Code is not formatted | Run `forge fmt` (without `--check`) to auto-fix |

### Stellar / Soroban

| Symptom | Likely cause | Fix |
|---|---|---|
| `rustup toolchain install` errors | Rustup not installed or missing network | Install from `https://rustup.rs`; check VPN/proxy settings |
| `error: could not create temp file … Access is denied` | Rustup temp directory permission issue on Windows | Run rustup from a user-owned directory; check antivirus exclusions |
| `cargo test` fails with `InsufficientLiquidity` | Test expects non-zero liquidity but pool is empty | Ensure `fund_rewards` or `deposit` is called before `borrow`/`claim` in test order |
| `stellar: command not found` | Stellar CLI not installed | `cargo install --locked stellar-cli` |
| `stellar contract build` says `wasm32v1-none` missing | WASM target not installed | `rustup target add wasm32v1-none` |
| `cargo clippy` reports warnings as errors | Clippy lint | Fix the lint or document why it is acceptable; do not `allow` without a comment |
| Testnet deploy fails with `Account not found` | Account not funded | Friendbot may be rate-limited; wait 60 s and retry, or use a different identity |
| `deployments/testnet.json` has stale IDs | Redeployed without updating the file | The script overwrites the file on each run; check `git diff` before committing |
| `soroban-sdk 29.x` compile error | Wrong SDK version selected | Do not upgrade `soroban-sdk` above `28.x` until OZ Stellar `0.9+` ships |

### Frontend / Web

| Symptom | Likely cause | Fix |
|---|---|---|
| `node --test` fails with `SyntaxError` | Node.js < 18 | Upgrade Node.js: `https://nodejs.org` |
| `npm test` exits with `Cannot find module` | Dependencies not installed | Run `npm install` in `frontend/` or `web/` |
| Port `8080` already in use | Another process occupies the port | `PORT=9090 npm run demo` |
| Footer links resolve to `undefined` | `base-url` attribute missing on `<ndi-footer>` | Set `base-url` to the correct repo path prefix |
| `python3 -m http.server` shows blank page | Serving from wrong directory | Run from the **repo root**, not from `web/`; URL is `localhost:8000/web/index.html` |

### Cross-Stack & Docker Issues

| Symptom | Cause | Fix |
|---|---|---|
| Ports `8545`, `8080`, and `8000` all conflict | Multiple dev sessions open | Use `./scripts/dev-local.sh stop` to kill all managed processes |
| Backend container ignores `.env` values | Missing `env_file: .env` directive in `docker-compose.yml` | Ensure `env_file: - .env` is declared under `backend` in `docker-compose.yml` |
| Frontend container cannot read `NEXT_PUBLIC_*` | `.env` variables not prefixed or not passed to container | Ensure variables begin with `NEXT_PUBLIC_` and `env_file: .env` is present under `frontend` |
| `docker build` fails at validation step | `.env.example` has syntax errors, duplicates, or missing required keys | Run `node scripts/validate-env.js --check-example` locally to inspect errors |
| `.env` variables not picked up in local shell | Shell did not source the file | Run `source .env` or prefix commands: `env $(cat .env) forge test` |
| Pre-commit hook fails on `forge fmt` | Foundry not installed at hook time | Install Foundry globally or use `SKIP=forge-fmt git commit` for one-off commits |
| Pre-commit hook fails on `cargo fmt` | Rust not installed at hook time | Install Rust or use `SKIP=cargo-fmt git commit` |
| `git add -f docs/ONBOARDING.md` permission error | Sandbox restriction on `.git/index` | Run `git add` in a regular terminal outside the agent sandbox |

---

## See Also

- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — workflow, branch naming, commit conventions
- [`DEVELOPMENT.md`](../DEVELOPMENT.md) — pre-commit hooks and format/lint reference
- [`docs/ONBOARDING.md`](ONBOARDING.md) — environment setup for first-time contributors
- [`stellar/README.md`](../stellar/README.md) — Stellar/Soroban build, test, and deploy reference
- [`docs/stellar/ARCHITECTURE.md`](stellar/ARCHITECTURE.md) — contract design and storage layout
- [`docs/UPGRADEABILITY.md`](UPGRADEABILITY.md) — upgrade procedures for both stacks
- [`docs/AUDIT_READINESS.md`](AUDIT_READINESS.md) — pre-audit checklist and CI parity guide
