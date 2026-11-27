import assert from 'node:assert/strict';
import test from 'node:test';

import { OptimisticStore } from './optimistic-store.js';

function balanceOf(state, token) {
  return state.balances.get(token);
}

test('submit applies an optimistic balance delta on top of the confirmed base', () => {
  const store = new OptimisticStore();
  store.setBaseState({ balances: { DAI: 100n } });

  store.submit('tx-1', { balances: { DAI: -40n } });
  assert.equal(balanceOf(store.getOptimisticState(), 'DAI'), 60n, 'UI reflects the withdrawal immediately');
  assert.equal(balanceOf(store.getBaseState(), 'DAI'), 100n, 'confirmed base is untouched');
  assert.equal(store.pendingCount, 1);
});

test('multiple pending transactions stack additively', () => {
  const store = new OptimisticStore();
  store.setBaseState({ balances: { DAI: 100n } });

  store.submit('a', { balances: { DAI: 10n } });
  store.submit('b', { balances: { DAI: 5n } });
  assert.equal(balanceOf(store.getOptimisticState(), 'DAI'), 115n);

  store.fail('a'); // roll back the first
  assert.equal(balanceOf(store.getOptimisticState(), 'DAI'), 105n, 'only b remains applied');
  assert.equal(store.pendingCount, 1);
});

test('confirm refetches confirmed state and drops the confirmed delta', async () => {
  let refetchCalls = 0;
  const store = new OptimisticStore({
    refetch: async () => {
      refetchCalls += 1;
      return { balances: { DAI: 110n } }; // chain now reflects the +10 deposit
    },
  });
  store.setBaseState({ balances: { DAI: 100n } });

  store.submit('deposit', { balances: { DAI: 10n } });
  assert.equal(balanceOf(store.getOptimisticState(), 'DAI'), 110n);

  const ok = await store.confirm('deposit');
  assert.equal(ok, true);
  assert.equal(refetchCalls, 1);
  assert.equal(balanceOf(store.getOptimisticState(), 'DAI'), 110n, 'reconciled with confirmed state');
  assert.equal(store.pendingCount, 0, 'confirmed tx is cleared after base refresh');
  assert.equal(store.getStatus('deposit'), undefined);
});

test('confirm keeps other still-pending transactions applied', async () => {
  const store = new OptimisticStore({
    refetch: async () => ({ balances: { DAI: 110n } }), // reflects tx-a only
  });
  store.setBaseState({ balances: { DAI: 100n } });

  store.submit('tx-a', { balances: { DAI: 10n } });
  store.submit('tx-b', { balances: { DAI: 5n } });
  assert.equal(balanceOf(store.getOptimisticState(), 'DAI'), 115n);

  await store.confirm('tx-a');
  assert.equal(balanceOf(store.getOptimisticState(), 'DAI'), 115n, 'tx-b delta still applied on refreshed base');
  assert.deepEqual(
    store.getPending().map((t) => t.key),
    ['tx-b'],
  );
});

test('fail rolls back the optimistic delta', () => {
  const store = new OptimisticStore();
  store.setBaseState({ balances: { DAI: 100n } });

  store.submit('withdraw', { balances: { DAI: -20n } });
  assert.equal(balanceOf(store.getOptimisticState(), 'DAI'), 80n);

  assert.equal(store.fail('withdraw'), true);
  assert.equal(balanceOf(store.getOptimisticState(), 'DAI'), 100n, 'rolled back to confirmed base');
  assert.equal(store.pendingCount, 0);
});

test('a confirmed transaction cannot be rolled back by fail', async () => {
  const store = new OptimisticStore(); // no refetch: confirmed delta stays applied
  store.setBaseState({ balances: { DAI: 100n } });

  store.submit('ok', { balances: { DAI: 10n } });
  await store.confirm('ok');
  assert.equal(store.getStatus('ok'), 'confirmed');
  assert.equal(balanceOf(store.getOptimisticState(), 'DAI'), 110n, 'confirmed delta stays applied');

  assert.equal(store.fail('ok'), false, 'fail is a no-op for a confirmed tx');
  assert.equal(balanceOf(store.getOptimisticState(), 'DAI'), 110n);
});

test('a duplicate tx key is rejected as a race condition', () => {
  const store = new OptimisticStore();
  store.setBaseState({ balances: { DAI: 100n } });
  store.submit('nonce-7', { balances: { DAI: 1n } });

  assert.throws(
    () => store.submit('nonce-7', { balances: { DAI: 2n } }),
    /duplicate tx key "nonce-7"/,
  );
  assert.equal(store.pendingCount, 1, 'the original pending tx is intact');
  assert.equal(balanceOf(store.getOptimisticState(), 'DAI'), 101n, 'only the first delta applies');
});

test('confirm and fail of unknown keys are safe no-ops', async () => {
  const store = new OptimisticStore();
  assert.equal(await store.confirm('nope'), false);
  assert.equal(store.fail('nope'), false);
  assert.equal(store.pendingCount, 0);
});

test('position deltas merge additively for bigint fields', () => {
  const store = new OptimisticStore();
  store.setBaseState({ positions: { 'pool-1': { staked: 100n, rewards: 5n } } });

  store.submit('stake', { positions: { 'pool-1': { staked: 50n } } });
  const pos = store.getOptimisticState().positions.get('pool-1');
  assert.equal(pos.staked, 150n, 'staked added');
  assert.equal(pos.rewards, 5n, 'untouched field preserved');

  store.submit('reward', { positions: { 'pool-1': { rewards: 3n } } });
  assert.equal(store.getOptimisticState().positions.get('pool-1').rewards, 8n);
});

test('a new position is created from its delta when none exists', () => {
  const store = new OptimisticStore();
  store.setBaseState({ positions: {} });
  store.submit('new-pool', { positions: { 'pool-2': { staked: 30n } } });
  const pos = store.getOptimisticState().positions.get('pool-2');
  assert.deepEqual(pos, { staked: 30n });
});

test('subscribers are notified on every state change and can unsubscribe', () => {
  const store = new OptimisticStore();
  store.setBaseState({ balances: { DAI: 100n } });

  let calls = 0;
  const unsubscribe = store.subscribe(() => {
    calls += 1;
  });

  store.submit('a', { balances: { DAI: 1n } });
  assert.equal(calls, 1);
  store.fail('a');
  assert.equal(calls, 2);

  unsubscribe();
  store.submit('b', { balances: { DAI: 1n } });
  assert.equal(calls, 2, 'no notifications after unsubscribe');
});

test('a failed refetch keeps the confirmed optimistic delta applied', async () => {
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    const store = new OptimisticStore({
      refetch: async () => {
        throw new Error('rpc down');
      },
    });
    store.setBaseState({ balances: { DAI: 100n } });
    store.submit('t', { balances: { DAI: 10n } });
    await store.confirm('t');
    assert.equal(store.getStatus('t'), 'confirmed', 'tx stays confirmed');
    assert.equal(balanceOf(store.getOptimisticState(), 'DAI'), 110n, 'delta stays applied when refetch fails');
  } finally {
    console.warn = origWarn;
  }
});

test('the optimistic state is a defensive snapshot that does not mutate internal state', () => {
  const store = new OptimisticStore();
  store.setBaseState({ balances: { DAI: 100n } });
  store.submit('t', { balances: { DAI: 10n } });

  const snapshot = store.getOptimisticState();
  snapshot.balances.set('DAI', 999n);
  assert.equal(balanceOf(store.getOptimisticState(), 'DAI'), 110n, 'internal state is unaffected by caller mutations');
});
