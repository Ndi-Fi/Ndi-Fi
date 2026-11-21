# Ndi-Fi Documentation Localization (i18n)

This document describes the internationalization strategy for Ndi-Fi user-facing documentation: the priority languages, the translation workflow, the glossary, and how translation coverage is tracked.

---

## Priority languages and maintainers

The first wave of translations targets communities with high DeFi adoption and active Ndi-Fi interest. The table below records the priority order and the designated maintainer for each language. Maintainer slots marked **open** are available for community contributors — open a PR to volunteer.

| Priority | Language | Locale code | Maintainer |
|---|---|---|---|
| 1 | Spanish | `es` | open |
| 2 | French | `fr` | open |
| 3 | Swahili | `sw` | open |
| 4 | Portuguese (Brazil) | `pt-BR` | open |
| 5 | Chinese (Simplified) | `zh-CN` | open |
| 6 | Arabic | `ar` | open |

To propose a new language, open an issue with the label `i18n` and include the locale code, estimated community size, and your availability to maintain it.

---

## Directory structure

Translated documents live under `docs/i18n/<locale>/`, mirroring the structure of the canonical English docs.

```
docs/
├── interest-rate-model.md        ← canonical English (source of truth)
├── risk-disclosures.md           ← canonical English (source of truth)
├── i18n/
│   ├── README.md                 ← this file
│   ├── es/
│   │   ├── interest-rate-model.md
│   │   └── risk-disclosures.md
│   ├── fr/
│   │   └── ...
│   └── ...
```

The canonical English files are the **source of truth**. If an English doc is updated, the corresponding translated files are considered stale until a translator updates them.

---

## Translation workflow

### Starting a new translation

1. Copy the canonical English file into `docs/i18n/<locale>/` with the same filename.
2. Add the front-matter block below at the top of the file.
3. Translate the content. Do not translate code blocks, contract names, variable names, or items in the [glossary](#glossary) unless a locale-specific rendering is explicitly listed there.
4. Open a PR with the title format `i18n(<locale>): translate <filename>` and assign it to the maintainer for that locale.

**Front-matter block:**

```yaml
---
locale: es
source: docs/interest-rate-model.md
source_commit: <git SHA of the English file this translation was based on>
translated_by: <GitHub username>
last_reviewed: YYYY-MM-DD
---
```

### Updating a translation after English changes

1. Run `git log --oneline docs/<filename>.md` to find the commit SHA the translation was last based on.
2. Diff the English file from that SHA to `HEAD` to see what changed.
3. Apply the equivalent changes to the translated file.
4. Update `source_commit` and `last_reviewed` in the front-matter.
5. Open a PR as above.

### Review process

- Each translation PR requires approval from the locale maintainer or, if the slot is open, from any two contributors with merged i18n contributions.
- The English-language maintainer reviews only for structural correctness (front-matter, code blocks, links), not for linguistic accuracy.

---

## Glossary

The following terms must be translated consistently. Where no translation is listed, use the English term.

| English term | es | fr | sw | pt-BR | zh-CN | ar |
|---|---|---|---|---|---|---|
| collateral | garantía | garantie | dhamana | garantia | 抵押品 | ضمان |
| origination fee | comisión de apertura | frais d'ouverture | ada ya kuanzisha | taxa de originação | 手续费 | رسوم الإنشاء |
| utilization rate | tasa de utilización | taux d'utilisation | kiwango cha matumizi | taxa de utilização | 使用率 | معدل الاستخدام |
| health factor | factor de salud | facteur de santé | kiwango cha afya | fator de saúde | 健康因子 | معامل الصحة |
| liquidation | liquidación | liquidation | uuzaji wa lazima | liquidação | 清算 | تصفية |
| staking | staking | staking | staking | staking | 质押 | ستاكينج |
| vault | bóveda | coffre | hazina | cofre | 金库 | خزينة |
| borrow rate | tasa de préstamo | taux d'emprunt | kiwango cha mkopo | taxa de empréstimo | 借贷利率 | معدل الاقتراض |

Add rows or locale columns via PR. All additions must be reviewed by the locale maintainer.

---

## Canonical English as source of truth

- The English files under `docs/` are the authoritative versions.
- In any conflict between an English doc and a translation, the English doc is correct.
- Translated files must not introduce information, warnings, or examples that are not in the English source.
- Link targets in translated files should point to the English versions unless a translated equivalent exists.

---

## Tracking translation coverage

Coverage is tracked in `docs/i18n/coverage.md`. It lists every translatable document, the available locales, and the git SHA of the English source each translation was last synced to.

| Document | es | fr | sw | pt-BR | zh-CN | ar |
|---|---|---|---|---|---|---|
| `interest-rate-model.md` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `risk-disclosures.md` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Key:** ✅ = up to date with current English SHA · 🔄 = translated but stale (English updated since) · ❌ = not yet translated

Update this table as part of every translation PR. A CI check will eventually automate staleness detection by comparing `source_commit` in the front-matter to `git log` output for the canonical file.
