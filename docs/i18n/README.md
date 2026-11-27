# Ndi-Fi Documentation Localization (i18n)

This document describes the internationalization strategy for Ndi-Fi
user-facing documentation: the priority languages, the translation workflow,
the shared glossary, and how coverage is tracked.

---

## Source of truth

All canonical docs are written in **English** and live in `docs/` (or the repo
root for top-level files such as `README.md`). English files are the source of
truth. If an English file is updated, the corresponding translated files are
considered stale until a translator syncs them.

Translated files live under `docs/i18n/<locale>/` and mirror the directory
structure of the English originals:

```
docs/
├── interest-rate-model.md        ← canonical English
├── risk-disclosures.md           ← canonical English
├── i18n/
│   ├── README.md                 ← this file
│   ├── es/
│   │   ├── interest-rate-model.md
│   │   └── risk-disclosures.md
│   ├── fr/
│   │   ├── interest-rate-model.md
│   │   └── risk-disclosures.md
│   └── ...
```

---

## Priority languages and maintainers

The first wave targets communities with high DeFi adoption and active Ndi-Fi
interest. Maintainer slots marked **open** are available for community
contributors — open a PR to volunteer.

| Priority | Language | Locale code | Maintainer |
|---|---|---|---|
| 1 | Spanish | `es` | open |
| 2 | French | `fr` | open |
| 3 | Swahili | `sw` | open |
| 4 | Portuguese (Brazil) | `pt-BR` | open |
| 5 | Chinese (Simplified) | `zh-CN` | open |
| 6 | Arabic | `ar` | open |

To propose a new language, open an issue with the label `i18n` and include the
locale code, estimated community size, and your availability to maintain it.

---

## Translation workflow

### Starting a new translation

1. Copy the canonical English file into `docs/i18n/<locale>/` using the same
   filename.
2. Add the front-matter block below at the top of the translated file.
3. Translate the body. Do not translate code blocks, contract names, Solidity
   variable names, or glossary terms that have a locale-specific rendering
   listed in the [glossary](#glossary) section.
4. Open a PR with the title format `i18n(<locale>): translate <filename>` and
   assign the locale maintainer as reviewer.

**Front-matter block:**

```yaml
---
locale: es
source: docs/risk-disclosures.md
source_commit: <git SHA of the English file you translated>
translated_by: <GitHub handle>
reviewed_by: ~
last_updated: YYYY-MM-DD
---
```

### Updating an existing translation

When the English source file changes:

1. Find the diff between the commit recorded in `source_commit` and the current
   `HEAD`.
2. Apply the equivalent change to the translated file.
3. Update `source_commit` and `last_updated` in the front-matter.
4. Open a PR with the title format `i18n(<locale>): update <filename>`.

If a translator is unavailable, the stale translated file should display a
notice at the top:

```md
> **Note:** This translation may be out of date.
> [Read the current English version](../../risk-disclosures.md).
```

---

## Tracking coverage

Coverage is measured as the number of canonical English documents that have an
up-to-date translation for each locale. "Up-to-date" means the `source_commit`
in the front-matter matches the latest commit that touched the English source.

The table below is updated manually with each translation PR. Automated
coverage tooling is planned for Phase 2.

| Document | `es` | `fr` | `sw` | `pt-BR` | `zh-CN` | `ar` |
|---|---|---|---|---|---|---|
| `docs/risk-disclosures.md` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| `docs/interest-rate-model.md` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

Legend: ✅ up-to-date · 🟡 stale · ⬜ not started

---

## In-app help strings

Short UI strings (term definitions, tooltips, error messages) are localized
separately in the `frontend/` module. See
[`frontend/src/help-content.js`](../../frontend/src/help-content.js) and the
locale files under [`frontend/src/locales/`](../../frontend/src/locales/).

Adding a new language to the UI requires:

1. Creating `frontend/src/locales/<code>.js` by copying `en.js` and
   translating the content.
2. Registering the locale in the `LOCALES` map in
   `frontend/src/help-content.js`.
3. Adding test assertions for the new locale's UI labels.

Refer to `frontend/README.md` for the full steps and testing instructions.

---

## Glossary

The following terms have approved translations. Use these consistently across
all translated documents and UI strings. Do not invent alternative renderings.

| English | `es` | `fr` | Notes |
|---|---|---|---|
| Collateral | Garantía | Collatéral | |
| Collateral factor | Factor de garantía | Facteur de collatéral | |
| Health factor | Factor de salud | Facteur de santé | |
| Liquidation | Liquidación | Liquidation | Same word in `fr` |
| Vault shares | Participaciones del vault | Parts de vault | Keep "vault" untranslated |
| Utilization rate | Tasa de utilización | Taux d'utilisation | |
| Origination fee | Comisión de apertura | Frais d'ouverture | |
| Staking | Staking | Staking | Keep in English; add a gloss on first use |
| Oracle | Oráculo | Oracle | |
| Smart contract | Contrato inteligente | Contrat intelligent | |

For languages not yet in this table, translators should propose entries in
their first PR. The maintainer approves additions before merging.

---

## Related docs

- [Risk disclosures](../risk-disclosures.md) — first priority for translation
- [Interest rate model](../interest-rate-model.md) — second priority
- [Frontend help strings](../../frontend/README.md)
- [Contributing guide](../../CONTRIBUTING.md)
