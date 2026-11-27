import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SEVERITIES,
  MemoryStorage,
  createDismissStore,
  fetchNoticeSource,
  isStale,
  normalizeNotice,
  normalizeNotices,
  severityLive,
  severityRole,
  setNoticeStorage,
  getNoticeStorage,
} from './notice-config.js';

const NOW = 1_700_000_000_000;

test('severities expose the required accessibility roles and live regions', () => {
  assert.equal(severityRole('critical'), 'alert');
  assert.equal(severityLive('critical'), 'assertive');
  for (const sev of ['warning', 'info', 'success']) {
    assert.equal(severityRole(sev), 'status');
    assert.equal(severityLive(sev), 'polite');
  }
});

test('normalizeNotice keeps valid notices and fills sensible defaults', () => {
  const n = normalizeNotice({ id: 'pause-1', title: 'Protocol paused', severity: 'warning' }, NOW);
  assert.equal(n.id, 'pause-1');
  assert.equal(n.severity, 'warning');
  assert.equal(n.body, '');
  assert.equal(n.href, '');
  assert.equal(n.expiresAt, null);
  assert.equal(n.createdAt, NOW);
  assert.ok(Object.isFrozen(n));
});

test('normalizeNotice rejects notices missing id or title', () => {
  assert.equal(normalizeNotice({ title: 'No id' }, NOW), null);
  assert.equal(normalizeNotice({ id: 'x' }, NOW), null);
  assert.equal(normalizeNotice({ id: '  ', title: 'blank id' }, NOW), null);
  assert.equal(normalizeNotice(null, NOW), null);
  assert.equal(normalizeNotice('string', NOW), null);
  assert.equal(normalizeNotice([], NOW), null);
});

test('unknown severity falls back to info', () => {
  const n = normalizeNotice({ id: 'x', title: 'T', severity: 'emergency' }, NOW);
  assert.equal(n.severity, 'info');
});

test('expired notices are filtered as stale and future expiry is preserved', () => {
  const expired = normalizeNotice({ id: 'old', title: 'Old', expiresAt: NOW - 1000 }, NOW);
  assert.equal(expired, null);

  const future = normalizeNotice({ id: 'live', title: 'Live', expiresAt: NOW + 1000 }, NOW);
  assert.equal(future.id, 'live');
  assert.equal(future.expiresAt, NOW + 1000);
});

test('isStale flags past expiry and ignores null expiry', () => {
  assert.equal(isStale({ expiresAt: NOW - 1 }, NOW), true);
  assert.equal(isStale({ expiresAt: NOW + 1 }, NOW), false);
  assert.equal(isStale({ expiresAt: null }, NOW), false);
});

test('normalizeNotices sorts critical first then newest, and accepts { notices } wrapper', () => {
  const raw = {
    notices: [
      { id: 'a', title: 'Info', severity: 'info', createdAt: NOW - 100 },
      { id: 'b', title: 'Critical', severity: 'critical', createdAt: NOW - 200 },
      { id: 'c', title: 'Info2', severity: 'info', createdAt: NOW },
      { id: 'bad', title: '' },
    ],
  };
  const out = normalizeNotices(raw, NOW);
  assert.deepEqual(
    out.map((n) => n.id),
    ['b', 'c', 'a'],
    'critical first, then info newest-first',
  );
  assert.ok(!out.find((n) => n.id === 'bad'));
});

test('createDismissStore persists dismissal across instances via storage', () => {
  const storage = new MemoryStorage();
  const storeA = createDismissStore(storage, 'ndi:test');
  assert.equal(storeA.isDismissed('p1'), false);

  storeA.dismiss('p1');
  assert.equal(storeA.isDismissed('p1'), true);

  // A second store on the same storage sees the dismissal — simulating a reload.
  const storeB = createDismissStore(storage, 'ndi:test');
  assert.equal(storeB.isDismissed('p1'), true);
  assert.deepEqual(Object.keys(storeB.list()), ['p1']);

  storeB.clear();
  assert.equal(storeB.isDismissed('p1'), false);
});

test('setNoticeStorage overrides the resolved backend and can be reset', () => {
  const mem = new MemoryStorage();
  setNoticeStorage(mem);
  assert.equal(getNoticeStorage(), mem, 'override is used');

  setNoticeStorage(null);
  assert.notEqual(getNoticeStorage(), mem, 'override is cleared after reset');
});

test('fetchNoticeSource handles local data, functions and URLs', async () => {
  assert.deepEqual(await fetchNoticeSource(null), []);
  assert.deepEqual(await fetchNoticeSource([{ id: 'x', title: 'T' }]), [{ id: 'x', title: 'T' }]);

  const fromFn = await fetchNoticeSource(() => ({ notices: [{ id: 'y', title: 'Y' }] }));
  assert.deepEqual(fromFn, { notices: [{ id: 'y', title: 'Y' }] });

  const asyncFn = await fetchNoticeSource(async () => [1, 2, 3]);
  assert.deepEqual(asyncFn, [1, 2, 3]);

  const mockFetch = async (url) => ({ json: async () => ({ notices: [{ id: 'z', title: 'Z' }] }) });
  const remote = await fetchNoticeSource('https://example.com/notices.json', mockFetch);
  assert.deepEqual(remote.notices[0].id, 'z');
});

test('fetchNoticeSource propagates fetch errors', async () => {
  const failingFetch = async () => {
    throw new Error('network down');
  };
  await assert.rejects(
    () => fetchNoticeSource('https://example.com/notices.json', failingFetch),
    /network down/,
  );
});
