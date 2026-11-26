import assert from 'node:assert/strict';
import test from 'node:test';

import { buildViewModel, formatCellValue, getCellValue } from './data-table-model.js';
import { getTablePreset, TABLE_PRESETS } from './data-table-presets.js';

for (const [name, preset] of Object.entries(TABLE_PRESETS)) {
  test(`${name} preset exposes sortable, accessible columns and unique row ids`, () => {
    const model = buildViewModel(preset);

    assert.ok(preset.label);
    assert.ok(preset.emptyMessage);
    assert.ok(model.columns.length >= 5);
    assert.equal(model.columns[0].primary, true);
    assert.ok(model.columns.every((column) => column.label && column.key));
    assert.ok(model.columns.every((column) => !column.sortable || column.label));

    const ids = model.allRows.map((row) => row.rowId);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every(Boolean));

    for (const row of model.allRows) {
      for (const column of model.columns) {
        const formatted = formatCellValue(getCellValue(row, column), column, 'en-US');
        assert.ok(formatted.length > 0);
      }
    }
  });
}

test('positions and history presets cover different data shapes', () => {
  const positions = TABLE_PRESETS.positions;
  const history = TABLE_PRESETS.history;

  assert.ok(positions.columns.some((column) => column.key === 'health'));
  assert.ok(positions.rows.every((row) => typeof row.health === 'number'));
  assert.ok(history.columns.some((column) => column.key === 'date' && column.format === 'date'));
  assert.ok(history.rows.every((row) => !Number.isNaN(Date.parse(row.date))));
  assert.ok(history.rows.every((row) => typeof row.tx === 'string'));
});

test('unknown and inherited preset names fall back to positions', () => {
  assert.equal(getTablePreset('missing'), TABLE_PRESETS.positions);
  assert.equal(getTablePreset('constructor'), TABLE_PRESETS.positions);
  assert.equal(getTablePreset('__proto__'), TABLE_PRESETS.positions);
  assert.equal(getTablePreset('history'), TABLE_PRESETS.history);
});
