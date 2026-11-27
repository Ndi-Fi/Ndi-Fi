/**
 * <ndi-notice-banner> — protocol-wide notices (pauses, upgrades, incidents).
 *
 * Notices are driven by a remote/local config source (inline JSON or a `src`
 * URL), shown with a severity level, and individually dismissible. Dismissal is
 * persisted per notice id so it survives reloads. Stale (expired) notices are
 * never shown. The banner is a status region, not a modal: it never blocks or
 * traps focus.
 *
 * @example Inline (local) config:
 * <ndi-notice-banner>
 *   <script type="application/json" data-notice-config>
 *     { "notices": [{ "id": "pause", "severity": "critical", "title": "Paused" }] }
 *   </script>
 * </ndi-notice-banner>
 *
 * @example Remote config:
 * <ndi-notice-banner src="/api/notices.json" poll="60"></ndi-notice-banner>
 */

import {
  createDismissStore,
  fetchNoticeSource,
  getNoticeStorage,
  isStale,
  normalizeNotices,
  severityIcon,
  severityLive,
  severityRole,
} from './notice-config.js';

const DISMISS_LABEL = 'Dismiss notice:';

export class NdiNoticeBanner extends HTMLElement {
  static get observedAttributes() {
    return ['src', 'poll', 'storage-key'];
  }

  constructor() {
    super();
    this._built = false;
    this._raw = null;
    this._store = null;
    this._pollTimer = null;
    this._fetchImpl = null;
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (!this._built) this.#build();
    this._ready = this.#load();
  }

  disconnectedCallback() {
    this.#stopPolling();
  }

  attributeChangedCallback(name) {
    if (!this._built) return;
    if (name === 'src' || name === 'storage-key') {
      this._store = null; // storage-key may have changed
      this._ready = this.#load();
    } else if (name === 'poll') {
      this.#setupPolling();
    }
  }

  /** Inject a fetch implementation (used for tests / custom transports). */
  setFetch(fetchImpl) {
    this._fetchImpl = fetchImpl;
    this._ready = this.#load();
  }

  /** Force a reload of the notice source. */
  reload() {
    this._ready = this.#load();
    return this._ready;
  }

  #build() {
    const doc = this.ownerDocument;
    const root = this.shadowRoot;

    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./ndi-notice-banner.css', import.meta.url).href;

    this._list = doc.createElement('div');
    this._list.className = 'ndi-notice-banner__list';
    this._list.setAttribute('part', 'list');

    this._container = doc.createElement('div');
    this._container.className = 'ndi-notice-banner';
    this._container.setAttribute('part', 'banner');
    this._container.hidden = true;
    this._container.append(this._list);

    root.append(link, this._container);
    this._built = true;
  }

  #readInlineConfig() {
    const script = this.querySelector('script[data-notice-config]');
    if (!script) return null;
    try {
      return JSON.parse(script.textContent || 'null');
    } catch (error) {
      console.warn('[ndi-notice-banner] ignoring invalid inline JSON config:', error);
      return null;
    }
  }

  #getStore() {
    if (!this._store) {
      const key = this.getAttribute('storage-key') || 'ndi:dismissed-notices';
      this._store = createDismissStore(getNoticeStorage(), key);
    }
    return this._store;
  }

  async #load() {
    this.#stopPolling();
    const inline = this.#readInlineConfig();
    const source = inline != null ? inline : this.getAttribute('src');

    let raw;
    try {
      raw = await fetchNoticeSource(source, this._fetchImpl);
    } catch (error) {
      console.warn('[ndi-notice-banner] could not load notices:', error);
      raw = [];
    }
    this._raw = raw;
    this.#render(raw);
    this.#setupPolling();
  }

  #render(raw) {
    const now = Date.now();
    const store = this.#getStore();
    const active = normalizeNotices(raw, now).filter(
      (notice) => !store.isDismissed(notice.id) && !isStale(notice, now),
    );

    this._list.textContent = '';
    for (const notice of active) {
      this._list.append(this.#buildNotice(notice));
    }
    this._container.hidden = active.length === 0;
  }

  #buildNotice(notice) {
    const doc = this.ownerDocument;
    const item = doc.createElement('div');
    item.className = `ndi-notice ndi-notice--${notice.severity}`;
    item.setAttribute('part', `notice notice-${notice.severity}`);
    item.setAttribute('role', severityRole(notice.severity));
    item.setAttribute('aria-live', severityLive(notice.severity));
    item.setAttribute('data-id', notice.id);

    const icon = doc.createElement('span');
    icon.className = 'ndi-notice__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = severityIcon(notice.severity);

    const content = doc.createElement('div');
    content.className = 'ndi-notice__content';

    const title = doc.createElement('strong');
    title.className = 'ndi-notice__title';
    title.textContent = notice.title;
    content.append(title);

    if (notice.body) {
      const body = doc.createElement('span');
      body.className = 'ndi-notice__body';
      body.textContent = notice.body;
      content.append(body);
    }
    if (notice.href) {
      const link = doc.createElement('a');
      link.className = 'ndi-notice__link';
      link.setAttribute('href', notice.href);
      link.textContent = notice.hrefLabel || 'Learn more';
      content.append(link);
    }

    const close = doc.createElement('button');
    close.className = 'ndi-notice__close';
    close.setAttribute('type', 'button');
    close.setAttribute('part', 'close');
    close.setAttribute('aria-label', `${DISMISS_LABEL} ${notice.title}`);
    const closeIcon = doc.createElement('span');
    closeIcon.setAttribute('aria-hidden', 'true');
    closeIcon.textContent = '×';
    close.append(closeIcon);
    close.addEventListener('click', () => this.#dismiss(notice.id));

    item.append(icon, content, close);
    return item;
  }

  #dismiss(id) {
    this.#getStore().dismiss(id);
    if (this._raw != null) this.#render(this._raw);
    this.dispatchEvent(new CustomEvent('ndi-notice-dismiss', { detail: { id } }));
  }

  #setupPolling() {
    this.#stopPolling();
    const seconds = Number(this.getAttribute('poll'));
    if (Number.isFinite(seconds) && seconds > 0 && typeof setInterval !== 'undefined') {
      this._pollTimer = setInterval(() => {
        this._ready = this.#load();
      }, seconds * 1000);
    }
  }

  #stopPolling() {
    if (this._pollTimer != null && typeof clearInterval !== 'undefined') {
      clearInterval(this._pollTimer);
    }
    this._pollTimer = null;
  }
}

if (typeof HTMLElement === 'function' && typeof customElements !== 'undefined') {
  if (!customElements.get('ndi-notice-banner')) customElements.define('ndi-notice-banner', NdiNoticeBanner);
}

export default NdiNoticeBanner;
