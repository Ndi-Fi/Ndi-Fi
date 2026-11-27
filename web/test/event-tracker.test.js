import assert from 'node:assert/strict';
import test from 'node:test';

import {
  setAnalyticsOptIn,
  setEventSink,
  trackDepositStarted,
  trackEvent,
  trackTransactionSucceeded,
} from '../analytics/event-tracker.js';

test('tracking is disabled by default and emits semantic events only after opt-in', () => {
  const events = [];
  setEventSink((event) => events.push(event));
  setAnalyticsOptIn(false);

  assert.equal(trackDepositStarted({ chainId: 1, assetSymbol: 'USDC' }), false);
  assert.deepEqual(events, []);

  setAnalyticsOptIn(true);
  assert.equal(trackDepositStarted({ chainId: 11155111, assetSymbol: 'USDC' }), true);
  assert.equal(trackTransactionSucceeded({ chainId: 11155111, action: 'deposit' }), true);
  assert.deepEqual(events, [
    { name: 'deposit_started', chainId: 11155111, assetSymbol: 'USDC' },
    { name: 'tx_succeeded', chainId: 11155111, action: 'deposit' },
  ]);
});

test('unknown and identifying properties are never forwarded to the sink', () => {
  const events = [];
  setEventSink((event) => events.push(event));
  setAnalyticsOptIn(true);

  trackEvent('deposit_started', {
    chainId: 1,
    assetSymbol: 'DAI',
    walletAddress: '0x1234',
    amount: '1000',
    email: 'user@example.com',
  });
  trackEvent('tx_succeeded', {
    chainId: 1,
    action: 'repay',
    transactionHash: '0xdeadbeef',
  });

  assert.deepEqual(events, [
    { name: 'deposit_started', chainId: 1, assetSymbol: 'DAI' },
    { name: 'tx_succeeded', chainId: 1, action: 'repay' },
  ]);
});

test('invalid optional metadata is omitted and opt-out stops events immediately', () => {
  const events = [];
  setEventSink((event) => events.push(event));
  setAnalyticsOptIn(true);

  trackDepositStarted({ chainId: '1', assetSymbol: 'email@example.com' });
  setAnalyticsOptIn(false);
  trackTransactionSucceeded({ chainId: 1, action: 'deposit' });

  assert.deepEqual(events, [{ name: 'deposit_started' }]);
});

test('invalid settings and unknown event names fail explicitly', () => {
  assert.throws(() => setAnalyticsOptIn('yes'), /Analytics opt-in must be a boolean/);
  assert.throws(() => setEventSink(null), /The event sink must be a function/);
  assert.throws(() => trackEvent('wallet_connected'), /Unknown analytics event: wallet_connected/);
});
