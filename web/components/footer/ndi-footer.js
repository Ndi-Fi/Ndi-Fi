import { createFooterConfig, resolveFooterHref } from './footer-config.js';

const MOBILE_QUERY = '(max-width: 47.99rem)';
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

let instanceCount = 0;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

function readMeta(name) {
  const tag = document.querySelector(`meta[name="${name}"]`);
  return tag?.content?.trim() || '';
}

/**
 * The <ndi-footer> element renders one shared footer into a shadow root, so
 * every page gets identical links, disclosures and status information.
 */
export class NdiFooter extends HTMLElement {
  static get observedAttributes() {
    return ['version', 'network', 'base-url', 'label'];
  }

  #instanceId = `ndi-footer-${++instanceCount}`;
  #cleanup = null;

  constructor() {
    super();

    const root = this.attachShadow({ mode: 'open' });
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./ndi-footer.css', import.meta.url).href;

    const content = document.createElement('div');
    content.setAttribute('data-footer-root', '');

    root.append(stylesheet, content);
  }

  connectedCallback() {
    this.#render();
  }

  disconnectedCallback() {
    this.#cleanup?.();
    this.#cleanup = null;
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#render();
  }

  #readInlineConfig() {
    const script = this.querySelector('script[type="application/json"][data-footer-config]');
    if (!script) return {};

    try {
      const parsed = JSON.parse(script.textContent || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      console.warn('[ndi-footer] Ignoring invalid JSON configuration:', error);
      return {};
    }
  }

  #render() {
    const root = this.shadowRoot?.querySelector('[data-footer-root]');
    if (!root) return;

    this.#cleanup?.();

    const inline = this.#readInlineConfig();
    const version = this.getAttribute('version') || readMeta('ndi:version') || inline.version;
    const network = this.getAttribute('network') || readMeta('ndi:network') || inline.network;
    const config = createFooterConfig({
      ...inline,
      version,
      network,
      label: this.getAttribute('label') || inline.label,
    });
    const baseUrl = this.getAttribute('base-url') || 'https://github.com/Ceejaytech25/Ndi-Fi/blob/main/';
    const pageBase = document.baseURI;
    const hrefFor = (path) => escapeHtml(resolveFooterHref(path, baseUrl, pageBase));
    const id = this.#instanceId;

    const groups = config.groups
      .map((group, index) => {
        const headingId = `${id}-group-${index}`;
        const links = group.links
          .map(
            (link) => `
              <li class="ndi-footer__item">
                <a class="ndi-footer__link" href="${hrefFor(link.href)}">${escapeHtml(link.label)}</a>
              </li>`,
          )
          .join('');

        return `
          <details class="ndi-footer__group" data-footer-group open>
            <summary class="ndi-footer__group-summary">
              <h2 class="ndi-footer__group-title" id="${headingId}">${escapeHtml(group.title)}</h2>
              <svg class="ndi-footer__chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </summary>
            <nav class="ndi-footer__nav" aria-labelledby="${headingId}">
              <ul class="ndi-footer__list">${links}</ul>
            </nav>
          </details>`;
      })
      .join('');

    root.innerHTML = `
      <footer class="ndi-footer" aria-label="${escapeHtml(config.label)}">
        <div class="ndi-footer__inner">
          <div class="ndi-footer__intro">
            <a class="ndi-footer__brand" href="${hrefFor(config.brand.href)}">${escapeHtml(config.brand.label)}</a>
            <p class="ndi-footer__tagline">${escapeHtml(config.tagline)}</p>
            <div class="ndi-footer__status" aria-label="Protocol status">
              <span class="ndi-footer__chip">
                <span class="ndi-footer__chip-key">Version</span>
                <data class="ndi-footer__chip-value" value="${escapeHtml(config.version)}">${escapeHtml(config.version)}</data>
              </span>
              <span class="ndi-footer__chip">
                <span class="ndi-footer__chip-key">Network</span>
                <data class="ndi-footer__chip-value" data-network="${escapeHtml(config.network)}" value="${escapeHtml(config.network)}">${escapeHtml(config.network)}</data>
              </span>
            </div>
          </div>
          <div class="ndi-footer__links">${groups}</div>
        </div>

        <section class="ndi-footer__disclosure" aria-labelledby="${id}-risk">
          <h2 class="ndi-footer__disclosure-title" id="${id}-risk">${escapeHtml(config.disclosure.title)}</h2>
          <p class="ndi-footer__disclosure-body">
            ${escapeHtml(config.disclosure.body)}
            <a class="ndi-footer__link" href="${hrefFor(config.disclosure.href)}">${escapeHtml(config.disclosure.linkLabel)}</a>
          </p>
        </section>

        <div class="ndi-footer__bottom">
          <p>© ${new Date().getFullYear()} Ndi-Fi. Open-source protocol documentation.</p>
          <p>Not financial advice. Use at your own risk.</p>
        </div>
      </footer>`;

    this.#bindResponsive();
  }

  #bindResponsive() {
    const groups = Array.from(this.shadowRoot.querySelectorAll('[data-footer-group]'));
    const query = window.matchMedia?.(MOBILE_QUERY) ?? null;
    const isMobile = () => Boolean(query?.matches);

    const apply = () => {
      groups.forEach((group) => {
        group.open = !isMobile();
      });
    };

    const onChange = () => apply();
    const onToggle = (event) => {
      // On wider screens the groups are always open; ignore manual toggles.
      if (!isMobile() && !event.target.open) event.target.open = true;
    };

    apply();
    groups.forEach((group) => group.addEventListener('toggle', onToggle));

    if (query?.addEventListener) query.addEventListener('change', onChange);
    else query?.addListener?.(onChange);

    this.#cleanup = () => {
      groups.forEach((group) => group.removeEventListener('toggle', onToggle));
      if (query?.removeEventListener) query.removeEventListener('change', onChange);
      else query?.removeListener?.(onChange);
    };
  }
}

if (!customElements.get('ndi-footer')) {
  customElements.define('ndi-footer', NdiFooter);
}

export default NdiFooter;
