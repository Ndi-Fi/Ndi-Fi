# Responsive data tables (`<ndi-data-table>`)

A framework-agnostic table component for Ndi-Fi position and activity data. It
keeps one interaction model across layouts: semantic table rows on wide screens,
stacked cards on mobile, and shared sort/filter/pagination states in both.

## Preview

```bash
cd web
python3 -m http.server 8000
# open http://localhost:8000/data-tables.html
```

There is no build step. The component uses standard custom elements, shadow DOM
and ES modules.

## Usage

```html
<ndi-data-table variant="positions" label="Open positions"></ndi-data-table>
<ndi-data-table variant="history" page-size="10"></ndi-data-table>

<script type="module" src="/components/data-table/ndi-data-table.js"></script>
```

### Attributes

| Attribute | Default | Purpose |
|---|---|---|
| `variant` | `positions` | Selects the `positions` or `history` column/data preset. |
| `label` | Preset label | Accessible name for the table region and card list. |
| `description` | Preset description | Short helper text under the heading. |
| `page-size` | Preset `pageSize` (5) | Initial rows per page. Values outside the preset list are added to the selector; values above 100 clamp to 100. |
| `loading` | Absent | Shows the announced loading state instead of rows. |
| `empty-message` | Preset `emptyMessage` | Copy used when there are no rows at all. |

### Custom data

Pass rows and column definitions with a JSON script. Unknown fields fall back
to the selected preset.

```html
<ndi-data-table variant="history">
  <script type="application/json" data-table-config>
    {
      "columns": [
        { "key": "activity", "label": "Activity" },
        { "key": "amount", "label": "Amount", "format": "currency", "currency": "USDC", "align": "end" }
      ],
      "rows": [
        { "id": "tx-1", "activity": "Claimed rewards", "amount": 42.5 }
      ]
    }
  </script>
</ndi-data-table>
```

Column fields:

| Field | Values | Purpose |
|---|---|---|
| `key` | string | Row property to read (required; invalid columns are dropped). |
| `label` | string | Visible header and card label. |
| `format` | `text`, `number`, `currency`, `percent`, `date`, `status`, `mono` | Cell formatting. Non-ISO tickers such as `USDC` fall back to `1,234.50 USDC`. |
| `currency` | string | Currency code/ticker for `currency` cells. |
| `digits` | 0–8 | Decimal places for numeric formats. |
| `align` | `start`, `end` | Numeric columns should use `end`. |
| `sortable` | boolean (default `true`) | Controls header and toolbar sorting. |
| `filterable` | boolean (default `false`) | Adds a derived-value filter select. |
| `searchable` | boolean (default `true`) | Includes the column in free-text search. |
| `primary` | boolean | Used as the card title; the first column is primary by default. |

### JavaScript API

```js
const table = document.querySelector('ndi-data-table');

table.setRows(newRows);                 // replace data, reset to page 1
table.setRows(newRows, newColumns);     // replace data and columns
table.setLoading(true);                 // same as adding the `loading` attribute
table.getState();                       // { variant, query, filters, sort, page, pageSize }
```

Interactive changes and the `setRows()`/`setLoading()` helpers dispatch a
cancel-free `ndi-table-change` event whose `detail` matches `getState()`. This
lets a host page fetch a new page of data without knowing the component
internals. Setting attributes directly updates the view but does not emit an
event.

## What it provides

- **Responsive layouts:** desktop uses `<table>` with `<caption>`, `<thead>` and
  `<th scope>`; below 48rem the same rows render as an accessible card list.
- **Sorting:** clickable column headers (`aria-sort`) plus a toolbar sort select
  and direction toggle that works on mobile.
- **Filtering:** a debounce-free search field (`type="search"`) and one derived
  select per filterable column. Filters combine with AND; search and filters
  combine with AND too.
- **Pagination:** page-size control, previous/next buttons, numbered pages with
  ellipses, `aria-current="page"`, and a live "Showing x–y of z rows" summary.
- **States:** `role="status"` announcements, skeleton rows for loading, a
  distinct empty-data vs no-matches message, and a "Clear filters" action.
- **Accessibility:** labelled controls, visible focus rings, hidden decorative
  icons, escaped cell content, and status badges that use text—not colour
  alone—to convey meaning.

## Pure helpers

`data-table-model.js` contains the DOM-free sort/filter/paginate logic. It can
be reused by server-rendered pages and is covered directly by unit tests.
`data-table-presets.js` holds the positions/history column designs and demo
rows.

## Tests

```bash
cd web && npm test
```

Tests cover state helpers, presets, and rendered desktop/mobile/loading/empty
markup.
