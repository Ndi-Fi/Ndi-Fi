import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeEvent, installDom } from '../../test/helpers/dom.js';
import { MemoryStorage, setNoticeStorage } from './notice-config.js';

const document = installDom();
const { NdiNoticeBanner } = await import('./ndi-notice-banner.js');

function inlineScript(config) {
  const script = document.createElement('script');
  script.setAttribute('type', 'application/json');
  script.setAttribute('data-notice-config', '');
  script.textContent = JSON.stringify(config);
  return script;
}

async function mount(config, attributes = {}) {
  const node = document.createElement('ndi-notice-banner');
  for (const [name, value] of Object.entries(attributes)) {
    if (value === true) node.setAttribute(name, '');
    else node.setAttribute(name, value);
  }
  if (config !== null) node.append(inlineScript(config));
  document.body.appendChild(node);
  await node._ready;
  return node;
}

test('registers as a custom element', () => {
  assert.equal(customElements.get('ndi-notice-banner'), NdiNoticeBanner);
});

test('renders notices from inline config with severity-based a11y roles', async () => {
  const banner = await mount({
    notices: [
      { id: 'pause', severity: 'critical', title: 'Protocol paused', body: 'Withdrawals are halted.' },
      { id: 'upgrade', severity: 'info', title: 'New version', href: 'https://example.com', hrefLabel: 'Read more' },
    ],
  });

  const items = banner._list.children;
  assert.equal(items.length, 2);

  // Critical first (sorted), uses alert/assertive.
  assert.equal(items[0].getAttribute('data-id'), 'pause');
  assert.equal(items[0].getAttribute('role'), 'alert');
  assert.equal(items[0].getAttribute('aria-live'), 'assertive');
  assert.ok(items[0].classList.contains('ndi-notice--critical'));
  assert.match(items[0].querySelector('.ndi-notice__title').textContent, /Protocol paused/);
  assert.match(items[0].querySelector('.ndi-notice__body').textContent, /Withdrawals are halted/);

  // Info uses status/polite, renders a link with the provided label.
  assert.equal(items[1].getAttribute('role'), 'status');
  assert.equal(items[1].getAttribute('aria-live'), 'polite');
  const link = items[1].querySelector('.ndi-notice__link');
  assert.equal(link.getAttribute('href'), 'https://example.com');
  assert.equal(link.textContent, 'Read more');

  assert.equal(banner._container.hidden, false, 'banner is visible when notices exist');
  banner.remove();
});

test('hides the banner and renders nothing when there are no notices', async () => {
  const banner = await mount({ notices: [] });
  assert.equal(banner._list.children.length, 0);
  assert.equal(banner._container.hidden, true);
  banner.remove();
});

test('stale (expired) notices are not shown', async () => {
  const banner = await mount({
    notices: [
      { id: 'expired', title: 'Old', expiresAt: Date.now() - 1000 },
      { id: 'live', title: 'Current', expiresAt: Date.now() + 100000 },
    ],
  });
  const ids = banner._list.children.map((c) => c.getAttribute('data-id'));
  assert.deepEqual(ids, ['live']);
  banner.remove();
});

test('malformed inline JSON is ignored without crashing', async () => {
  const node = document.createElement('ndi-notice-banner');
  const script = document.createElement('script');
  script.setAttribute('type', 'application/json');
  script.setAttribute('data-notice-config', '');
  script.textContent = 'not valid json {'; // raw, unparseable JSON
  node.append(script);
  document.body.appendChild(node);
  await node._ready;
  assert.equal(node._list.children.length, 0);
  assert.equal(node._container.hidden, true);
  node.remove();
});

test('dismiss removes the notice, persists across instances, and is non-blocking', async () => {
  const storage = new MemoryStorage();
  setNoticeStorage(storage);
  try {
    const config = { notices: [{ id: 'incident', severity: 'critical', title: 'Incident' }] };
    const banner = await mount(config);

    let dismissed = null;
    banner.addEventListener('ndi-notice-dismiss', (e) => {
      dismissed = e.detail.id;
    });

    const close = banner._list.querySelector('.ndi-notice__close');
    assert.equal(close.getAttribute('aria-label'), 'Dismiss notice: Incident');
    close.dispatchEvent(new FakeEvent('click'));

    assert.equal(dismissed, 'incident');
    assert.equal(banner._list.children.length, 0, 'notice removed from DOM');
    assert.equal(banner._container.hidden, true, 'banner hidden once empty');
    assert.equal(storage.getItem('ndi:dismissed-notices') != null, true, 'dismissal persisted to storage');
    banner.remove();

    // A fresh banner with the same storage (simulating reload) must not re-show it.
    const reloaded = await mount(config);
    assert.equal(reloaded._list.children.length, 0, 'dismissed notice stays hidden after reload');
    reloaded.remove();
  } finally {
    setNoticeStorage(null);
  }
});

test('remote src loads notices via an injected fetch and can be dismissed', async () => {
  const storage = new MemoryStorage();
  setNoticeStorage(storage);
  try {
    const node = document.createElement('ndi-notice-banner');
    node._fetchImpl = async (url) => ({
      json: async () => ({ notices: [{ id: 'remote-1', severity: 'warning', title: 'Remote warning' }] }),
    });
    node.setAttribute('src', 'https://example.com/notices.json');
    document.body.appendChild(node);
    await node._ready;

    assert.equal(node._list.children.length, 1);
    assert.equal(node._list.children[0].getAttribute('data-id'), 'remote-1');

    node._list.querySelector('.ndi-notice__close').dispatchEvent(new FakeEvent('click'));
    assert.equal(node._list.children.length, 0);
    node.remove();
  } finally {
    setNoticeStorage(null);
  }
});

test('an invalid poll value does not set a timer', async () => {
  const banner = await mount({ notices: [] }, { poll: 'not-a-number' });
  assert.equal(banner._pollTimer, null);
  banner.remove();
});
