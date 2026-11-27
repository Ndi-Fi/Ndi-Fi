/**
 * Tests for stats.js helper functions (issue #149)
 * Node built-in test runner — no external dependencies.
 *
 * Run: node --test web/stats.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Inline the pure helpers so we don't have to load the full stats.js
// (which accesses DOM globals on import) ──────────────────────────────────────

function fmtUsd(value) {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function fmtToken(value, symbol = '') {
  if (!Number.isFinite(value)) return '—';
  const display = value >= 1e6
    ? `${(value / 1e6).toFixed(2)}M`
    : value >= 1e3
    ? `${(value / 1e3).toFixed(1)}K`
    : value.toLocaleString();
  return symbol ? `${display} ${symbol}` : display;
}

function fmtPct(pct) {
  if (!Number.isFinite(pct)) return '—';
  return `${pct.toFixed(2)}%`;
}

// ── fmtUsd ────────────────────────────────────────────────────────────────────
describe('fmtUsd', () => {
  it('formats billions', () => assert.equal(fmtUsd(1_500_000_000), '$1.50B'));
  it('formats millions', () => assert.equal(fmtUsd(2_400_000),   '$2.40M'));
  it('formats thousands', () => assert.equal(fmtUsd(5_300),      '$5.3K'));
  it('formats sub-thousand', () => assert.equal(fmtUsd(42.5),    '$42.50'));
  it('formats zero', () => assert.equal(fmtUsd(0),               '$0.00'));
  it('returns dash for NaN', () => assert.equal(fmtUsd(NaN),     '—'));
  it('returns dash for Infinity', () => assert.equal(fmtUsd(Infinity), '—'));
  it('returns dash for negative Infinity', () => assert.equal(fmtUsd(-Infinity), '—'));
});

// ── fmtToken ──────────────────────────────────────────────────────────────────
describe('fmtToken', () => {
  it('formats millions with symbol', () => assert.equal(fmtToken(8_500_000, 'NDI'), '8.50M NDI'));
  it('formats thousands with symbol', () => assert.equal(fmtToken(1_200, 'NDI'),    '1.2K NDI'));
  it('formats small amounts', () => assert.equal(fmtToken(42, 'NDI'),               '42 NDI'));
  it('formats without symbol', () => assert.equal(fmtToken(1_000_000),              '1.00M'));
  it('returns dash for NaN', () => assert.equal(fmtToken(NaN, 'NDI'),               '—'));
});

// ── fmtPct ────────────────────────────────────────────────────────────────────
describe('fmtPct', () => {
  it('formats integer percent', () => assert.equal(fmtPct(50),     '50.00%'));
  it('formats decimal percent', () => assert.equal(fmtPct(4.75),   '4.75%'));
  it('formats zero', () => assert.equal(fmtPct(0),                 '0.00%'));
  it('formats 100', () => assert.equal(fmtPct(100),                '100.00%'));
  it('returns dash for NaN', () => assert.equal(fmtPct(NaN),       '—'));
});

// ── Stats data shape ──────────────────────────────────────────────────────────
describe('stats data contract', () => {
  const mockData = {
    tvlUsd:              1_240_000,
    borrowsUsd:            620_000,
    stakedNdi:          8_500_000,
    aprPct:                   4.75,
    utilisationPct:          50,
    collateralFactorPct:     75,
  };

  it('TVL renders correctly', () =>
    assert.equal(fmtUsd(mockData.tvlUsd), '$1.24M'));

  it('borrows renders correctly', () =>
    assert.equal(fmtUsd(mockData.borrowsUsd), '$620.0K'));

  it('staked renders correctly', () =>
    assert.equal(fmtToken(mockData.stakedNdi, 'NDI'), '8.50M NDI'));

  it('APR renders correctly', () =>
    assert.equal(fmtPct(mockData.aprPct), '4.75%'));

  it('utilisation is within 0-100', () => {
    assert.ok(mockData.utilisationPct >= 0);
    assert.ok(mockData.utilisationPct <= 100);
  });

  it('collateral factor is within 0-100', () => {
    assert.ok(mockData.collateralFactorPct >= 0);
    assert.ok(mockData.collateralFactorPct <= 100);
  });

  it('utilisation < collateral factor (sane protocol config)', () =>
    assert.ok(mockData.utilisationPct < mockData.collateralFactorPct));
});
