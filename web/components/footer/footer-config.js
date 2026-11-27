/**
 * Content and URL helpers for the shared Ndi-Fi footer.
 *
 * Link `href` values are documented as repository-relative paths and are
 * resolved against `baseUrl` at render time. `baseUrl` must end with `/`.
 */

export const DEFAULT_BASE_URL = 'https://github.com/Ceejaytech25/Ndi-Fi/blob/main/';

export const DEFAULT_FOOTER_CONTENT = Object.freeze({
  label: 'Ndi-Fi site footer',
  brand: Object.freeze({ label: 'Ndi-Fi', href: 'README.md' }),
  tagline: 'Open lending and staking infrastructure for everyone.',
  groups: Object.freeze([
    Object.freeze({
      id: 'docs',
      title: 'Documentation',
      links: Object.freeze([
        Object.freeze({ label: 'Protocol overview', href: 'README.md' }),
        Object.freeze({ label: 'Docs index', href: 'docs/' }),
        Object.freeze({ label: 'Stellar guide', href: 'stellar/README.md' }),
      ]),
    }),
    Object.freeze({
      id: 'security',
      title: 'Security',
      links: Object.freeze([
        Object.freeze({ label: 'Security policy', href: 'SECURITY.md' }),
        Object.freeze({ label: 'Audit readiness', href: 'docs/AUDIT_READINESS.md' }),
        Object.freeze({ label: 'Upgradeability', href: 'docs/UPGRADEABILITY.md' }),
      ]),
    }),
    Object.freeze({
      id: 'governance',
      title: 'Governance',
      links: Object.freeze([
        Object.freeze({ label: 'Roadmap & DAO', href: 'Roadmap.md' }),
        Object.freeze({ label: 'NDI token', href: 'NdiPoint_README.md' }),
        Object.freeze({ label: 'How we work', href: 'CONTRIBUTING.md' }),
      ]),
    }),
    Object.freeze({
      id: 'support',
      title: 'Support',
      links: Object.freeze([
        Object.freeze({ label: 'Get help', href: 'SUPPORT.md' }),
        Object.freeze({ label: 'Onboarding guide', href: 'docs/ONBOARDING.md' }),
        Object.freeze({ label: 'Local stack setup', href: 'docs/LOCAL_STACK.md' }),
        Object.freeze({ label: 'Developer guide', href: 'DEVELOPMENT.md' }),
        Object.freeze({ label: 'Report a vulnerability', href: 'SECURITY.md#reporting-a-vulnerability' }),
      ]),
    }),
  ]),
  disclosure: Object.freeze({
    title: 'Risk disclosure',
    body: 'DeFi protocols carry risk, including smart-contract bugs, market volatility and liquidity risk. Rewards and yields are never guaranteed, and nothing here is financial advice. Verify contract addresses and only use funds you can afford to lose.',
    linkLabel: 'Read the security policy',
    href: 'SECURITY.md',
  }),
  version: 'dev',
  network: 'unknown',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeLink(link) {
  const source = asObject(link);
  const label = asText(source.label, '');
  const href = asText(source.href, '');

  if (!label || !href) return null;
  return Object.freeze({ label, href });
}

function normalizeGroup(group) {
  const source = asObject(group);
  const links = Array.isArray(source.links)
    ? source.links.map(normalizeLink).filter(Boolean)
    : [];

  return Object.freeze({
    id: asText(source.id, ''),
    title: asText(source.title, ''),
    links: Object.freeze(links),
  });
}

/**
 * Build a complete footer config. Unknown or malformed values fall back to
 * the defaults so a bad override can never break a page.
 */
export function createFooterConfig(overrides = {}) {
  const source = asObject(overrides);
  const groups = Array.isArray(source.groups) && source.groups.length
    ? source.groups.map(normalizeGroup)
    : DEFAULT_FOOTER_CONTENT.groups.map(normalizeGroup);

  return Object.freeze({
    label: asText(source.label, DEFAULT_FOOTER_CONTENT.label),
    brand: Object.freeze({
      label: asText(source.brand?.label, DEFAULT_FOOTER_CONTENT.brand.label),
      href: asText(source.brand?.href, DEFAULT_FOOTER_CONTENT.brand.href),
    }),
    tagline: asText(source.tagline, DEFAULT_FOOTER_CONTENT.tagline),
    groups: Object.freeze(groups.filter((group) => group.title && group.links.length)),
    disclosure: Object.freeze({
      title: asText(source.disclosure?.title, DEFAULT_FOOTER_CONTENT.disclosure.title),
      body: asText(source.disclosure?.body, DEFAULT_FOOTER_CONTENT.disclosure.body),
      linkLabel: asText(source.disclosure?.linkLabel, DEFAULT_FOOTER_CONTENT.disclosure.linkLabel),
      href: asText(source.disclosure?.href, DEFAULT_FOOTER_CONTENT.disclosure.href),
    }),
    version: asText(source.version, DEFAULT_FOOTER_CONTENT.version),
    network: asText(source.network, DEFAULT_FOOTER_CONTENT.network),
  });
}

/**
 * Resolve a footer link to an absolute URL.
 *
 * @param {string} href repository-relative path (or a full URL)
 * @param {string} baseUrl base directory, ending in `/`
 * @param {string} fallbackBase base used when `baseUrl` itself is relative
 */
export function resolveFooterHref(href, baseUrl = DEFAULT_BASE_URL, fallbackBase = DEFAULT_BASE_URL) {
  const path = asText(href, '');
  if (!path) return '';

  try {
    const base = new URL(asText(baseUrl, DEFAULT_BASE_URL), fallbackBase);
    return new URL(path, base).href;
  } catch {
    return path;
  }
}
