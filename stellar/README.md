# Ndi-Fi on Stellar (Soroban)

Rust/Soroban version of the Ndi-Fi protocol. It runs alongside the Solidity
contracts in `../src`, which are unchanged.

| Contract | Path | What it does |
|---|---|---|
| NdiToken | `contracts/ndi_token` | SEP-41 reward token (NDI): 1B cap, 7 decimals, owner minting and reward distribution, burn, pause, upgrade. |
| NdiLending | `contracts/ndi_lending` | Vault over a SEP-41 asset (XLM or USDC). Depositors get shares; one owner-approved borrower pays a fixed APR, which raises the share price. |
| NdiStaking | `contracts/ndi_staking` | Stake an LP token (e.g. a Soroswap pair), earn NDI at a fixed APR, unstake after a cooldown, or emergency-withdraw anytime. |

Design and mapping from Solidity: [`docs/stellar/ARCHITECTURE.md`](../docs/stellar/ARCHITECTURE.md)
and [`docs/stellar/MIGRATION.md`](../docs/stellar/MIGRATION.md).

## Versions

| Component | Version |
|---|---|
| Rust toolchain | 1.99.1 (pinned in `rust-toolchain.toml`) |
| WASM target | `wasm32v1-none` |
| `soroban-sdk` | 28.0.0 |
| OpenZeppelin `stellar-tokens`, `stellar-access`, `stellar-contract-utils`, `stellar-macros` | 0.8.0 |
| Stellar CLI | 28.1.0 (any 28.x should work) |

OpenZeppelin 0.8.0 requires `soroban-sdk ^28`, so `soroban-sdk` 29 cannot be used until OpenZeppelin releases a compatible version.

## Prerequisites

```bash
# Rust (reads rust-toolchain.toml and installs the target + components)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cd stellar && rustup toolchain install

# Stellar CLI
cargo install --locked stellar-cli
# or download a binary from https://github.com/stellar/stellar-cli/releases
```

## Build

```bash
cd stellar
stellar contract build
ls target/wasm32v1-none/release/*.wasm   # ndi_token, ndi_lending, ndi_staking
```

The release profile has `overflow-checks = true`.

## Test

```bash
cd stellar
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test                     # unit tests + tests/integration.rs
cargo test -p ndi-lending      # one contract
```

- Unit tests: `contracts/*/src/test.rs` (plus `ndi_lending/src/interest.rs`).
- Integration test: `tests/integration.rs` deploys all three contracts and runs
  deposit → accrue → withdraw and stake → claim → unstake.

## Deploy to testnet

```bash
./stellar/scripts/deploy_testnet.sh
cat stellar/deployments/testnet.json
```

The script:

1. Reuses or generates the CLI identity `ndi-deployer` (override with `STELLAR_IDENTITY`).
2. Funds it with Friendbot.
3. Runs `stellar contract build`.
4. Deploys NdiToken, NdiLending (native XLM by default) and NdiStaking with constructor arguments.
5. Writes contract IDs to `deployments/testnet.json`.

Override assets and parameters with environment variables (see the header of
`scripts/deploy_testnet.sh`), for example `LENDING_ASSET_ID` for testnet USDC or
`LP_TOKEN_ID` for a Soroswap pair. Without `LP_TOKEN_ID`, the script wraps a
testnet-only placeholder asset `NDILP` issued by the deployer.

The script never prints secret keys. Keys stay in the Stellar CLI config
directory, outside the repo. After deploying, fund the staking reward pool with
`fund_rewards` (the command is printed at the end).

## Units

- Amounts are `i128` in the token's smallest unit. NDI and SAC assets use 7 decimals: `10_000_000` = 1 token.
- Rates are annual and scaled by `1e7`: `1_000_000` = 10% APR, `10_000_000` = 100% (the maximum).

## Contributing

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) and the
[Stellar Wave Program](https://www.drips.network/wave/stellar).
Do not start work on an issue until a maintainer assigns it to you.
