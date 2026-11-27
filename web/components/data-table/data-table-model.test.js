import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPageList,
  buildViewModel,
  DEFAULT_PAGE_SIZE,
  filterRows,
  formatCellValue,
  getFilterOptions,
  normalizeColumns,
  normalizeRows,
  normalizePageSize,
  paginateRows,
  sortRows,
} from './data-table-model.js';

const COLUMNS = normalizeColumns([
  { key: 'asset', label: 'Asset', filterable: true },
  { key: 'type', label: 'Type', filterable: true },
  { key: 'value', label: 'Value', format: 'currency', currency: 'USDC', align: 'end' },
  { key: 'date', label: 'Date', format: 'date' },
]);

const ROWS = normalizeRows([
  { id: 'a', asset: 'NDI', type: 'Staking', value: 100, date: '2026-11-20T12:00:00Z' },
  { id: 'b', asset: 'USDC', type: 'Lending', value: 20, date: '2026-11-21T12:00:00Z' },
  { id: 'c', asset: 'XLM', type: 'Lending', value: 300, date: '2026-11-19T12:00:00Z' },
  { id: 'd', asset: 'NDI / USDC', type: 'Liquidity', value: '', date: 'not-a-date' },
]);

test('normalizeColumns fills defaults and drops invalid definitions', () => {
  const columns = normalizeColumns([
    { key: 'asset', label: 'Asset' },
    { header: 'Missing key' },
    null,
  ]);

  assert.equal(columns.length, 1);
  assert.equal(columns[0].label, 'Asset');
  assert.equal(columns[0].format, 'text');
  assert.equal(columns[0].sortable, true);
  assert.equal(columns[0].filterable, false);
  assert.equal(columns[0].primary, true);
});

test('normalizeColumns honours an explicit primary column over the first column', () => {
  const columns = normalizeColumns([
    { key: 'asset', label: 'Asset' },
    null,
    { key: 'activity', label: 'Activity', primary: true },
  ]);

  assert.equal(columns[0].primary, false);
  assert.equal(columns[1].primary, true);
});

test('normalizeRows adds stable identifiers without mutating input', () => {
  const source = [{ asset: 'NDI' }, { id: 'known', asset: 'USDC' }];
  const rows = normalizeRows(source);

  assert.deepEqual(rows.map((row) => row.rowId), ['row-0', 'known']);
  assert.equal(source[0].rowId, undefined);
  Object.freeze(source);
});

test('formatCellValue handles text, currency, percent, numbers and dates', () => {
  assert.equal(formatCellValue('', COLUMNS[2]), '—');
  assert.equal(formatCellValue(1234.5, COLUMNS[2], 'en-US'), '1,234.50 USDC');
  assert.equal(formatCellValue(12.8, { format: 'percent' }, 'en-US'), '12.80%');
  assert.equal(formatCellValue(1234.5, { format: 'number', digits: 0 }, 'en-US'), '1,235');
  assert.equal(formatCellValue('not-a-date', COLUMNS[3]), 'not-a-date');
  assert.match(formatCellValue('2026-11-20T12:00:00Z', COLUMNS[3], 'en-US'), /Nov 20, 2026/);
});

test('filterRows combines free-text search and column filters', () => {
  assert.deepEqual(filterRows(ROWS, COLUMNS, 'usdc').map((row) => row.id), ['b', 'd']);
  assert.deepEqual(filterRows(ROWS, COLUMNS, '', { type: 'Lending' }).map((row) => row.id), ['b', 'c']);
  assert.deepEqual(filterRows(ROWS, COLUMNS, 'ndi', { type: 'Staking' }).map((row) => row.id), ['a']);
  assert.deepEqual(filterRows(ROWS, COLUMNS, '', { type: 'all' }).map((row) => row.id), ['a', 'b', 'c', 'd']);
});

test('column filters match whole values, not substrings', () => {
  const rows = normalizeRows([
    { id: 'a', type: 'Completed' },
    { id: 'b', type: 'Not Completed' },
  ]);
  const columns = normalizeColumns([{ key: 'type', label: 'Type', filterable: true }]);

  assert.deepEqual(
    filterRows(rows, columns, '', { type: 'Completed' }).map((row) => row.id),
    ['a'],
  );
});

test('sortRows orders numbers and strings, keeps empty cells last and is stable', () => {
  assert.deepEqual(
    sortRows(ROWS, { key: 'value', direction: 'asc' }, COLUMNS).map((row) => row.id),
    ['b', 'a', 'c', 'd'],
  );
  assert.deepEqual(
    sortRows(ROWS, { key: 'value', direction: 'desc' }, COLUMNS).map((row) => row.id),
    ['c', 'a', 'b', 'd'],
  );
  assert.deepEqual(
    sortRows(ROWS, { key: 'asset', direction: 'asc' }, COLUMNS).map((row) => row.id),
    ['a', 'd', 'b', 'c'],
  );
  assert.deepEqual(
    sortRows(ROWS, { key: 'date', direction: 'desc' }, COLUMNS).map((row) => row.id),
    ['b', 'a', 'c', 'd'],
  );
  assert.deepEqual(sortRows(ROWS, null, COLUMNS).map((row) => row.id), ['a', 'b', 'c', 'd']);
});

test('getFilterOptions derives sorted unique values from all rows', () => {
  const groups = getFilterOptions(COLUMNS, ROWS);

  assert.deepEqual(groups.map((group) => group.key), ['asset', 'type']);
  assert.deepEqual(groups[1].options.map((option) => option.value), ['Lending', 'Liquidity', 'Staking']);
  assert.equal(groups[0].options.length, 4);
});

test('paginateRows clamps page numbers and reports the visible range', () => {
  const first = paginateRows(ROWS, 1, 2);
  assert.equal(first.rows.length, 2);
  assert.equal(first.pageCount, 2);
  assert.deepEqual([first.start, first.end], [1, 2]);

  const last = paginateRows(ROWS, 99, 2);
  assert.equal(last.page, 2);
  assert.deepEqual([last.start, last.end], [3, 4]);

  const empty = paginateRows([], 4, 10);
  assert.equal(empty.rows.length, 0);
  assert.equal(empty.pageCount, 1);
  assert.equal(empty.page, 1);
  assert.deepEqual([empty.start, empty.end], [0, 0]);

  assert.equal(paginateRows(ROWS, 1, 0).pageSize, DEFAULT_PAGE_SIZE);
  assert.equal(paginateRows(ROWS, 1, 7.8).pageSize, 7);
  assert.equal(paginateRows(ROWS, 1, 200).pageSize, 100);
  assert.equal(normalizePageSize('12'), 12);
});

test('buildPageList inserts ellipses for large result sets', () => {
  assert.deepEqual(buildPageList(1, 3), [1, 2, 3]);
  assert.deepEqual(buildPageList(5, 12), [1, null, 4, 5, 6, null, 12]);
});

test('buildViewModel integrates filtering, sorting and pagination', () => {
  const model = buildViewModel({
    columns: COLUMNS,
    rows: ROWS,
    query: 'lending',
    sort: { key: 'value', direction: 'desc' },
    page: 1,
    pageSize: 1,
  });

  assert.equal(model.total, 2);
  assert.equal(model.pageCount, 2);
  assert.deepEqual(model.rows.map((row) => row.id), ['c']);
  assert.equal(model.hasActiveFilters, true);
  assert.equal(model.filterGroups.length, 2);
});
