# NdiPoint Token Guide

NdiPoint (symbol **NDI**) is the reward and utility token of the Ndi-Fi protocol. It is an ERC-20 token on Ethereum (Solidity, `src/NdiPoint.sol`) and a SEP-41 token on Stellar (Rust, `stellar/contracts/ndi_token/`). Both share the same supply model and role semantics.

---

## Token parameters

| Parameter | Value |
|---|---|
| Name | Ndi-Point |
| Symbol | NDI |
| Decimals | 18 (Ethereum) / 7 (Stellar) |
| Initial supply | 100,000,000 NDI |
| Hard cap | 1,000,000,000 NDI |

The initial supply is minted to `initialOwner` at deployment time. No tokens can ever be minted beyond the hard cap; every mint path checks `totalSupply() + amount <= MAX_SUPPLY` before proceeding.

---

## Role model

NdiPoint uses OpenZeppelin `AccessControl` on Ethereum. Each role is a `bytes32` identifier derived from `keccak256("ROLE_NAME")`.

### DEFAULT_ADMIN_ROLE

The root role. Holders can:

- Grant and revoke any other role via `grantRole` / `revokeRole`.
- Authorize or deauthorize external contracts with `setContractAuthorization`.
- Recover ERC-20 tokens sent to the contract by mistake with `recoverTokens` (the token's own balance cannot be recovered).

> **Security note.** There is no on-chain timelock for admin actions. Before mainnet deployment, transfer `DEFAULT_ADMIN_ROLE` to a multi-signature wallet and consider adding a governance-controlled timelock in front of it.

### MINTER_ROLE

Holders can call `mint(address to, uint256 amount)` to create new tokens up to the hard cap. The function reverts if `to` is the zero address or if the mint would exceed `MAX_SUPPLY`.

```solidity
function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE)
```

Assign this role to the protocol treasury, liquidity mining contract, or any other contract that needs to issue NDI as an incentive. Never assign it to an EOA in production.

### PAUSER_ROLE

Holders can call `pause()` and `unpause()`. While the contract is paused, all token transfers (including minting and burning) revert. This is an emergency circuit-breaker.

```solidity
function pause()   public onlyRole(PAUSER_ROLE)
function unpause() public onlyRole(PAUSER_ROLE)
```

The same account can hold both `PAUSER_ROLE` and `DEFAULT_ADMIN_ROLE`, but separating them lets you designate a hot key for emergencies without exposing admin power.

### REWARD_DISTRIBUTOR_ROLE

Holders can mint tokens specifically through the reward-distribution functions. These calls record the recipient's last-claim timestamp and emit a `RewardDistributed` event.

```solidity
function distributeReward(
    address recipient,
    uint256 amount,
    string calldata reason
) external onlyRole(REWARD_DISTRIBUTOR_ROLE)

function distributeRewards(
    address[] calldata recipients,
    uint256[] calldata amounts,
    string calldata reason
) external onlyRole(REWARD_DISTRIBUTOR_ROLE) nonReentrant
```

Both paths check the hard cap before minting. `distributeRewards` processes an entire batch atomically: if the total would exceed the cap, the whole call reverts. The `reason` string is emitted in the event and is intended for off-chain analytics; keep it short to save gas.

---

## Reward distribution mechanics

### Single reward

`distributeReward` mints `amount` to one `recipient`. It:

1. Rejects the zero address and zero amounts.
2. Checks `totalSupply() + amount <= MAX_SUPPLY`.
3. Mints the tokens.
4. Writes `block.timestamp` into `lastRewardClaim[recipient]`.
5. Emits `RewardDistributed(recipient, amount, reason)`.

### Batch reward

`distributeRewards` accepts parallel `recipients` and `amounts` arrays. It pre-computes the total amount needed and validates the cap in a single check before any minting happens, then iterates to mint and record each recipient. The function is guarded by `nonReentrant`.

### Tracking last claim

`lastRewardClaim[address]` stores the Unix timestamp of the most recent reward distribution to that address. External callers (e.g. the staking contract) can read it via `getLastRewardClaim(account)` to enforce cooldowns or calculate accrual windows.

### Supply cap

Both `mint` and `distributeReward(s)` enforce:

```
totalSupply() + amount <= 1,000,000,000 × 10^18
```

Once the cap is reached, all new minting reverts. Burning reduces `totalSupply`, which opens room for future minting up to the cap again.

---

## Permit (EIP-2612) and gasless approvals

NdiPoint inherits `ERC20Permit`, which implements [EIP-2612](https://eips.ethereum.org/EIPS/eip-2612). It lets a token holder sign an off-chain message authorising a spender, which a relayer then submits on-chain.

```solidity
function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v, bytes32 r, bytes32 s
) external
```

### How it works

1. The user signs a typed EIP-712 message containing `owner`, `spender`, `value`, `nonce`, and `deadline` using their wallet's `eth_signTypedData_v4` method.
2. A relayer (or the spender contract itself) calls `permit(...)` with the signature. The token verifies the signature against `DOMAIN_SEPARATOR` and the current nonce.
3. On success, `allowance[owner][spender]` is set to `value` and `nonces[owner]` increments.
4. The relayer (or the spender) then calls `transferFrom(owner, ..., value)` in the same transaction.

The domain separator commits to the contract name ("Ndi-Point"), version, chain ID and contract address. Any replay on a different chain or contract fails.

### Gasless approval flow

```
User (off-chain)
  └─ signs permit message
        └─ sends signature to relayer or directly to the DApp
              └─ DApp calls permit() then transferFrom() in one transaction
                    └─ User never paid for the approval step
```

The `deadline` field is a Unix timestamp; pass a reasonable future value (e.g. `block.timestamp + 20 minutes`). Signatures with an elapsed deadline revert.

Nonces are per-address and monotonically increasing; a used nonce cannot be replayed.

---

## Contract authorization registry

`setContractAuthorization(address contractAddress, bool authorized)` lets `DEFAULT_ADMIN_ROLE` mark external contracts as trusted. The `isAuthorizedContract` mapping is public; any contract can check it.

This registry does not change any transfer permissions on its own. It is an advisory flag for integration contracts that want to gate certain paths to protocol-controlled addresses.

---

## Token recovery

```solidity
function recoverTokens(
    address tokenAddress,
    address to,
    uint256 amount
) external onlyRole(DEFAULT_ADMIN_ROLE)
```

Sends `amount` of the foreign `tokenAddress` token to `to`. Reverts if `tokenAddress` is the NDI token itself, preventing misuse as a drain. Only `DEFAULT_ADMIN_ROLE` holders can call this.

---

## Security considerations

### Role assignment

- Deploy with the deployer address holding all roles, then immediately transfer `DEFAULT_ADMIN_ROLE` to a multi-sig (e.g. Gnosis Safe).
- Revoke roles from the deployer EOA after setup.
- Do not grant `MINTER_ROLE` or `REWARD_DISTRIBUTOR_ROLE` to contracts that have not been audited.

### Supply inflation

`MINTER_ROLE` and `REWARD_DISTRIBUTOR_ROLE` can mint up to the 1-billion cap. Monitor on-chain `Transfer` events from the zero address to track cumulative issuance. Alert if the daily mint rate exceeds protocol-defined bounds.

### Pause misuse

A compromised `PAUSER_ROLE` key can freeze all token activity. Keep this key in cold storage or on a hardware wallet. The admin can revoke `PAUSER_ROLE` while the contract is paused; they cannot unpause without also holding `PAUSER_ROLE`.

### Reentrancy

`distributeRewards` is `nonReentrant`. `distributeReward` (single) is not, because it only calls `_mint`, which has no external calls. If you override `_update` in a subclass, re-evaluate this.

### EIP-2612 deadline

Always set a short `deadline`. Permit signatures are valid until the deadline passes; a leaked signature can be replayed up to that point.

### Admin key compromise

If `DEFAULT_ADMIN_ROLE` is compromised, the attacker can grant `MINTER_ROLE` and inflate supply to the cap. Use a time-locked multi-sig for all admin actions in production.

---

## Events reference

| Event | When emitted |
|---|---|
| `Transfer(from, to, value)` | Any token movement including mint (from = 0) and burn (to = 0) |
| `Approval(owner, spender, value)` | `approve` or `permit` |
| `RewardDistributed(recipient, amount, reason)` | Each recipient in `distributeReward` or `distributeRewards` |
| `ContractAuthorized(contractAddress, authorized)` | `setContractAuthorization` |
| `TokensRecovered(token, to, amount)` | `recoverTokens` |

---

## Deployment

```bash
# Set environment variables
export PRIVATE_KEY=<deployer_key>
export RPC_URL=<rpc_endpoint>

# Deploy and verify
forge script script/DeployNdiPoint.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify

# After deployment, transfer DEFAULT_ADMIN_ROLE to your multi-sig
# and revoke all roles from the deployer:
cast send <NDI_ADDRESS> \
  "grantRole(bytes32,address)" \
  $(cast keccak "DEFAULT_ADMIN_ROLE" | tr -d '\n') \
  <MULTISIG_ADDRESS> \
  --private-key $PRIVATE_KEY

cast send <NDI_ADDRESS> \
  "renounceRole(bytes32,address)" \
  $(cast keccak "DEFAULT_ADMIN_ROLE" | tr -d '\n') \
  <DEPLOYER_ADDRESS> \
  --private-key $PRIVATE_KEY
```

---

## Related documentation

- [Staking Guide](Staking-Guide.md) — how NDI rewards are distributed through the staking contract
- [Borrowing Guide](Borrowing-Guide.md) — lending protocol that also issues NDI incentives
- [Stellar Deployment Guide](stellar/DEPLOYMENT.md) — deploying the Stellar `ndi_token` contract
- [Tokenomics](../Tokenomics.md) — supply allocation and economic model
