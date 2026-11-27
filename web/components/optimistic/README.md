# Optimistic UI store

Reflects submitted transactions immediately, then reconciles with confirmed
state — rolling back on failure and refetching on confirmation. Each
transaction is keyed by a unique nonce/id so the store can guard against race
conditions.

It is a framework-agnostic state module: feed it your confirmed balances and
positions, apply deltas on submit, and drive the lifecycle from your wallet/tx
code. No DOM, no dependencies.

## Quick start

```bash
cd web && node --test components/optimistic/optimistic-store.test.js
```

```js
import { OptimisticStore } from './optimistic-store.js';

const store = new OptimisticStore({
  refetch: async () => fetchBalancesAndPositions(), // returns confirmed state
});
store.setBaseState({ balances: { DAI: 100n }, positions: {} });

const key = 'nonce-7';
store.submit(key, { balances: { DAI: -40n } });
// UI shows DAI 60 right away.

try {
  await sendTransaction();
  await store.confirm(key); // refetch -> confirmed state -> delta cleared
} catch (error) {
  store.fail(key); // roll back -> DAI 100 again
}
```

## State shape

```js
{
  balances: Map<string, bigint>,   // token -> amount
  positions: Map<string, Position>, // id -> { staked, rewards, ... }
}
```

Balances are `bigint` (DeFi amounts). `setBaseState` accepts either a `Map` or a
plain object for both fields.

## Delta shape

```js
{
  balances: { DAI: 10n, ETH: -1n },          // additive (bigint)
  positions: { 'pool-1': { staked: 50n } }    // merged
}
```

- **Balances** are added to the current value (default `0n`).
- **Position fields** that are `bigint` are added; any other field type replaces
  the existing value. A position that does not yet exist is created from its
  delta.

## API

| Method | Description |
| --- | --- |
| `new OptimisticStore({ refetch })` | `refetch` is an async function returning fresh confirmed state. |
| `setRefetch(fn)` | Set/replace the refetch function. |
| `setBaseState(state)` | Replace confirmed state; clears deltas whose tx has confirmed. |
| `getBaseState()` | Snapshot of the confirmed state. |
| `submit(key, delta)` | Apply an optimistic delta. **Rejects a duplicate `key`** as a race condition. |
| `confirm(key)` | Async. Marks confirmed, refetches, and (on success) clears the confirmed delta. |
| `fail(key)` | Roll back: remove the pending delta. No-op for a confirmed tx. |
| `getOptimisticState()` | Confirmed base + all in-flight deltas (a defensive snapshot). |
| `getStatus(key)` | `'pending'` \| `'confirmed'` \| `undefined`. |
| `has(key)` / `pendingCount` / `getPending()` | Introspection. |
| `subscribe(fn)` | Called with the optimistic state on every change; returns an unsubscribe. |
| `clear()` | Roll back everything still in flight. |

## Lifecycle & race-condition guard

- **submit** applies the delta and records the tx as `pending`. Reusing a key
  that is still in flight throws — this is the race-condition guard (e.g. the
  same nonce submitted twice).
- **confirm** marks the tx `confirmed` and calls `refetch`. The fresh confirmed
  state replaces the base and clears every confirmed delta (its effect is now in
  the base). Other still-pending deltas stay applied on top. If `refetch` is
  absent or fails, the confirmed delta stays applied (it reflects a real on-chain
  change) until the base is later refreshed.
- **fail** removes a pending tx's delta, reverting to the confirmed base plus any
  other pending deltas. It cannot undo a tx that already confirmed.

Because `confirm` and `fail` key off the same nonce/id, out-of-order confirm/fail
events are handled safely: a `fail` after `confirm` is a no-op, and a `fail`
before `confirm` causes the later `confirm` to find nothing to confirm.

## Tests

```bash
cd web && node --test components/optimistic/optimistic-store.test.js
```

Covers optimistic application, additive stacking, confirm-with-refetch
reconciliation, keeping other pending txs, rollback on fail, confirmed-tx
protection, the duplicate-key race guard, position merging, subscriptions,
refetch failure resilience, and snapshot immutability.
