# Protocol Incident Runbook

This runbook covers pausing contracts, performing upgrades, transferring admin roles, and handling incidents. It is written for operators with owner-level access to the deployed contracts.

---

## Prerequisites

- Stellar CLI `28.1.0` installed and on `$PATH`
- Owner identity loaded: `stellar keys ls` should show the owner key
- Deployment addresses available in `stellar/deployments/testnet.json` (or the relevant network file)
- Local clone up to date: `git pull upstream main`

Set environment variables for the session:

```bash
export NETWORK=testnet
export RPC_URL=https://soroban-testnet.stellar.org
export NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Load contract IDs from the deployment file
export TOKEN_ID=$(jq -r '.ndi_token' stellar/deployments/testnet.json)
export LENDING_ID=$(jq -r '.ndi_lending' stellar/deployments/testnet.json)
export STAKING_ID=$(jq -r '.ndi_staking' stellar/deployments/testnet.json)
```

---

## Pausing and unpausing contracts

All three Ndi-Fi contracts (`NdiToken`, `NdiLending`, `NdiStaking`) expose `pause` and `unpause`. Only the owner can call them.

### Pause a contract

```bash
# Pause NdiLending
stellar contract invoke \
  --id "$LENDING_ID" \
  --source owner \
  --network "$NETWORK" \
  -- pause \
  --caller "$OWNER_ADDRESS"

# Pause NdiStaking
stellar contract invoke \
  --id "$STAKING_ID" \
  --source owner \
  --network "$NETWORK" \
  -- pause \
  --caller "$OWNER_ADDRESS"

# Pause NdiToken
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source owner \
  --network "$NETWORK" \
  -- pause \
  --caller "$OWNER_ADDRESS"
```

**Effect of pausing:**

| Contract | What is blocked | What still works |
|---|---|---|
| `NdiToken` | `transfer`, `transfer_from`, `approve`, `burn`, `burn_from`, `mint` | Reads (`balance`, `total_supply`, …) |
| `NdiLending` | `deposit`, `mint`, `withdraw`, `redeem`, `borrow` | `repay`, reads |
| `NdiStaking` | `stake`, `claim`, `request_unstake`, `unstake` | `emergency_withdraw`, reads |

### Check whether a contract is paused

```bash
stellar contract invoke \
  --id "$LENDING_ID" \
  --source owner \
  --network "$NETWORK" \
  -- paused
```

### Unpause a contract

```bash
stellar contract invoke \
  --id "$LENDING_ID" \
  --source owner \
  --network "$NETWORK" \
  -- unpause \
  --caller "$OWNER_ADDRESS"
```

---

## Emergency withdrawal

Use `emergency_withdraw` only while the contract is paused and you need to recover idle assets.

```bash
# Withdraw all idle assets from NdiLending to a safe address
stellar contract invoke \
  --id "$LENDING_ID" \
  --source owner \
  --network "$NETWORK" \
  -- emergency_withdraw \
  --to "$SAFE_ADDRESS"
```

For `NdiStaking`, `emergency_withdraw` returns a user's staked LP tokens at any time (even while paused) and forfeits unclaimed rewards. This is a user-facing function, not an owner function.

---

## Upgrade procedure

All contracts use OpenZeppelin's `Upgradeable` module. Upgrades are owner-only and in-place (state is preserved).

### 1. Build the new WASM

```bash
cd stellar
cargo test --locked        # must pass before upgrading
stellar contract build
```

Output files are in `stellar/target/wasm32v1-none/release/`.

### 2. Upload the WASM to the network

```bash
stellar contract upload \
  --source owner \
  --network "$NETWORK" \
  --wasm stellar/target/wasm32v1-none/release/ndi_lending.wasm
```

The command prints a WASM hash. Save it:

```bash
export NEW_WASM_HASH=<hash printed above>
```

### 3. Pause the contract (recommended)

Pausing prevents user transactions from landing mid-upgrade:

```bash
stellar contract invoke \
  --id "$LENDING_ID" \
  --source owner \
  --network "$NETWORK" \
  -- pause \
  --caller "$OWNER_ADDRESS"
```

### 4. Invoke the upgrade

```bash
stellar contract invoke \
  --id "$LENDING_ID" \
  --source owner \
  --network "$NETWORK" \
  -- upgrade \
  --new_wasm_hash "$NEW_WASM_HASH" \
  --operator "$OWNER_ADDRESS"
```

### 5. Verify the upgrade

Call a view function and confirm it behaves as expected with the new logic. If the new version exposes a `version()` function, call it now.

### 6. Unpause

```bash
stellar contract invoke \
  --id "$LENDING_ID" \
  --source owner \
  --network "$NETWORK" \
  -- unpause \
  --caller "$OWNER_ADDRESS"
```

### 7. Update deployment records

Update `stellar/deployments/<network>.json` if the WASM hash changed, commit, and push.

---

## Admin transfer

Ownership transfer is two-step (OpenZeppelin `Ownable`). The current owner initiates; the new owner must accept.

### Step 1 — Initiate transfer (current owner)

```bash
stellar contract invoke \
  --id "$LENDING_ID" \
  --source owner \
  --network "$NETWORK" \
  -- transfer_ownership \
  --new_owner "$NEW_OWNER_ADDRESS"
```

### Step 2 — Accept transfer (new owner)

```bash
stellar contract invoke \
  --id "$LENDING_ID" \
  --source new-owner \
  --network "$NETWORK" \
  -- accept_ownership
```

### Verify

```bash
stellar contract invoke \
  --id "$LENDING_ID" \
  --source owner \
  --network "$NETWORK" \
  -- get_owner
```

Repeat for all three contracts (`TOKEN_ID`, `LENDING_ID`, `STAKING_ID`).

---

## Communication and disclosure

| Severity | Description | Response time |
|---|---|---|
| Critical | Funds at risk, active exploit | Pause immediately, notify team within 15 minutes |
| High | Degraded functionality, no immediate fund loss | Assess within 1 hour |
| Low | UI errors, minor bugs | Standard issue tracker |

**On a critical or high incident:**

1. Pause the affected contract(s) immediately using the steps above.
2. Notify the core team on the internal incident channel with: timestamp, affected contract(s), observed behavior, and transaction ID if known.
3. Do not publicly disclose exploit details until a fix is deployed and verified.
4. Post a brief status update on the official communication channel (e.g., Discord or X/Twitter): *"We have paused [contract] as a precaution while investigating an issue. Funds are safe. We will update shortly."*
5. After resolution, publish a post-mortem using the template below.

---

## Post-incident review template

```markdown
## Incident: <short title>

**Date:** YYYY-MM-DD  
**Severity:** Critical / High / Low  
**Duration:** HH:MM  
**Contracts affected:** NdiToken / NdiLending / NdiStaking  

### Summary
One-paragraph description of what happened, what was affected, and the outcome.

### Timeline
| Time (UTC) | Event |
|---|---|
| HH:MM | Incident detected |
| HH:MM | Contract paused |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Contract unpaused |

### Root cause
Explain the technical cause.

### Impact
Describe user-visible impact (e.g., deposits blocked for N hours, no funds lost).

### Resolution
What was changed and how the fix was verified.

### Action items
| Item | Owner | Due date |
|---|---|---|
| Add test for root-cause scenario | | |
| Update runbook | | |
```
