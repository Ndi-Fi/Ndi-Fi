/**
 * Pure state helpers for the shared Ndi-Fi data tables.
 *
 * Nothing in this module touches the DOM, so the same sorting/filtering rules
 * can be used by the custom element, by server-rendered pages and by tests.
 */

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = Object.freeze([5, 10, 25, 50]);
export const SORT_DIRECTIONS = Object.freeze(['asc', 'desc']);
export const MAX_PAGE_SIZE = 100;

const COLUMN_FORMATS = new Set(['text', 'number', 'currency', 'percent', 'date', 'status', 'mono']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '' && String(value) !== 'all';
}

function normalizeDigits(value) {
  const digits = Number(value);
  return Number.isFinite(digits) && digits >= 0 && digits <= 8 ? Math.floor(digits) : undefined;
}

/** Normalize column definitions so partial overrides cannot break rendering. */
export function normalizeColumns(columns) {
  if (!Array.isArray(columns)) return [];

  const normalized = columns
    .map((column) => {
      const source = asObject(column);
      const key = asText(source.key || source.id || source.name);
      if (!key) return null;

      return {
        key,
        label: asText(source.label || source.header || source.title, key),
        format: COLUMN_FORMATS.has(source.format) ? source.format : 'text',
        align: source.align === 'end' ? 'end' : 'start',
        sortable: source.sortable !== false,
        filterable: source.filterable === true,
        searchable: source.searchable !== false,
        currency: asText(source.currency, 'USD'),
        digits: normalizeDigits(source.digits),
        explicitPrimary: source.primary === true,
      };
    })
    .filter(Boolean);

  // An explicit primary column wins; otherwise the first valid column is the
  // card title on mobile. Invalid definitions must not affect that choice.
  const hasExplicitPrimary = normalized.some((column) => column.explicitPrimary);

  return normalized.map(({ explicitPrimary, ...column }, index) =>
    Object.freeze({
      ...column,
      primary: explicitPrimary || (!hasExplicitPrimary && index === 0),
    }),
  );
}

/** Keep raw row data intact and add a stable internal identifier. */
export function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row, index) => {
    const source = asObject(row);
    return Object.freeze({
      ...source,
      rowId: asText(source.rowId ?? source.id ?? source.txHash, `row-${index}`),
    });
  });
}

export function getCellValue(row, column) {
  if (!row || !column) return '';
  const value = row[column.key];
  return value === undefined || value === null ? '' : value;
}

/** Format a cell for display. All output is plain text; callers escape it. */
export function formatCellValue(value, column = {}, locale = 'en-US') {
  if (value === undefined || value === null || value === '') return '—';

  const format = COLUMN_FORMATS.has(column.format) ? column.format : 'text';
  const digits = normalizeDigits(column.digits);

  if (format === 'date') {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  const numeric = typeof value === 'number' ? value : Number(value);

  if (format === 'currency' && Number.isFinite(numeric)) {
    const currency = column.currency || 'USD';
    const options = {
      minimumFractionDigits: digits ?? 2,
      maximumFractionDigits: digits ?? 2,
    };

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        ...options,
      }).format(numeric);
    } catch {
      // Non-ISO tickers such as USDC/XLM are common in DeFi UIs.
      return `${new Intl.NumberFormat(locale, options).format(numeric)} ${currency}`;
    }
  }

  if (format === 'percent' && Number.isFinite(numeric)) {
    return `${new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits ?? 2,
      maximumFractionDigits: digits ?? 2,
    }).format(numeric)}%`;
  }

  if (format === 'number' && Number.isFinite(numeric)) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits ?? 0,
      maximumFractionDigits: digits ?? 2,
    }).format(numeric);
  }

  return String(value);
}

function sortableValue(value, column) {
  if (value === '' || value === undefined || value === null) {
    return { empty: true, type: 'string', value: '' };
  }

  if (column?.format === 'date') {
    const time = Date.parse(value);
    if (Number.isNaN(time)) return { empty: true, type: 'number', value: 0 };
    return { empty: false, type: 'number', value: time };
  }

  if (typeof value === 'number') {
    return { empty: false, type: 'number', value };
  }

  if (typeof value === 'boolean') {
    return { empty: false, type: 'number', value: value ? 1 : 0 };
  }

  return { empty: false, type: 'string', value: String(value).toLocaleLowerCase() };
}

/** Return a new array sorted by one column; empty cells always sort last. */
export function sortRows(rows, sort, columns = []) {
  if (!Array.isArray(rows) || !sort?.key) return [...rows];

  const column = columns.find((item) => item.key === sort.key);
  if (!column) return [...rows];

  const direction = sort.direction === 'desc' ? -1 : 1;

  return rows
    .map((row, index) => ({ row, index, key: sortableValue(getCellValue(row, column), column) }))
    .sort((a, b) => {
      if (a.key.empty !== b.key.empty) return a.key.empty ? 1 : -1;
      if (a.key.empty) return a.index - b.index;

      let result;
      if (a.key.type === 'number' && b.key.type === 'number') {
        result = a.key.value - b.key.value;
      } else {
        result = String(a.key.value).localeCompare(String(b.key.value), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }

      return result * direction || a.index - b.index;
    })
    .map(({ row }) => row);
}

export function normalizePageSize(value, fallback = DEFAULT_PAGE_SIZE) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return fallback;
  return Math.min(Math.floor(size), MAX_PAGE_SIZE);
}

function filterValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).toLocaleLowerCase());
  return String(value).toLocaleLowerCase();
}

function matchesFilter(cell, expected) {
  const values = Array.isArray(cell) ? cell : [cell];
  const needles = Array.isArray(expected) ? expected : [expected];
  return values.some((value) => needles.includes(value));
}

/** Apply the free-text query and all active column filters. */
export function filterRows(rows, columns = [], query = '', filters = {}) {
  if (!Array.isArray(rows)) return [];

  const needle = asText(query).toLocaleLowerCase();
  const activeFilters = Object.entries(asObject(filters)).filter(([, value]) => hasValue(value));

  return rows.filter((row) => {
    if (needle) {
      const haystack = columns
        .filter((column) => column.searchable)
        .map((column) => filterValue(getCellValue(row, column)))
        .flat()
        .join(' ');
      if (!haystack.includes(needle)) return false;
    }

    return activeFilters.every(([key, value]) => {
      const column = columns.find((item) => item.key === key);
      if (!column) return true;
      const expected = filterValue(value);
      const cell = filterValue(getCellValue(row, column));
      return matchesFilter(cell, expected);
    });
  });
}

/** Build the options shown in each column's filter control. */
export function getFilterOptions(columns, rows) {
  return columns
    .filter((column) => column.filterable)
    .map((column) => {
      const seen = new Map();
      for (const row of rows) {
        const value = getCellValue(row, column);
        const values = Array.isArray(value) ? value : [value];
        for (const item of values) {
          if (!hasValue(item)) continue;
          const raw = String(item);
          if (!seen.has(raw.toLocaleLowerCase())) {
            seen.set(raw.toLocaleLowerCase(), { value: raw, label: formatCellValue(raw, column) });
          }
        }
      }

      return {
        key: column.key,
        label: column.label,
        options: [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
      };
    });
}

/** Return one page of rows, clamping out-of-range page numbers. */
export function paginateRows(rows, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const source = Array.isArray(rows) ? rows : [];
  const size = normalizePageSize(pageSize);

  const total = source.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const requestedPage = Number(page);
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(Math.floor(requestedPage), 1), pageCount)
    : 1;

  const startIndex = (currentPage - 1) * size;

  return Object.freeze({
    rows: source.slice(startIndex, startIndex + size),
    page: currentPage,
    pageSize: size,
    pageCount,
    total,
    start: total ? startIndex + 1 : 0,
    end: Math.min(startIndex + size, total),
  });
}

/** Page numbers with `null` entries marking gaps; used by the pager. */
export function buildPageList(page, pageCount, siblings = 1) {
  const last = Math.max(1, Math.floor(pageCount));
  const current = Math.min(Math.max(1, Math.floor(page)), last);
  const pages = new Set([1, last, current]);

  for (let index = current - siblings; index <= current + siblings; index += 1) {
    if (index >= 1 && index <= last) pages.add(index);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push(null);
    result.push(value);
  });
  return result;
}

/** Everything the element needs for a single render. */
export function buildViewModel({
  columns = [],
  rows = [],
  query = '',
  filters = {},
  sort = null,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  locale = 'en-US',
} = {}) {
  const normalizedColumns = normalizeColumns(columns);
  const normalizedRows = normalizeRows(rows);
  const filteredRows = filterRows(normalizedRows, normalizedColumns, query, filters);
  const sortedRows = sortRows(filteredRows, sort, normalizedColumns);
  const pagination = paginateRows(sortedRows, page, pageSize);

  return Object.freeze({
    columns: normalizedColumns,
    allRows: normalizedRows,
    filteredRows,
    sortedRows,
    filterGroups: getFilterOptions(normalizedColumns, normalizedRows),
    hasActiveFilters: hasValue(query) || Object.values(asObject(filters)).some(hasValue),
    locale: asText(locale, 'en-US'),
    ...pagination,
  });
}
