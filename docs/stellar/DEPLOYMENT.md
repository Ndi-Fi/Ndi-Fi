# Stellar Deployment Guide

This guide covers deploying the three Ndi-Fi Soroban contracts—`ndi_token`, `ndi_lending`, and `ndi_staking`—to Stellar testnet and mainnet, upgrading them, and transferring admin ownership.

---

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| Rust + `cargo` | 1.76 (see `stellar/rust-toolchain.toml`) | `rustup` |
| `wasm32v1-none` target | — | `rustup target add wasm32v1-none` |
| Stellar CLI (`stellar`) | 20.x | `cargo install stellar-cli --locked` |
| `jq` | any | system package manager |

The deploy script hard-fails with a clear error if `stellar` is not in `PATH`.

---

## Repository layout

```
stellar/
├── Cargo.toml                  # workspace
├── rust-toolchain.toml         # pinned toolchain
├── scripts/
│   └── deploy_testnet.sh       # one-command testnet deploy
├── deployments/
│   └── testnet.json            # written by deploy_testnet.sh
└── contracts/
    ├── ndi_token/
    ├── ndi_lending/
    └── ndi_staking/
```

---

## Testnet deployment

### Quick start

```bash
# From the repo root
./stellar/scripts/deploy_testnet.sh
```

The script:

1. Creates (or reuses) a Stellar CLI identity named `ndi-deployer`.
2. Funds it via Friendbot (safe to repeat; silently skips if already funded).
3. Builds all contracts with `stellar contract build`.
4. Deploys `ndi_token`, `ndi_lending`, and `ndi_staking` with constructor arguments.
5. Writes contract IDs and deployer information to `stellar/deployments/testnet.json`.
6. Prints the `fund_rewards` command you need to run before staking rewards work.

### Output file

After a successful deploy, `stellar/deployments/testnet.json` contains:

```json
{
  "network": "testnet",
  "deployed_at": "2025-01-15T10:30:00Z",
  "deployer": "GABCDE...",
  "contracts": {
    "ndi_token":   "CABC...",
    "ndi_lending": "CDEF...",
    "ndi_staking": "CGHI..."
  },
  "assets": {
    "lending_asset": "CJKL...",
    "lp_token":      "CMNO..."
  }
}
```

This file contains only public data (contract IDs and public keys). Secret keys are never written to disk by the script; they live in the Stellar CLI config directory (`~/.config/stellar` by default).

### Environment variable overrides

All defaults can be overridden without editing the script:

| Variable | Default | Description |
|---|---|---|
| `STELLAR_IDENTITY` | `ndi-deployer` | CLI identity name |
| `LENDING_ASSET_ID` | Native XLM SAC | SEP-41 asset for the lending vault |
| `LP_TOKEN_ID` | Testnet placeholder `NDILP` | SEP-41 LP token to stake |
| `DEPOSIT_CAP` | 100,000 units (in stroops) | Lending deposit cap |
| `INTEREST_RATE` | `500000` (5% APR) | Borrower APR, scaled by 1e7 |
| `REWARD_RATE` | `1000000` (10% APR) | Staking APR, scaled by 1e7 |
| `MIN_STAKE` | 1 unit | Minimum staking amount in stroops |
| `MAX_STAKE` | 1,000,000 units | Maximum staking amount in stroops |
| `COOLDOWN_SECONDS` | `1814400` (21 days) | Unstake cooldown |

**Rate scaling:** a rate of `1_000_000` means 10% APR (`1_000_000 / 10_000_000 = 10%`). The scale factor is 1e7, so 100% APR = `10_000_000`.

**Stroop conversion:** 1 unit = 10,000,000 stroops (Stellar uses 7 decimal places).

Example—deploy with a custom asset and 8% interest rate:

```bash
LENDING_ASSET_ID=CXYZ... \
INTEREST_RATE=800000 \
./stellar/scripts/deploy_testnet.sh
```

### Identities and funding

The Stellar CLI stores identities (key pairs) in `~/.config/stellar/identity/`. The script uses the identity name set in `STELLAR_IDENTITY` (default: `ndi-deployer`).

- If the identity does not exist, the script generates one automatically.
- It then calls Friendbot to fund the account with testnet XLM.
- Only the public key is printed to the console; the secret key is never displayed or logged.

To inspect the deployer's public key manually:

```bash
stellar keys public-key ndi-deployer
```

To list all identities:

```bash
stellar keys ls
```

---

## Funding the staking reward pool

After deployment, the staking contract starts with an empty reward pool. Users who stake will receive no rewards until it is funded. The deploy script prints the exact command:

```bash
stellar contract invoke \
  --id <NDI_STAKING_ID> \
  --source-account ndi-deployer \
  --network testnet \
  -- fund_rewards \
     --from <DEPLOYER_ADDRESS> \
     --amount <STROOPS>
```

Anyone can call `fund_rewards`; it is not restricted to the owner. The NDI token balance of the staking contract is the reward pool.

---

## Verifying a deployment

Check each contract is live and readable:

```bash
# NdiToken metadata
stellar contract invoke --id <NDI_TOKEN> \
  --source-account ndi-deployer --network testnet \
  -- name

# NdiToken supply
stellar contract invoke --id <NDI_TOKEN> \
  --source-account ndi-deployer --network testnet \
  -- total_supply

# NdiLending deposit cap
stellar contract invoke --id <NDI_LENDING> \
  --source-account ndi-deployer --network testnet \
  -- deposit_cap

# NdiStaking config
stellar contract invoke --id <NDI_STAKING> \
  --source-account ndi-deployer --network testnet \
  -- config
```

---

## Mainnet deployment checklist

Do not run the deploy script against mainnet without completing every item on this checklist.

### Before deploying

- [ ] All three contracts are tested with `cargo test` in the workspace.
- [ ] An external security audit has been completed or is in progress; findings are addressed.
- [ ] The deployer identity is backed by a hardware wallet (Ledger or similar). Never use a hot key for mainnet.
- [ ] The initial owner address is a multi-signature account. The deployer should transfer ownership immediately after deployment (see [Admin transfer](#admin-transfer)).
- [ ] `DEPOSIT_CAP`, `INTEREST_RATE`, `REWARD_RATE`, `COOLDOWN_SECONDS` have been reviewed by the team and reflect the intended launch parameters.
- [ ] `LENDING_ASSET_ID` and `LP_TOKEN_ID` are confirmed mainnet contract addresses.
- [ ] The reward pool top-up amount is calculated and held ready.
- [ ] A monitoring setup (Horizon event subscription or similar) is in place for `Borrowed`, `Repaid`, `Staked`, and `Unstaked` events.

### Deploying

```bash
STELLAR_IDENTITY=ndi-mainnet-deployer \
LENDING_ASSET_ID=<MAINNET_ASSET_SAC> \
LP_TOKEN_ID=<MAINNET_LP_SAC> \
DEPOSIT_CAP=<MAINNET_CAP> \
INTEREST_RATE=<MAINNET_RATE> \
REWARD_RATE=<MAINNET_REWARD_RATE> \
./stellar/scripts/deploy_testnet.sh
```

> The script's `NETWORK` variable is hard-coded to `testnet`. Before a mainnet deployment, change line `NETWORK="testnet"` to `NETWORK="mainnet"` in a copy of the script, or pass it as an environment variable if you have patched the script to support it.

### After deploying

- [ ] Record all contract IDs from the output JSON.
- [ ] Transfer ownership on all three contracts (see [Admin transfer](#admin-transfer)).
- [ ] Fund the reward pool.
- [ ] Verify at least one deposit, borrow, and stake via the app before announcing.
- [ ] Publish the deployment JSON (without private keys) to the repository.

---

## Upgrading contracts

All three contracts implement the `Upgradeable` trait, which exposes:

```
upgrade(new_wasm_hash: BytesN<32>, operator: Address)
```

Only the contract owner can call `upgrade`. The upgrade replaces the contract's WASM bytecode atomically; storage is preserved.

### Upload new WASM

Build the updated contract and upload it to the network. `stellar contract upload` returns a 32-byte hash:

```bash
# Build
stellar contract build

# Upload (do not deploy)
NEW_HASH=$(stellar contract upload \
  --wasm stellar/target/wasm32v1-none/release/ndi_token.wasm \
  --source-account ndi-deployer \
  --network testnet)

echo "New WASM hash: $NEW_HASH"
```

### Apply the upgrade

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source-account ndi-deployer \
  --network testnet \
  -- upgrade \
     --new_wasm_hash "$NEW_HASH" \
     --operator <OWNER_ADDRESS>
```

Replace `<CONTRACT_ID>` with the address of the contract you are upgrading (`ndi_token`, `ndi_lending`, or `ndi_staking`).

### Storage compatibility

Before upgrading, verify that the new WASM is compatible with the existing on-chain storage layout. Breaking changes to `#[contracttype]` data structures or `DataKey` variants corrupt stored state. See [docs/UPGRADEABILITY.md](../UPGRADEABILITY.md) for the full storage layout guide.

---

## Admin transfer

After deployment, ownership sits with the deployer identity. Transfer it to a multi-signature account before any mainnet traffic.

```bash
# Transfer ownership on NdiToken
stellar contract invoke \
  --id <NDI_TOKEN> \
  --source-account ndi-deployer \
  --network testnet \
  -- transfer_ownership \
     --new_owner <MULTISIG_ADDRESS>

# Transfer ownership on NdiLending
stellar contract invoke \
  --id <NDI_LENDING> \
  --source-account ndi-deployer \
  --network testnet \
  -- transfer_ownership \
     --new_owner <MULTISIG_ADDRESS>

# Transfer ownership on NdiStaking
stellar contract invoke \
  --id <NDI_STAKING> \
  --source-account ndi-deployer \
  --network testnet \
  -- transfer_ownership \
     --new_owner <MULTISIG_ADDRESS>
```

The `transfer_ownership` function is provided by the `stellar_access::ownable` library. After this call, only `<MULTISIG_ADDRESS>` can call owner-only functions (`mint`, `pause`, `upgrade`, `set_borrower`, `set_interest_rate`, `set_deposit_cap`, `emergency_withdraw`).

Verify the new owner:

```bash
stellar contract invoke --id <CONTRACT_ID> \
  --source-account ndi-deployer --network testnet \
  -- owner
```

---

## Pausing and emergency procedures

All three contracts support pause/unpause via the owner:

```bash
# Pause NdiStaking
stellar contract invoke --id <NDI_STAKING> \
  --source-account ndi-deployer --network testnet \
  -- pause --caller <OWNER_ADDRESS>

# Unpause NdiStaking
stellar contract invoke --id <NDI_STAKING> \
  --source-account ndi-deployer --network testnet \
  -- unpause --caller <OWNER_ADDRESS>
```

While paused:

- **NdiToken**: transfers, burns, minting, and reward distribution are blocked.
- **NdiLending**: deposits, withdrawals, and borrows are blocked. `emergency_withdraw` (owner-only, while paused) drains idle assets to a recovery address.
- **NdiStaking**: `stake`, `claim`, `request_unstake`, and `unstake` are blocked. `emergency_withdraw` (user-callable, always open) returns principal without rewards.

---

## Troubleshooting

**`error: the 'stellar' CLI is not installed`**
Install the Stellar CLI: `cargo install stellar-cli --locked`

**`error: missing ndi_token.wasm`**
The build step failed. Run `cd stellar && stellar contract build` manually and check the Rust compiler output.

**Friendbot funding skipped**
The deployer account is already funded on testnet. This is expected on subsequent runs.

**`InsufficientLiquidity` when borrowing**
The lending vault has no deposited assets, or the borrower requested more than the idle balance. Deposit assets into the vault first.

**`InsufficientRewardPool` when claiming**
Fund the staking reward pool using `fund_rewards` before users stake.

**Contract invoke fails with `HostError: ContractError(1)`**
Error code 1 on NdiStaking is `InvalidAmount`; on NdiLending it is `InvalidAmount`; on NdiToken it is `InvalidAmount`. Check that the `--amount` argument is positive and in stroops (not in display units).

---

## Related documentation

- [Staking Guide](../Staking-Guide.md) — user-facing staking mechanics
- [Borrowing Guide](../Borrowing-Guide.md) — user-facing lending mechanics
- [NdiPoint Token Guide](../NdiPoint-Guide.md) — token roles and permit
- [Upgradeability Guide](../UPGRADEABILITY.md) — storage layout and upgrade safety
- [Local Stack](../LOCAL_STACK.md) — running the full stack locally with Docker
