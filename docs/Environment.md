# Environment Variables

This document lists every environment variable used across the Ndi-Fi project. It is the single source of truth for configuring local development, CI, and deployments.

> **Security note:** Never commit a file that contains real private keys, mnemonics, or API secrets. Use `.env.example` for templates and store real values in a secrets manager or CI secrets store.

---

## Solidity / Foundry stack

These variables are consumed by Foundry scripts in `script/` and by the test suite.

### Required for deployment

| Variable | Type | Default | Description |
|---|---|---|---|
| `PRIVATE_KEY` | hex string (0x-prefixed) | — | Deployer's private key. Required for all `forge script` deployments. |
| `RPC_URL` | URL | — | JSON-RPC endpoint of the target network (e.g. Alchemy or Infura URL). |
| `DAI_TOKEN_ADDRESS` | address | — | Address of the DAI (or mock DAI) ERC-20 token to use as the vault asset. |
| `INITIAL_OWNER` | address | — | Address that will own the deployed contracts. |

### Required for verification

| Variable | Type | Default | Description |
|---|---|---|---|
| `ETHERSCAN_API_KEY` | string | — | API key for Etherscan (or compatible explorer) contract verification. |

### Optional / lending-specific

| Variable | Type | Default | Description |
|---|---|---|---|
| `LENDING_TOKEN_PRICE_FEED` | address | — | Chainlink `AggregatorV3Interface` address for the lending token (DAI/USD). Required to deploy `NdiFiLending`. |
| `COLLATERAL_FACTOR` | uint256 (0-100) | `75` | Maximum LTV percentage at loan origination. |
| `LIQUIDATION_THRESHOLD` | uint256 (0-100) | `85` | LTV percentage at which a loan becomes liquidatable. Must be greater than `COLLATERAL_FACTOR`. |
| `ORIGINATION_FEE_RATE` | uint256 (basis points) | `50` | One-time fee charged when a loan is opened. Max 1 000 bp (10 %). |
| `LIQUIDATION_PENALTY` | uint256 (basis points) | `500` | Extra collateral seized as a penalty on liquidation. Max 2 000 bp (20 %). |

### Optional / staking-specific

| Variable | Type | Default | Description |
|---|---|---|---|
| `STAKE_TOKEN_ADDRESS` | address | — | Address of the ERC-20 token users stake. Must match the vault asset. |
| `REWARD_TOKEN_ADDRESS` | address | — | Address of the ERC-20 reward token (`NdiPoint`). |
| `APY` | uint256 | `15` | Annual percentage yield paid to stakers (whole-number percentage). |
| `MIN_STAKE` | uint256 (wei) | `10e18` | Minimum stake amount in token units. |
| `MAX_STAKE` | uint256 (wei) | `1000e18` | Maximum stake amount in token units. |
| `MIN_DURATION` | uint256 (seconds) | `20 days` | Minimum time a stake must be open before withdrawal can be requested. |

---

## Stellar / Soroban stack

These variables are consumed by scripts in `stellar/scripts/` and by the Soroban CLI during deployment.

### Required for deployment

| Variable | Type | Default | Description |
|---|---|---|---|
| `STELLAR_SECRET_KEY` | Stellar secret key (S…) | — | Deployer's Stellar secret key. Used by `stellar contract deploy`. |
| `STELLAR_NETWORK` | `testnet` \| `mainnet` \| `local` | `testnet` | Target Stellar network. |
| `STELLAR_RPC_URL` | URL | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint. Override for mainnet or local Stellar Quickstart. |
| `STELLAR_NETWORK_PASSPHRASE` | string | `Test SDF Network ; September 2015` | Network passphrase. Must match `STELLAR_NETWORK`. |

### Required for contract configuration

| Variable | Type | Default | Description |
|---|---|---|---|
| `NDI_TOKEN_OWNER` | Stellar address (G…) | — | Address granted owner rights over the deployed `NdiToken`. |
| `NDI_LENDING_OWNER` | Stellar address (G…) | — | Address granted owner rights over the deployed `NdiLending`. |
| `NDI_STAKING_OWNER` | Stellar address (G…) | — | Address granted owner rights over the deployed `NdiStaking`. |
| `VAULT_ASSET_ADDRESS` | contract ID | — | SEP-41 asset contract address used as the `NdiLending` vault asset (e.g. USDC or XLM SAC). |
| `LP_TOKEN_ADDRESS` | contract ID | — | SEP-41 LP token address staked in `NdiStaking`. |
| `REWARD_TOKEN_ADDRESS` | contract ID | — | Address of the deployed `NdiToken` contract, used as the staking reward token. |
| `DEPOSIT_CAP` | i128 (stroops) | — | Maximum total managed assets in the lending vault. |
| `INTEREST_RATE` | i128 (scaled by 1e7) | — | Annual interest rate for the lending borrower. `10_000_000` = 100 % APR. |
| `REWARD_RATE` | i128 (scaled by 1e7) | — | Annual reward rate for stakers. `10_000_000` = 100 % APR. |
| `MIN_STAKE` | i128 (stroops) | — | Minimum stake amount in token units (7 decimals). |
| `MAX_STAKE` | i128 (stroops) | — | Maximum stake amount in token units (7 decimals). |
| `COOLDOWN` | u64 (seconds) | `1_814_400` (21 days) | Seconds between `request_unstake` and `unstake`. |

### Optional

| Variable | Type | Default | Description |
|---|---|---|---|
| `STELLAR_ACCOUNT` | Stellar address (G…) | derived from `STELLAR_SECRET_KEY` | Explicit account address when you do not want to derive it from the key. |

---

## Security notes

- `PRIVATE_KEY` and `STELLAR_SECRET_KEY` must never appear in logs, error messages, or committed files. Store them in a secrets manager (e.g. AWS Secrets Manager, HashiCorp Vault) or CI secret variables.
- Rotate keys immediately if they are accidentally exposed.
- Use read-only RPC keys where possible to limit blast radius.
- Price feed addresses (`LENDING_TOKEN_PRICE_FEED`) should be double-checked against the official Chainlink docs before deployment to avoid oracle manipulation.

---

## `.env.example`

A template file at the repo root keeps the variable list in sync with this document. Copy it to `.env` before running scripts locally:

```sh
cp .env.example .env
# Then fill in real values in .env
```

The `.env.example` file ships with safe placeholder values (empty strings or documented defaults). The real `.env` file is listed in `.gitignore` and must never be committed.

---

## See also

- [Event Catalogue](EventCatalogue.md)
- [Glossary](Glossary.md)
- [Solidity quickstart](../README.md)
- [Stellar quickstart](../stellar/README.md)
