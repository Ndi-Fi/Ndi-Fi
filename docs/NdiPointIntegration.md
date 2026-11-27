# Integrating NdiPoint

This guide walks through `NdiPointIntegrationExample.sol`, the reference contract for protocols that want to earn and distribute NdiPoint (NDI) rewards. After reading it you will know how to integrate permit-based approvals and reward mechanics, and you will have a runnable test to verify your integration.

---

## Overview

`NdiPoint` is an ERC-20 reward token with the following capabilities relevant to integrators:

| Feature | How integrators use it |
|---|---|
| `MINTER_ROLE` | Grants an external contract the right to call `mint`. |
| `REWARD_DISTRIBUTOR_ROLE` | Grants an external contract the right to call `distributeReward` / `distributeRewards`. |
| EIP-2612 `permit` | Users can approve the integration contract in a gasless off-chain signature instead of a separate `approve` transaction. |
| `distributeReward(recipient, amount, reason)` | Mints NDI points to one address with a human-readable reason label. |
| `distributeRewards(recipients[], amounts[], reason)` | Batches the above into one transaction. |

The example contract demonstrates both staking-style rewards (time-accrued) and activity-based rewards (lending and borrowing incentives).

---

## Step-by-step walkthrough

### 1. Deploy NdiPoint and grant roles

```solidity
NdiPoint ndiPoint = new NdiPoint(owner);

// Grant the integration contract permission to distribute rewards
ndiPoint.grantRole(ndiPoint.REWARD_DISTRIBUTOR_ROLE(), address(integrationContract));
```

The integration contract calls `distributeReward` and `distributeRewards`, which require `REWARD_DISTRIBUTOR_ROLE`. Grant this role _before_ users interact with the integration contract, or the first reward claim will revert.

### 2. Deploy the integration contract

```solidity
NdiPointIntegrationExample integration = new NdiPointIntegrationExample(address(ndiPoint));
```

The constructor stores the `NdiPoint` address and sets `owner`. The contract holds no tokens itself; it asks `NdiPoint` to mint rewards directly to users.

### 3. Stake tokens to start accruing rewards

```solidity
// Simulate staking 100 units (no token transfer in the example; it tracks balances internally)
integration.stake(100 * 1e18);
```

`stake` calls `_updateRewards` first, which calculates any pending rewards since the last update and distributes them before recording the new balance. This prevents users from front-running reward calculations by staking large amounts right before a claim.

```
pending = (stakedBalance × rewardRate × timeDiff) / (1e18 × 1 days)
```

`rewardRate` defaults to `100` NDI points per day per staked unit. The owner can update it with `setRewardRate`.

### 4. Claim staking rewards

```solidity
integration.claimStakingRewards();
```

Internally this calls `ndiPoint.distributeReward(msg.sender, rewards, "Staking rewards")`, which mints `rewards` NDI points to the caller. It then resets `lastRewardUpdate[msg.sender]` to `block.timestamp`.

### 5. Earn activity-based rewards (lending and borrowing)

Lending and borrowing rewards are paid immediately when the activity is recorded:

```solidity
// 1% of the lent amount is minted as NDI points
integration.lend(1_000 * 1e18); // earns 10 NDI points (1%)

// 0.5% of the borrowed amount is minted as NDI points
integration.borrow(500 * 1e18); // earns 2.5 NDI points (0.5%)
```

Both functions call `ndiPoint.distributeReward` synchronously. If `NdiPoint` is paused or the max supply is reached, the transaction will revert.

### 6. Use permit for gasless approvals

EIP-2612 permit lets users sign an approval off-chain, eliminating the need for a separate `approve` transaction. The pattern below shows how to use a user-signed permit before calling a function that pulls tokens.

```solidity
// Off-chain: generate a permit signature using EIP-712
(uint8 v, bytes32 r, bytes32 s) = signPermit(
    ndiPoint,
    owner,
    spender,          // the integration contract or router
    amount,
    deadline,
    ownerPrivateKey
);

// On-chain: call permit then the token-pulling function atomically
ndiPoint.permit(owner, spender, amount, deadline, v, r, s);
integrationContract.someTokenPullingFunction(amount);
```

The `NdiPoint` contract inherits ERC20Permit from OpenZeppelin. The domain separator is `"Ndi-Point"`. Verify it matches your expected domain before signing:

```solidity
bytes32 domainSeparator = ndiPoint.DOMAIN_SEPARATOR();
```

### 7. Distribute weekly rewards to many users at once

The owner can batch rewards in a single transaction to save gas:

```solidity
address[] memory users = new address[](3);
users[0] = alice; users[1] = bob; users[2] = carol;

uint256[] memory amounts = new uint256[](3);
amounts[0] = 100e18; amounts[1] = 200e18; amounts[2] = 150e18;

integration.distributeWeeklyRewards(users, amounts);
// Internally calls: ndiPoint.distributeRewards(users, amounts, "Weekly platform rewards")
```

The entire batch is atomic: if any single mint would exceed `MAX_SUPPLY`, the whole transaction reverts.

---

## Common integration pitfalls

**Role not granted before first reward**
If `REWARD_DISTRIBUTOR_ROLE` is not granted to the integration contract before a user triggers a reward, the call to `distributeReward` will revert with an `AccessControl` error. Grant the role during deployment, not lazily.

**Reward rate mismatch with token decimals**
`NdiPoint` uses 18 decimals. `rewardRate = 100` means 100 _full_ NDI points per day per staked unit if `stakedBalance` is also in 18-decimal units. If your staked token uses a different decimal count, adjust the rate formula accordingly.

**Stale `lastRewardUpdate` on first stake**
The first time a user stakes, `lastRewardUpdate[user]` is 0. `calculatePendingRewards` computes `block.timestamp - 0`, which is a large elapsed time and would generate enormous initial rewards. `_updateRewards` sets `lastRewardUpdate` on every stake and unstake call, resetting the timer. Make sure you call `_updateRewards` (or its equivalent) whenever the staked balance changes.

**MAX_SUPPLY exhaustion**
`NdiPoint` has a hard cap of 1 billion tokens. If cumulative minting approaches this cap, `distributeReward` will revert. Monitor `remainingSupply()` off-chain and adjust reward rates before the cap is hit.

**Paused NdiPoint**
If the `PAUSER_ROLE` holder pauses `NdiPoint`, all transfers and mints are blocked. Any integration function that calls `distributeReward` will revert. Build pause-aware error handling in your front-end and consider a try/catch in contracts that must remain operational during a pause.

**Permit replay across chains**
The `permit` domain separator includes the `chainId`. A signature valid on one chain is not valid on another. Always generate permits targeting the specific chain your users are on.

---

## Runnable test

The test below is in `test/NdiPointIntegration.t.sol`. Run it with:

```sh
forge test --match-path test/NdiPointIntegration.t.sol -v
```

See [`test/NdiPointIntegration.t.sol`](../test/NdiPointIntegration.t.sol) for the full source.

---

## See also

- [`src/NdiPoint.sol`](../src/NdiPoint.sol) – token source
- [`src/NdiPointIntegrationExample.sol`](../src/NdiPointIntegrationExample.sol) – example contract source
- [Glossary](Glossary.md) – definitions for NdiPoint, reward pool, staking
- [Event Catalogue](EventCatalogue.md) – `RewardDistributed` and related events
