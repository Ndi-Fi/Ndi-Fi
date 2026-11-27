import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_HINTS,
  DEFAULT_STEPS,
  ONBOARDING_STORAGE_KEY,
  TOUR_STATUS,
  WALLET_ACTIONS,
  createOnboarding,
} from './onboarding-model.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map,
  };
}

const throwing = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
};

const make = (opts = {}) => createOnboarding({ storage: memoryStorage(), ...opts });

// ── Content ────────────────────────────────────────────────────────────────

test('default steps cover welcome, wallet, deposit, borrow risk, staking and finish', () => {
  assert.deepEqual(DEFAULT_STEPS.map((s) => s.id), ['welcome', 'connect-wallet', 'deposit', 'borrow-risk', 'stake', 'done']);
  for (const step of DEFAULT_STEPS) {
    assert.ok(step.title && step.body && step.icon, `${step.id} needs title, body and icon`);
  }
});

test('the risk step explains health factor and liquidation and needs acknowledgement', () => {
  const risk = DEFAULT_STEPS.find((s) => s.id === 'borrow-risk');
  assert.equal(risk.requiresAcknowledgement, true);
  const text = risk.points.join(' ').toLowerCase();
  for (const term of ['health factor', 'liquidat', 'collateral', 'penalty']) assert.ok(text.includes(term), term);
});

test('hints exist for deposit, borrow, low health factor and staking', () => {
  for (const id of ['deposit-shares', 'borrow-health-factor', 'health-factor-low', 'stake-cooldown']) {
    assert.ok(DEFAULT_HINTS[id], id);
  }
});

// ── Tour flow ──────────────────────────────────────────────────────────────

test('a new user is auto-started; next/back move through visible steps', () => {
  const ob = make();
  assert.equal(ob.state.status, TOUR_STATUS.NEW);
  assert.equal(ob.shouldAutoStart(), true);
  let s = ob.start();
  assert.equal(s.step.id, 'welcome');
  assert.equal(s.isFirst, true);
  assert.equal(s.total, 6);
  s = ob.next();
  assert.equal(s.step.id, 'connect-wallet');
  s = ob.back();
  assert.equal(s.step.id, 'welcome');
  s = ob.back();
  assert.equal(s.step.id, 'welcome', 'back on the first step is a no-op');
});

test('the wallet step is hidden once a wallet is connected', () => {
  const ob = make({ context: { walletConnected: true } });
  assert.equal(ob.state.total, 5);
  ob.start();
  assert.equal(ob.next().step.id, 'deposit');
});

test('connecting a wallet on the wallet step moves to the nearest remaining step', () => {
  const ob = make();
  ob.start();
  ob.next(); // connect-wallet
  const s = ob.setContext({ walletConnected: true });
  assert.equal(s.step.id, 'deposit');
  assert.equal(s.index, 1);
});

test('the risk step blocks Next until acknowledged', () => {
  const ob = make({ context: { walletConnected: true } });
  ob.start();
  ob.next(); // deposit
  let s = ob.next(); // borrow-risk
  assert.equal(s.step.id, 'borrow-risk');
  assert.equal(s.canAdvance, false);
  assert.equal(ob.next().step.id, 'borrow-risk', 'Next is refused');
  assert.equal(ob.canBorrow(), false);
  s = ob.acknowledgeRisk();
  assert.equal(s.canAdvance, true);
  assert.equal(ob.canBorrow(), true);
  assert.equal(ob.next().step.id, 'stake');
});

test('finishing the last step completes the tour and stops auto-start', () => {
  const ob = make({ context: { walletConnected: true } });
  ob.start();
  ob.acknowledgeRisk();
  let s;
  for (let i = 0; i < 10 && ob.state.active; i++) s = ob.next();
  assert.equal(s.status, TOUR_STATUS.COMPLETED);
  assert.equal(s.step, null);
  assert.equal(ob.shouldAutoStart(), false);
});

test('skip ends the tour and is remembered', () => {
  const storage = memoryStorage();
  const ob = createOnboarding({ storage });
  ob.start();
  ob.next();
  assert.equal(ob.skip().status, TOUR_STATUS.SKIPPED);
  const again = createOnboarding({ storage });
  assert.equal(again.state.status, TOUR_STATUS.SKIPPED);
  assert.equal(again.shouldAutoStart(), false);
});

test('skip is allowed before the tour starts (e.g. from a welcome banner)', () => {
  const ob = make();
  assert.equal(ob.skip().status, TOUR_STATUS.SKIPPED);
  assert.equal(ob.skip().status, TOUR_STATUS.SKIPPED, 'idempotent');
});

test('replay restarts from the first step and re-enables hints', () => {
  const ob = make();
  ob.start();
  ob.complete();
  ob.dismissHint('deposit-shares');
  const s = ob.replay();
  assert.equal(s.status, TOUR_STATUS.ACTIVE);
  assert.equal(s.step.id, 'welcome');
  ob.skip();
  assert.equal(ob.shouldShowHint('deposit-shares', { ignoreTrigger: true }), true);
});

test('progress persists: an interrupted tour resumes on the same step', () => {
  const storage = memoryStorage();
  const ob = createOnboarding({ storage });
  ob.start();
  ob.next();
  ob.next();
  const resumed = createOnboarding({ storage });
  assert.equal(resumed.shouldAutoStart(), true);
  assert.equal(resumed.start().step.id, 'deposit');
});

test('risk acknowledgement persists with a timestamp', () => {
  const storage = memoryStorage();
  createOnboarding({ storage, now: () => 1234 }).acknowledgeRisk();
  assert.equal(JSON.parse(storage.getItem(ONBOARDING_STORAGE_KEY)).riskAcknowledgedAt, 1234);
  assert.equal(createOnboarding({ storage }).canBorrow(), true);
});

test('corrupt, outdated or blocked storage falls back to a fresh state', () => {
  for (const raw of ['{not json', JSON.stringify({ version: 99, status: 'completed' }), JSON.stringify({ version: 1, status: 'bogus', seenHints: 'x' })]) {
    const ob = createOnboarding({ storage: memoryStorage({ [ONBOARDING_STORAGE_KEY]: raw }) });
    assert.equal(ob.state.status, TOUR_STATUS.NEW, raw);
    assert.equal(ob.shouldShowHint('deposit-shares', { ignoreTrigger: true }), true);
  }
  const blocked = createOnboarding({ storage: throwing });
  assert.equal(blocked.start().step.id, 'welcome');
  assert.equal(createOnboarding({ storage: null }).state.status, TOUR_STATUS.NEW);
});

test('subscribe receives snapshots with a reason and can unsubscribe', () => {
  const ob = make();
  const seen = [];
  const off = ob.subscribe((snap, reason) => seen.push([reason, snap.step?.id ?? null]));
  ob.start();
  ob.next();
  off();
  ob.skip();
  assert.deepEqual(seen, [['start', 'welcome'], ['next', 'connect-wallet']]);
});

// ── Wallet prompts ─────────────────────────────────────────────────────────

test('wallet connect is surfaced only for actions that need it', () => {
  const ob = make();
  assert.deepEqual(ob.walletPrompt('browse'), { prompt: false });
  assert.deepEqual(ob.walletPrompt('view-rates'), { prompt: false });
  for (const action of WALLET_ACTIONS) assert.equal(ob.walletPrompt(action).prompt, true, action);
  assert.match(ob.walletPrompt('deposit').reason, /deposit/);
  ob.setContext({ walletConnected: true });
  assert.deepEqual(ob.walletPrompt('deposit'), { prompt: false });
});

// ── Hints ──────────────────────────────────────────────────────────────────

test('hints show once, in context, and never on top of the tour', () => {
  const ob = make({ context: { screen: 'borrow' } });
  ob.start();
  assert.equal(ob.activeHint(), null, 'tour is active');
  ob.skip();
  assert.equal(ob.activeHint().id, 'borrow-health-factor');
  ob.dismissHint('borrow-health-factor');
  assert.equal(ob.activeHint(), null);
  assert.equal(ob.shouldShowHint('borrow-health-factor'), false);
});

test('the low health factor hint triggers below 1.2', () => {
  const ob = make({ context: { screen: 'dashboard', healthFactor: 1.5 } });
  ob.skip();
  assert.equal(ob.shouldShowHint('health-factor-low'), false);
  ob.setContext({ healthFactor: 1.1 });
  assert.equal(ob.shouldShowHint('health-factor-low'), true);
  assert.equal(ob.activeHint().id, 'health-factor-low');
});

test('shouldShowHint respects triggers unless told to ignore them', () => {
  const ob = make({ context: { screen: 'dashboard' } });
  ob.skip();
  assert.equal(ob.shouldShowHint('stake-cooldown'), false);
  assert.equal(ob.shouldShowHint('stake-cooldown', { ignoreTrigger: true }), true);
  assert.equal(ob.shouldShowHint('no-such-hint', { ignoreTrigger: true }), false);
  assert.equal(ob.getHint('no-such-hint'), null);
  assert.equal(ob.getHint('stake-cooldown').id, 'stake-cooldown');
});

test('resetHints and reset', () => {
  const ob = make();
  ob.skip();
  ob.dismissHint('deposit-shares');
  ob.resetHints();
  assert.equal(ob.shouldShowHint('deposit-shares', { ignoreTrigger: true }), true);
  ob.acknowledgeRisk();
  ob.reset();
  assert.equal(ob.state.status, TOUR_STATUS.NEW);
  assert.equal(ob.canBorrow(), false);
});

test('custom steps and hints can be supplied', () => {
  const ob = make({ steps: [{ id: 'a', title: 'A', body: 'a', icon: 'info' }], hints: {} });
  const s = ob.start();
  assert.equal(s.total, 1);
  assert.equal(s.isLast, true);
  assert.equal(ob.next().status, TOUR_STATUS.COMPLETED);
  assert.equal(ob.activeHint(), null);
});
