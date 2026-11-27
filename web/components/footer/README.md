# Shared footer (`<ndi-footer>`)

A framework-agnostic footer component for Ndi-Fi pages. It renders one consistent
set of link groups, a risk disclosure, and a version/network indicator, so pages
do not drift apart.

## Preview

```bash
cd web
python3 -m http.server 8000
# open http://localhost:8000/
```

There is no build step. The component uses standard custom elements, shadow DOM
and ES modules.

## Usage

```html
<meta name="ndi:version" content="unreleased" />
<meta name="ndi:network" content="testnet" />

<ndi-footer base-url="../"></ndi-footer>
<script type="module" src="/components/footer/ndi-footer.js"></script>
```

### Attributes

| Attribute | Default | Purpose |
|---|---|---|
| `base-url` | `https://github.com/Ceejaytech25/Ndi-Fi/blob/main/` | Base directory for repository-relative links. Must end in `/`. Use `../` when the page lives in `web/`. |
| `version` | `ndi:version` meta tag, then `dev` | Version shown in the status indicator. |
| `network` | `ndi:network` meta tag, then `unknown` | Network shown in the status indicator. |
| `label` | `Ndi-Fi site footer` | Accessible name for the footer landmark. |

### Custom content

Pass a JSON object to replace or extend defaults:

```html
<ndi-footer base-url="../">
  <script type="application/json" data-footer-config>
    {
      "tagline": "Protocol UI",
      "groups": [
        {
          "id": "docs",
          "title": "Documentation",
          "links": [{ "label": "Docs", "href": "docs/" }]
        }
      ]
    }
  </script>
</ndi-footer>
```

Only supplied fields are overridden. Malformed JSON is ignored with a console
warning, and missing or invalid link fields fall back to the defaults.

## What it provides

- **Link groups:** documentation, security, governance and support, each in its
  own `<nav aria-labelledby>` region headed by an `<h2>`.
- **Disclosure:** a permanent risk warning with a link to the security policy.
- **Status:** version and network chips, readable by assistive technology and
  settable per deployment.
- **Responsive collapse:** four columns on wide screens, two on tablets, and
  native `<details>`/`<summary>` accordions below 48rem. Groups are forced open
  on wider screens; users can open/close them on mobile.
- **Accessibility:** semantic footer landmark, labelled navigation regions,
  visible focus rings, hidden decorative SVGs, and no colour-only meaning.

## Tests

```bash
cd web && npm test
```

The tests cover config defaults, overrides and URL resolution.
