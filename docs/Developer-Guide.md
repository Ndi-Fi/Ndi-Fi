# Ndi-Fi Developer Quickstart

Everything a new contributor needs to build, test and run Ndi-Fi locally: the
Foundry/Solidity contracts in `src/`, the Stellar/Soroban contracts in
`stellar/`, local Anvil and Stellar sandbox flows, and fixes for the errors
people hit most often.

> **Read [`CONTRIBUTING.md`](../CONTRIBUTING.md) first.** Do not start work on an
> issue until a maintainer assigns it. Every PR must include
> `Closes #<issue>`.

---

## Contents

- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Solidity (Foundry) quickstart](#solidity-foundry-quickstart)
- [Local Anvil quickstart](#local-anvil-quickstart)
- [Stellar (Soroban) quickstart](#stellar-soroban-quickstart)
- [Local Stellar sandbox](#local-stellar-sandbox)
- [Testnet deployment](#testnet-deployment)
- [CI checks](#ci-checks)
- [Troubleshooting](#troubleshooting)
- [Where to go next](#where-to-go-next)

---

## Repository layout

| Path | What it contains |
|---|---|
| `src/` | Solidity contracts: `NdiFiVault`, `NdiFiLending`, `NdiFiStaking`, `NdiPoint`, a mock DAI and an integration example. |
| `test/` | Foundry tests (`*.t.sol`). |
| `script/` | Foundry deployment scripts. Currently only `DeployNdiPoint.s.sol`. |
| `lib/` | Git submodules: OpenZeppelin, forge-std, Chainlink, Uniswap V3, PRBMath. |
| `stellar/contracts/` | Soroban crates: `ndi_token`, `ndi_lending`, `ndi_staking`. |
| `stellar/tests/` | Rust integration tests that deploy all three contracts together. |
| `stellar/scripts/` | Testnet deployment script. |
| `docs/stellar/` | Architecture and Solidity -> Soroban migration notes. |
| `docs/` | User-facing guides. The directory is gitignored, so new files here need `git add -f`. |

The Solidity and Stellar implementations are independent. Nothing in `src/`
imports the Rust contracts or vice versa.

---

## Prerequisites

| Tool | Version | Used for |
|---|---|---|
| Git | any recent | Cloning and submodules |
| [Foundry](https://book.getfoundry.sh/getting-started/installation) | 1.2.3 in CI | Solidity build, tests, Anvil, Cast |
| [rustup](https://rustup.rs) | reads `stellar/rust-toolchain.toml` | Rust 1.99.1, `rustfmt`, `clippy` |
| [Stellar CLI](https://github.com/stellar/stellar-cli/releases) | 28.x (CI uses 28.1.0) | Soroban build, deploy and invoke |
| Docker | any recent | Optional: local Stellar network |
| `jq` | optional | Reading `stellar/deployments/testnet.json` |

You do **not** need Node.js or a front end to build, test or deploy the
contracts.

---

## Solidity (Foundry) quickstart

### 1. Clone with submodules

The OpenZeppelin and forge-std imports live in `lib/` as git submodules. A plain
`git clone` leaves them empty.

```bash
git clone https://github.com/Ndi-Fi/Ndi-Fi.git
cd Ndi-Fi
git submodule update --init --recursive
```

### 2. Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge --version
```

If you already have Foundry, check the version. CI pins `1.2.3`; newer versions
usually work, but run `forge fmt` before opening a PR so formatting matches.

### 3. Build

```bash
forge build --sizes
```

`foundry.toml` uses `src/`, `out/` and `lib/`, and `remappings.txt` maps the
OpenZeppelin, Chainlink and forge-std imports. If imports fail, the submodules
from step 1 are missing.

### 4. Test

```bash
forge test -vvv
```

Run one suite while iterating:

```bash
forge test --match-contract NdiFiVaultTest -vvv
forge test --match-contract NdiPointTest -vvv
forge test --match-contract NdiFiStakingTest -vvv
```

Coverage of the lending contract is currently a placeholder
(`test/NdiFiLending.t.sol`). If you change `NdiFiLending`, add real tests with
the change.

### 5. Format

```bash
forge fmt --check   # check
forge fmt           # fix in place
```

### 6. Deploy `NdiPoint` locally or to a testnet

`script/DeployNdiPoint.s.sol` reads `PRIVATE_KEY` from the environment:

```bash
export RPC_URL=http://127.0.0.1:8545
export PRIVATE_KEY=0x...
forge script script/DeployNdiPoint.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast
```

The script deploys `NdiPoint(deployer)` and logs the address, supply and roles.
For a public network, add `--verify` and the explorer configuration.

> **Never commit a private key.** Use a throwaway Anvil key locally and a
> dedicated deployer key for testnets. `.env` is gitignored; there is no
> `.env.example` in the repository.

---

## Local Anvil quickstart

[Anvil](https://book.getfoundry.sh/anvil/) is Foundry's local Ethereum node. It
starts with funded accounts and no Chainlink feeds, so:

- `NdiPoint`, `NdiFiVault` and `NdiStaking` can be deployed from scratch;
- `NdiFiLending` needs a price feed, so use an Anvil fork of a network that has
  Chainlink feeds (see [Lending on a fork](#lending-on-a-fork)).

### 1. Start Anvil

In one terminal:

```bash
anvil
```

Anvil listens on `http://127.0.0.1:8545`. Its first account is:

```
Address:     0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Use that key only for local testing.

In a second terminal:

```bash
export RPC_URL=http://127.0.0.1:8545
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export DEPLOYER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

### 2. Deploy a test token and the vault

```bash
forge create src/testMockDai.sol:MockDAI \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast

export DAI=<printed MockDAI address>

forge create src/NdiFiVault.sol:NdiFiVault \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast \
  --constructor-args "$DAI" "$DEPLOYER"

export VAULT=<printed NdiFiVault address>
```

`MockDAI` mints 1,000,000 DAI to the deployer. It also exposes
`faucet(address,uint256)` if you need more.

### 3. Deploy the reward token

```bash
forge create src/NdiPoint.sol:NdiPoint \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast \
  --constructor-args "$DEPLOYER"

export NDI=<printed NdiPoint address>
```

### 4. Deploy staking

`NdiStaking` requires that the vault's asset equals the stake token. For a
minimal local setup, stake the same mock DAI held by the vault:

```bash
forge create src/NdiFiStaking.sol:NdiStaking \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast \
  --constructor-args \
  "$DAI" "$NDI" "$VAULT" "$DEPLOYER" \
  10 \
  1000000000000000000 \
  1000000000000000000000 \
  0

export STAKING=<printed NdiStaking address>
```

Constructor arguments, in order:

| Argument | Example | Meaning |
|---|---|---|
| `_stakeToken` | `$DAI` | Token users stake; must equal `vault.asset()`. |
| `_rewardToken` | `$NDI` | Token rewards are paid in. |
| `_vault` | `$VAULT` | ERC-4626 vault that receives the principal. |
| `initialOwner` | `$DEPLOYER` | Owner of the staking contract. |
| `_apy` | `10` | Whole-percent APY used by the linear reward formula. |
| `_minStake` | `1e18` | Minimum stake in token units. |
| `_maxStake` | `1000e18` | Maximum stake in token units. |
| `_minDuration` | `0` | Stored but not enforced in the current code. |

Fund the reward pool before anyone claims:

```bash
cast send "$NDI" "transfer(address,uint256)" "$STAKING" 1000000000000000000000 \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```

### 5. Try a vault + staking flow

```bash
# Approve and deposit 100 DAI into the vault.
cast send "$DAI" "approve(address,uint256)" "$VAULT" 100000000000000000000 \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
cast send "$VAULT" "deposit(uint256,address)" 100000000000000000000 "$DEPLOYER" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

# Stake 10 DAI.
cast send "$DAI" "approve(address,uint256)" "$STAKING" 10000000000000000000 \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
cast send "$STAKING" "stake(uint256)" 10000000000000000000 \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

# Advance time and claim.
cast rpc evm_increaseTime 2592000 --rpc-url "$RPC_URL"   # 30 days
cast rpc evm_mine --rpc-url "$RPC_URL"
cast send "$STAKING" "claimRewards()" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```

### Lending on a fork

`NdiFiLending` reads collateral and lending-token prices from Chainlink
`AggregatorV3Interface` feeds. There is no mock feed in the repository, and
Feeds on Anvil from scratch would return nothing. Run a fork of a network that
has the feeds you need:

```bash
anvil --fork-url "$RPC_URL"
```

Then deploy with the fork network's lending token, vault and feed addresses.
Example for Ethereum mainnet (verify the addresses on
[the Chainlink feed directory](https://docs.chain.link/data-feeds/price-feeds/addresses)
before using them):

```bash
# DAI, DAI/USD feed, WETH, ETH/USD feed on Ethereum mainnet.
export DAI=0x6B175474E89094C44Da98b954EedeAC495271d0F
export DAI_USD=0xAed0c38402a5d19df6E4c03F4E2Dced6e29c1ee9
export WETH=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
export WETH_USD=0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419

forge create src/NdiFiVault.sol:NdiFiVault \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast \
  --constructor-args "$DAI" "$DEPLOYER"
export VAULT=<printed address>

forge create src/NdiFiLending.sol:NdiFiLending \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast \
  --constructor-args "$DAI" "$VAULT" "$DAI_USD"
export LENDING=<printed address>

# collateralFactor=75%, liquidationThreshold=85%,
# originationFee=100 bps (1%), liquidationPenalty=500 bps (5%)
cast send "$LENDING" "initialize(uint256,uint256,uint256,uint256)" 75 85 100 500 \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

cast send "$LENDING" "addCollateralToken(address,address)" "$WETH" "$WETH_USD" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

# Let the lending contract pull liquidity from the vault.
cast send "$VAULT" "setAuthorizedLendingContract(address)" "$LENDING" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```

Now a user can approve the collateral token, call `depositCollateral`, and call
`takeLoan`. See [`docs/Lending-Guide.md`](Lending-Guide.md) for the exact flow
and numeric examples.

> Anvil fork state is in memory. Restarting Anvil discards every deployment and
> reverts the fork to the block you forked from.

---

## Stellar (Soroban) quickstart

All Stellar commands run from `stellar/`.

### 1. Install the pinned Rust toolchain

```bash
cd stellar
rustup toolchain install          # reads rust-toolchain.toml
rustc --version                   # 1.99.1
cargo --version
```

`rust-toolchain.toml` pins Rust `1.99.1`, installs `rustfmt` and `clippy`, and
adds the `wasm32v1-none` target. If you manage toolchains yourself:

```bash
rustup target add wasm32v1-none
```

### 2. Install the Stellar CLI

```bash
cargo install --locked stellar-cli
# or download a 28.x binary:
# https://github.com/stellar/stellar-cli/releases
stellar --version                 # 28.x
```

### 3. Build

```bash
stellar contract build
ls target/wasm32v1-none/release/*.wasm
```

You should see `ndi_token.wasm`, `ndi_lending.wasm` and `ndi_staking.wasm`.
The release profile enables `overflow-checks = true`.

### 4. Run the checks CI runs

```bash
cargo fmt --all --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
```

Run one crate while iterating:

```bash
cargo test -p ndi-token
cargo test -p ndi-lending
cargo test -p ndi-staking
cargo test -p ndi-fi-integration-tests
```

The integration test in `stellar/tests/integration.rs` deploys all three
contracts and runs:

1. deposit -> borrow -> accrue interest -> repay -> redeem with yield;
2. stake LP -> claim NDI -> request unstake -> cooldown -> unstake.

### 5. Dependency pinning

`stellar/Cargo.toml` pins `soroban-sdk =28.0.0` and the OpenZeppelin Stellar
crates `0.8.0`. OpenZeppelin `0.8.0` requires `soroban-sdk ^28`, so
`soroban-sdk` 29 does **not** work yet. Do not bump these versions in a feature
PR; dependency upgrades need their own issue and test run.

---

## Local Stellar sandbox

The sandbox lets you exercise the real WASM through RPC instead of the Rust test
environment.

### Option A: Stellar CLI + Docker

```bash
stellar container start local
stellar network ls                 # confirm a "local" network exists
stellar network use local
```

If the CLI did not register the network, add it manually:

```bash
stellar network add local \
  --rpc-url "http://localhost:8000/soroban/rpc" \
  --network-passphrase "Standalone Network ; February 2017"
stellar network use local
```

Create and fund a test identity:

```bash
stellar keys generate ndi-dev
stellar keys fund ndi-dev --network local
stellar keys public-key ndi-dev
```

Deploy the three contracts. The commands below mirror
`scripts/deploy_testnet.sh`, with `local` as the network and native XLM as the
lending asset:

```bash
export DEV=$(stellar keys public-key ndi-dev)
export WASM=target/wasm32v1-none/release

stellar contract build

export NDI_TOKEN=$(stellar contract deploy \
  --wasm "$WASM/ndi_token.wasm" \
  --source-account ndi-dev --network local \
  -- --owner "$DEV")

export LENDING_ASSET=$(stellar contract id asset --asset native --network local)

export NDI_LENDING=$(stellar contract deploy \
  --wasm "$WASM/ndi_lending.wasm" \
  --source-account ndi-dev --network local \
  -- --owner "$DEV" \
     --asset "$LENDING_ASSET" \
     --name "Ndi Lending Share" \
     --symbol "nLEND" \
     --deposit_cap 1000000000000 \
     --interest_rate 500000)

# A placeholder LP token, wrapped in a Stellar Asset Contract.
stellar contract asset deploy --asset "NDILP:$DEV" \
  --source-account ndi-dev --network local
export LP_TOKEN=$(stellar contract id asset --asset "NDILP:$DEV" --network local)

export NDI_STAKING=$(stellar contract deploy \
  --wasm "$WASM/ndi_staking.wasm" \
  --source-account ndi-dev --network local \
  -- --owner "$DEV" \
     --stake_token "$LP_TOKEN" \
     --reward_token "$NDI_TOKEN" \
     --reward_rate 1000000 \
     --min_stake 10000000 \
     --max_stake 10000000000000 \
     --cooldown 1814400)

printf 'token=%s\nlending=%s\nstaking=%s\n' "$NDI_TOKEN" "$NDI_LENDING" "$NDI_STAKING"
```

### Option B: plain Docker

```bash
docker run --rm -it -p 8000:8000 --name stellar \
  stellar/quickstart:testing \
  --local --enable-soroban-rpc
```

Then add the network as shown above. `http://localhost:8000` is Horizon;
Soroban RPC is under `/soroban/rpc`.

### Use the deployed contracts

Amounts are `i128` in the smallest unit. NDI and SAC assets use 7 decimals, so
`10_000_000` is one token. Rates are scaled by `1e7`: `1_000_000` = 10% APR.

```bash
# Fund the staking reward pool from the deployer's NDI balance.
stellar contract invoke --id "$NDI_STAKING" --source-account ndi-dev --network local \
  -- fund_rewards --from "$DEV" --amount 10000000000

# Deposit 10 XLM into the lending vault.
stellar contract invoke --id "$NDI_LENDING" --source-account ndi-dev --network local \
  -- deposit --assets 100000000 --receiver "$DEV" --from "$DEV" --operator "$DEV"

# Read state.
stellar contract invoke --id "$NDI_LENDING" --network local -- total_assets
stellar contract invoke --id "$NDI_LENDING" --network local -- available_liquidity
stellar contract invoke --id "$NDI_STAKING" --network local -- total_staked
```

The exact argument names are the Rust parameter names from
`stellar/contracts/*/src/contract.rs`. Use `stellar contract invoke --help` or
read the function docs when in doubt.

---

## Testnet deployment

```bash
./stellar/scripts/deploy_testnet.sh
cat stellar/deployments/testnet.json
```

The script:

1. reuses or creates the CLI identity `ndi-deployer`;
2. funds it through Friendbot;
3. builds all three WASMs;
4. deploys `NdiToken`, `NdiLending` (native XLM by default) and `NdiStaking`;
5. writes public contract IDs to `stellar/deployments/testnet.json`.

Override defaults with environment variables documented at the top of the
script:

| Variable | Default | Meaning |
|---|---|---|
| `STELLAR_IDENTITY` | `ndi-deployer` | CLI identity to deploy with. |
| `LENDING_ASSET_ID` | native XLM SAC | SEP-41 asset for the lending vault. |
| `LP_TOKEN_ID` | placeholder `NDILP` | SEP-41 LP token to stake. |
| `DEPOSIT_CAP` | 100,000 units | Lending deposit cap in stroops. |
| `INTEREST_RATE` | `500000` | Borrower APR (5%). |
| `REWARD_RATE` | `1000000` | Staking APR (10%). |
| `MIN_STAKE` | 1 unit | Minimum stake. |
| `MAX_STAKE` | 1,000,000 units | Maximum stake. |
| `COOLDOWN_SECONDS` | 1,814,400 | Unstake cooldown (21 days). |

Example with USDC and a real LP token:

```bash
LENDING_ASSET_ID=<usdc-sac-id> \
LP_TOKEN_ID=<soroswap-pair-id> \
./stellar/scripts/deploy_testnet.sh
```

The script never prints secret keys. Keys are stored in the Stellar CLI config
directory, outside the repository. Fund the staking reward pool after deploying;
the script prints the exact `fund_rewards` command.

---

## CI checks

Two workflows run on every PR:

**`.github/workflows/test.yml` (Foundry)**

```bash
forge fmt --check
forge build --sizes
forge test -vvv
```

Note: this workflow formats in place when the check fails (`forge fmt`), so a
formatting failure may not fail the job. Run `forge fmt --check` locally and
commit the result.

**`.github/workflows/stellar.yml` (Soroban, runs when `stellar/**` changes)**

```bash
cd stellar
cargo fmt --all --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
stellar contract build
```

Run all of these before opening a PR. Do not weaken tests, add
`#[allow(...)]` to silence Clippy, or skip a failing check to get a green PR.

---

## Troubleshooting

### `forge: command not found`

Foundry is not installed or `~/.foundry/bin` is not on `PATH`:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
export PATH="$HOME/.foundry/bin:$PATH"
```

### `Source ... not found` or OpenZeppelin imports fail

The git submodules are missing:

```bash
git submodule update --init --recursive
forge build
```

### `forge fmt --check` fails

```bash
forge fmt
git diff    # review the formatting-only changes
```

### Anvil: `Address already in use`

Another process (often a previous Anvil) owns port 8545:

```bash
anvil --port 8546
# then use --rpc-url http://127.0.0.1:8546
```

Or stop the old process. On Linux/macOS, `lsof -i :8545` finds it.

### Anvil: `nonce too low` or stale state after a restart

Anvil keeps state in memory. Restarting it resets nonces and deletes deployed
contracts. Restart Anvil, redeploy, and update your address variables. If a
wallet cached a nonce, reset the account in the wallet.

### `Contract not initialized`

`NdiFiLending` requires `initialize(collateralFactor, liquidationThreshold,
originationFeeRate, liquidationPenalty)` before deposits or loans. Only the
owner can call it, and it can be called once.

### `Insufficient vault liquidity`

The vault does not hold enough idle lending tokens. Deposit more into
`NdiFiVault`, or reduce the loan. In the current Solidity version, repayments
stay in `NdiFiLending` and do not automatically return to the vault.

### `Not authorized liquidator`

`liquidateLoan` is owner-only. Use the owner account. This is intentional in the
current version, not an Anvil bug.

### `EnforcedPause`

The owner paused the market or vault. Call `unpause()` (lending) or
`unpauseVault()` (vault) from the owner account. In the Solidity contract,
liquidation remains available while lending is paused, but repayment, deposits
and withdrawals are blocked. In Soroban `NdiLending`, `repay` stays open and
`emergency_withdraw` works only while paused.

### `Must repay full debt amount`

Repay exactly `principal + originationFee` from
`getLoanDetails(user).totalDebt`. Partial repayment is not supported.

### `OwnableUnauthorizedAccount`

You are not the contract owner. Check the owner with `owner()` (Foundry) or
`get_owner()` (Soroban). For `withdrawForLoan`, the caller must be the address
set by `setAuthorizedLendingContract`.

### Chainlink price read reverts or values look wrong

You are probably on a network where the configured feed does not exist, or the
feed decimals are not 8. `NdiFiLending` assumes 8-decimal feeds. Use an Anvil
fork of a network with the feeds, and verify every feed address on
[the Chainlink directory](https://docs.chain.link/data-feeds/price-feeds/addresses).

### `cargo: command not found`

Install Rust with rustup, then open a new shell:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

### `toolchain '1.99.1-...' is not installed`

Run this **inside `stellar/`** so rustup reads `rust-toolchain.toml`:

```bash
cd stellar
rustup toolchain install
```

### `can't find crate for core` or `target not found: wasm32v1-none`

The WASM target is missing:

```bash
rustup target add wasm32v1-none
```

### `stellar: command not found`

Install the Stellar CLI 28.x and ensure the install directory is on `PATH`:

```bash
cargo install --locked stellar-cli
stellar --version
```

A prebuilt binary from the
[releases page](https://github.com/stellar/stellar-cli/releases) is faster than
compiling.

### `stellar contract build` does not produce the WASM files

- Run it from `stellar/`, not the repository root.
- Confirm `stellar --version` is 28.x.
- Check `target/wasm32v1-none/release/`, not `target/release/`.
- If a crate fails to compile, scroll up: the build error is usually a missing
  target or an incompatible dependency version.

### `Cargo.lock` changes on every command

The workspace pins dependencies exactly. Do not commit unrelated
`Cargo.lock` churn. CI runs with `--locked`, so if you intentionally change a
dependency, update the lock in the same PR and explain why.

### Soroban errors: `Error(Contract, #N)`

Each contract has its own error enum; OpenZeppelin modules use higher ranges.
The Ndi-Fi codes are:

| Code | Lending (`LendingError`) | Staking (`StakingError`) | Token (`TokenError`) |
|---|---|---|---|
| 1 | `InvalidAmount` | `InvalidAmount` | `InvalidAmount` |
| 2 | `DepositCapExceeded` | `StakeOutOfRange` | `LengthMismatch` |
| 3 | `InsufficientShares` | `AlreadyStaked` | `EmptyBatch` |
| 4 | `InsufficientLiquidity` | `NoActiveStake` | `CannotRecoverSelf` |
| 5 | `ZeroShares` | `NoRewards` | `ExceedsMaxSupply` |
| 6 | `ZeroAssets` | `InsufficientRewardPool` | `MathOverflow` |
| 7 | `NoBorrower` | `UnstakeAlreadyRequested` | — |
| 8 | `DebtOutstanding` | `UnstakeNotRequested` | — |
| 9 | `NoDebt` | `CooldownNotElapsed` | — |
| 10 | `InvalidRate` | `InvalidConfig` | — |
| 11 | `InvalidCap` | `MathOverflow` | — |
| 12 | `MathOverflow` | — | — |

OpenZeppelin ranges used by these contracts:

| Range | Module |
|---|---|
| 100+ | Fungible token |
| 400+ | Vault |
| 1000+ | Pausable |
| 1500+ | Fixed-point math |
| 2100+ | Ownable |

Common examples:

- **Lending #4 `InsufficientLiquidity`** — too much is lent out. Wait for
  repayment or deposit more.
- **Lending #7 `NoBorrower`** — the owner has not called `set_borrower`.
- **Lending #8 `DebtOutstanding`** — repay all debt before changing borrower.
- **Staking #2 `StakeOutOfRange`** — outside `min_stake..=max_stake`.
- **Staking #3 `AlreadyStaked`** — one open stake per user; unstake first.
- **Staking #6 `InsufficientRewardPool`** — fund the pool with `fund_rewards`.
- **Staking #9 `CooldownNotElapsed`** — call `request_unstake`, wait, then
  `unstake`.
- **Token #5 `ExceedsMaxSupply`** — minting would pass the 1B cap.

### Testnet: `Account not found` or Friendbot fails

Fund the identity and retry:

```bash
stellar keys fund ndi-deployer --network testnet
```

The deploy script treats Friendbot failures as non-fatal because accounts are
often already funded. If the account really is missing, fund it manually before
deploying.

### I added a file under `docs/` but Git ignores it

The root `.gitignore` ignores `docs/`. Force-add new documentation:

```bash
git add -f docs/Lending-Guide.md docs/Developer-Guide.md
```

`docs/stellar/` is already tracked, so edits to existing files there work
normally; new files there need `-f` too.

### `wasm32v1-none` vs `wasm32-unknown-unknown`

Use `wasm32v1-none`. The repository's toolchain and CI expect it, and
`stellar contract build` writes to `target/wasm32v1-none/release/`.

---

## Where to go next

- [`docs/Lending-Guide.md`](Lending-Guide.md) — user flow for deposit, borrow,
  repay and liquidation.
- [`docs/stellar/ARCHITECTURE.md`](stellar/ARCHITECTURE.md) — Soroban design,
  storage, events and errors.
- [`docs/stellar/MIGRATION.md`](stellar/MIGRATION.md) — Solidity -> Soroban
  mapping and known Solidity issues.
- [`stellar/README.md`](../stellar/README.md) — Stellar versions, build and
  testnet deployment.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — branch names, commit style and PR
  checklist.
