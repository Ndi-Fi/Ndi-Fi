/**
 * Config source and helpers for the Ndi-Fi protocol notice banner.
 *
 * Notices can come from a remote URL (`fetch`), a local array/object passed
 * inline, or a function. Every notice is normalised into a safe, frozen
 * shape; expired (stale) and dismissed notices are filtered out.
 *
 * Dismissal is persisted per notice `id` in a storage backend that defaults to
 * `localStorage` but is injectable (and has an in-memory fallback) so it works
 * in non-browser tests.
 */

export const SEVERITIES = Object.freeze(['info', 'warning', 'critical', 'success']);

/** Display/sort priority: critical first, then warning, info, success. */
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2, success: 3 };
const SEVERITY_ROLE = { critical: 'alert', warning: 'status', info: 'status', success: 'status' };
const SEVERITY_LIVE = { critical: 'assertive', warning: 'polite', info: 'polite', success: 'polite' };
const SEVERITY_ICON = { critical: '!', warning: '!', info: 'i', success: '✓' };

export function severityRole(severity) {
  return SEVERITY_ROLE[severity] ?? 'status';
}

export function severityLive(severity) {
  return SEVERITY_LIVE[severity] ?? 'polite';
}

export function severityIcon(severity) {
  return SEVERITY_ICON[severity] ?? 'i';
}

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNum(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

/** True when a notice has expired (its `expiresAt` is in the past). */
export function isStale(notice, now = Date.now()) {
  return notice != null && notice.expiresAt != null && now > notice.expiresAt;
}

/**
 * Validate and normalise one notice. Returns null when the notice is missing a
 * required `id`/`title`, is already stale, or is not a plain object. Unknown
 * severities fall back to `info`; an invalid `expiresAt` is treated as "no
 * expiry" rather than dropping an otherwise valid notice.
 */
export function normalizeNotice(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const id = asText(raw.id);
  const title = asText(raw.title);
  if (!id || !title) return null;

  const severity = SEVERITIES.includes(raw.severity) ? raw.severity : 'info';
  const createdRaw = asNum(raw.createdAt);
  const createdAt = Number.isFinite(createdRaw) ? createdRaw : now;

  const expiresRaw = raw.expiresAt == null || raw.expiresAt === '' ? null : asNum(raw.expiresAt);
  const expiresAt = expiresRaw == null ? null : Number.isFinite(expiresRaw) ? expiresRaw : null;
  if (expiresAt !== null && now > expiresAt) return null; // already stale

  return Object.freeze({
    id,
    severity,
    title,
    body: asText(raw.body),
    href: asText(raw.href),
    hrefLabel: asText(raw.hrefLabel),
    createdAt,
    expiresAt,
  });
}

/**
 * Normalise a raw payload (array, `{ notices: [...] }`, or anything else) into a
 * sorted list of valid, non-stale notices: critical first, then newest first.
 */
export function normalizeNotices(raw, now = Date.now()) {
  const list = Array.isArray(raw)
    ? raw
    : raw && Array.isArray(raw.notices)
      ? raw.notices
      : [];
  return list
    .map((n) => normalizeNotice(n, now))
    .filter(Boolean)
    .sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.createdAt - a.createdAt,
    );
}

/**
 * Resolve a notice source to raw data.
 *   - function:  call it (may be sync or async)
 *   - string:    treat as a URL and `fetch` JSON
 *   - otherwise:  return as-is (array or { notices: [...] })
 */
export async function fetchNoticeSource(source, fetchImpl) {
  if (source == null) return [];
  if (typeof source === 'function') return source();
  if (typeof source === 'string') {
    const f = fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null);
    if (!f) throw new Error('fetch is not available in this environment');
    const res = await f(source);
    return res.json();
  }
  return source;
}

/** localStorage-like fallback for non-browser environments and tests. */
export class MemoryStorage {
  constructor() {
    this._data = new Map();
  }
  getItem(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  }
  setItem(key, value) {
    this._data.set(key, String(value));
  }
  removeItem(key) {
    this._data.delete(key);
  }
  clear() {
    this._data.clear();
  }
  get length() {
    return this._data.size;
  }
  key(index) {
    return [...this._data.keys()][index] ?? null;
  }
}

let _storageOverride = null;

/** Inject a storage backend (mainly for tests). Pass null to reset. */
export function setNoticeStorage(storage) {
  _storageOverride = storage;
}

/** Resolve the active storage backend. */
export function getNoticeStorage() {
  if (_storageOverride) return _storageOverride;
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  } catch {
    /* ignore */
  }
  return new MemoryStorage();
}

/**
 * Per-notice dismiss state, persisted in the given storage. A notice is
 * hidden once its id is recorded here; dismissal survives reloads because it
 * is written to the storage backend.
 */
export function createDismissStore(storage = getNoticeStorage(), storageKey = 'ndi:dismissed-notices') {
  const read = () => {
    try {
      return JSON.parse(storage.getItem(storageKey) ?? '{}');
    } catch {
      return {};
    }
  };
  const write = (map) => {
    try {
      storage.setItem(storageKey, JSON.stringify(map));
    } catch {
      /* storage may be unavailable; dismissal stays in memory only */
    }
  };

  return {
    storageKey,
    isDismissed(id) {
      return Object.prototype.hasOwnProperty.call(read(), id);
    },
    dismiss(id) {
      const map = read();
      map[id] = Date.now();
      write(map);
    },
    clear() {
      write({});
    },
    list() {
      return read();
    },
  };
}
