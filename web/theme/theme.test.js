import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';

import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  applyTheme,
  getThemePreference,
  nextPreference,
  resolveTheme,
  setThemePreference,
} from './theme.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map,
  };
}

function fakeRoot() {
  const attrs = new Map();
  const events = [];
  return {
    style: { colorScheme: '' },
    setAttribute: (k, v) => attrs.set(k, v),
    getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    removeAttribute: (k) => attrs.delete(k),
    dispatchEvent: (e) => events.push(e),
    attrs,
    events,
  };
}

const throwingStorage = {
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('denied'); },
  removeItem() { throw new Error('denied'); },
};

test('getThemePreference reads, validates and survives storage errors', () => {
  assert.equal(getThemePreference(memoryStorage()), 'system');
  assert.equal(getThemePreference(memoryStorage({ [THEME_STORAGE_KEY]: 'dark' })), 'dark');
  assert.equal(getThemePreference(memoryStorage({ [THEME_STORAGE_KEY]: 'neon' })), 'system');
  assert.equal(getThemePreference(throwingStorage), 'system');
  assert.equal(getThemePreference(null), 'system');
});

test('resolveTheme is dark-first and honours the system preference', () => {
  assert.equal(resolveTheme('dark'), 'dark');
  assert.equal(resolveTheme('light'), 'light');
  assert.equal(resolveTheme('system', undefined), 'dark');
  assert.equal(resolveTheme('system', () => ({ matches: true })), 'light');
  assert.equal(resolveTheme('system', () => ({ matches: false })), 'dark');
});

test('applyTheme stamps or clears data-theme and color-scheme', () => {
  const root = fakeRoot();
  applyTheme('dark', root);
  assert.equal(root.getAttribute('data-theme'), 'dark');
  assert.equal(root.style.colorScheme, 'dark');
  applyTheme('system', root);
  assert.equal(root.getAttribute('data-theme'), null);
  assert.equal(root.style.colorScheme, '');
});

test('setThemePreference persists, applies and emits a change event', () => {
  const root = fakeRoot();
  const storage = memoryStorage();
  const theme = setThemePreference('light', { root, storage, matchMedia: () => ({ matches: false }) });
  assert.equal(theme, 'light');
  assert.equal(storage.getItem(THEME_STORAGE_KEY), 'light');
  assert.equal(root.getAttribute('data-theme'), 'light');
  assert.equal(root.events.at(-1).type, 'ndi-theme-change');
  assert.deepEqual(root.events.at(-1).detail, { preference: 'light', theme: 'light' });

  setThemePreference('system', { root, storage, matchMedia: () => ({ matches: false }) });
  assert.equal(storage.getItem(THEME_STORAGE_KEY), null, 'system clears the stored value');
  assert.equal(root.getAttribute('data-theme'), null);
});

test('setThemePreference still applies when storage throws', () => {
  const root = fakeRoot();
  setThemePreference('dark', { root, storage: throwingStorage });
  assert.equal(root.getAttribute('data-theme'), 'dark');
});

test('nextPreference cycles system → dark → light → system', () => {
  assert.equal(nextPreference('system'), 'dark');
  assert.equal(nextPreference('dark'), 'light');
  assert.equal(nextPreference('light'), 'system');
  assert.equal(nextPreference('garbage'), 'dark');
});

test('pages that inline the init script use the exact exported snippet', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../icons.html', import.meta.url), 'utf8');
  assert.ok(html.includes(`<script>${THEME_INIT_SCRIPT}</script>`), 'icons.html inline script drifted from THEME_INIT_SCRIPT');
  assert.ok(
    html.indexOf(THEME_INIT_SCRIPT) < html.indexOf('tokens.css'),
    'the init script must run before the stylesheet loads',
  );
});

function runInitScript(storage) {
  const root = fakeRoot();
  vm.runInNewContext(THEME_INIT_SCRIPT, {
    localStorage: storage,
    document: { documentElement: root },
  });
  return root;
}

test('THEME_INIT_SCRIPT applies a stored theme synchronously', () => {
  const root = runInitScript(memoryStorage({ [THEME_STORAGE_KEY]: 'light' }));
  assert.equal(root.getAttribute('data-theme'), 'light');
  assert.equal(root.style.colorScheme, 'light');
});

test('THEME_INIT_SCRIPT leaves the system default alone and never throws', () => {
  assert.equal(runInitScript(memoryStorage()).getAttribute('data-theme'), null);
  assert.equal(runInitScript(memoryStorage({ [THEME_STORAGE_KEY]: '<x>' })).getAttribute('data-theme'), null);
  assert.equal(runInitScript(throwingStorage).getAttribute('data-theme'), null);
});
