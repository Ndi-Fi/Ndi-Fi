# `<ndi-notice-banner>`

Protocol-wide notices — pauses, upgrades, incidents — shown in a prominent,
dismissible banner. Notices come from a remote or local config source, carry a
severity level, and can be dismissed per notice id with persistence. Stale
(expired) notices are never shown. The banner is a status region, not a modal:
it never blocks focus or traps interaction.

## Quick start

```bash
cd web && npm test
```

```html
<link rel="stylesheet" href="../design-tokens/tokens.css" />

<ndi-notice-banner>
  <script type="application/json" data-notice-config>
    {
      "notices": [
        { "id": "pause", "severity": "critical", "title": "Protocol paused", "body": "Withdrawals are halted." },
        { "id": "upgrade", "severity": "info", "title": "v2 deployed", "href": "https://example.com" }
      ]
    }
  </script>
</ndi-notice-banner>

<script type="module" src="./ndi-notice-banner.js"></script>
```

## Attributes

| Attribute | Default | Purpose |
| --- | --- | --- |
| `src` | — | URL to fetch notices from (remote config). Ignored when inline config is present. |
| `poll` | — | Re-fetch interval in seconds. Keeps the banner fresh so stale notices drop automatically. |
| `storage-key` | `ndi:dismissed-notices` | Key used to persist dismissed notice ids. |

## Config source

Notices can be supplied three ways (in priority order):

1. **Inline** — a `<script type="application/json" data-notice-config>` child
   holding a JSON array or `{ "notices": [...] }`.
2. **Remote** — a `src` URL; the banner `fetch`es JSON (array or
   `{ "notices": [...] }`).
3. **Programmatic** — `setFetch(fn)` to supply a custom transport (used in tests).

Invalid JSON, a failed fetch, or an unreachable URL degrades gracefully: the
banner simply shows nothing and logs a warning.

## Notice shape

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Stable identifier used for dismissal persistence |
| `title` | yes | Headline (always visible) |
| `severity` | no | `critical` \| `warning` \| `info` \| `success` (default `info`) |
| `body` | no | Supporting text |
| `href` / `hrefLabel` | no | "Learn more" link (label defaults to "Learn more") |
| `createdAt` | no | Timestamp; used for sorting (defaults to load time) |
| `expiresAt` | no | Timestamp; once in the past the notice is stale and hidden |

Notices are sorted critical-first, then newest-first.

## Severity & accessibility

| Severity | Role | `aria-live` |
| --- | --- | --- |
| `critical` | `alert` | `assertive` |
| `warning` / `info` / `success` | `status` | `polite` |

Each notice is a labelled live region, so screen readers announce updates
without stealing focus. The dismiss button has an `aria-label`
(`Dismiss notice: <title>`), a visible focus ring, and the banner never traps
focus or blocks the page. The container hides itself when empty.

## Dismissal & persistence

Clicking the dismiss button records the notice `id` in the storage backend
(`localStorage` in browsers, an in-memory fallback otherwise) and removes that
notice. Because dismissal is keyed by `id`, it survives reloads: a fresh banner
reading the same storage will not re-show a dismissed notice.

The storage backend is injectable for tests (`setNoticeStorage` in
`notice-config.js`). The banner emits an `ndi-notice-dismiss` event
(`{ detail: { id } }`) when a notice is dismissed.

## Files

| File | Role |
| --- | --- |
| `notice-config.js` | Normalisation, stale filtering, dismiss store, fetch source |
| `ndi-notice-banner.js` | The custom element |
| `ndi-notice-banner.css` | Severity-themed styles using the design tokens |
| `*.test.js` | Config + component tests (`node --test`, no deps) |

## Tests

```bash
cd web && node --test components/notice-banner/
```

Covers severity roles/live regions, inline + remote config loading, stale
filtering, malformed-JSON resilience, dismiss + cross-instance persistence, and
poll validation.
