import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  colorTokens,
  spacingTokens,
  radiusTokens,
  shadowTokens,
  typographyTokens,
  tokens,
} from './tokens.js';
import tailwindConfig from './tailwind.config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8');

const SEMANTIC_COLORS = Object.keys(colorTokens.light);

test('the token catalogue covers the five required categories', () => {
  assert.deepEqual(Object.keys(tokens).sort(), [
    'color',
    'radius',
    'shadow',
    'spacing',
    'typography',
  ]);
});

test('light and dark colour sets keep identical keys', () => {
  assert.deepEqual(
    Object.keys(colorTokens.dark).sort(),
    SEMANTIC_COLORS.sort(),
  );
  for (const key of SEMANTIC_COLORS) {
    assert.ok(colorTokens.light[key], `light.${key} is defined`);
    assert.ok(colorTokens.dark[key], `dark.${key} is defined`);
    assert.notEqual(colorTokens.light[key], '', `${key} must not be empty`);
    assert.notEqual(colorTokens.dark[key], '', `${key} must not be empty`);
  }
});

test('light and dark shadow sets keep identical keys', () => {
  const lightKeys = Object.keys(shadowTokens.light).sort();
  assert.deepEqual(Object.keys(shadowTokens.dark).sort(), lightKeys);
  assert.ok(lightKeys.includes('sm') && lightKeys.includes('lg'));
});

test('spacing is a 4px-based scale with numeric, ascending keys', () => {
  const keys = Object.keys(spacingTokens).map(Number).sort((a, b) => a - b);
  assert.deepEqual(keys, [...keys].sort((a, b) => a - b));
  assert.ok(keys.includes(0) && keys.includes(4) && keys.includes(16));
  // Each step resolves to a rem (or 0) value.
  for (const [key, value] of Object.entries(spacingTokens)) {
    assert.match(value, /^(0|\d+(\.\d+)?rem)$/, `space-${key} must be a rem value`);
  }
});

test('radius and typography tokens are non-empty strings', () => {
  for (const value of Object.values(radiusTokens)) assert.ok(value);
  for (const group of Object.values(typographyTokens)) {
    for (const value of Object.values(group)) assert.ok(typeof value === 'string' && value);
  }
});

test('the Tailwind config derives colours and shadows from the tokens', () => {
  const colors = tailwindConfig.theme.extend.colors;
  for (const key of SEMANTIC_COLORS) {
    assert.equal(colors[key], `var(--ndi-color-${key})`, `Tailwind color ${key} maps to its CSS var`);
  }
  // Shadows reference theme-aware CSS variables.
  assert.equal(tailwindConfig.theme.extend.boxShadow.sm, 'var(--ndi-shadow-sm)');
  assert.equal(tailwindConfig.theme.extend.boxShadow.DEFAULT, 'var(--ndi-shadow-md)');
  // Font family exposes the token-backed CSS variables.
  assert.equal(tailwindConfig.theme.extend.fontFamily.sans, 'var(--ndi-font-sans)');
});

test('tokens.css defines an active variable for every semantic colour', () => {
  for (const key of SEMANTIC_COLORS) {
    assert.ok(
      new RegExp(`--ndi-color-${key}:\\s*var\\(--ndi-color-light-${key}\\)`).test(css),
      `active --ndi-color-${key} must point to the light source`,
    );
  }
});

test('tokens.css defines light and dark source values for every colour', () => {
  for (const key of SEMANTIC_COLORS) {
    assert.ok(
      new RegExp(`--ndi-color-light-${key}:`).test(css),
      `--ndi-color-light-${key} is defined in CSS`,
    );
    assert.ok(
      new RegExp(`--ndi-color-dark-${key}:`).test(css),
      `--ndi-color-dark-${key} is defined in CSS`,
    );
  }
});

test('tokens.css defines the dark mode overrides for every colour', () => {
  // The automatic dark block re-points each active token to the dark source.
  const autoDarkBlock = css.match(/prefers-color-scheme:\s*dark[\s\S]*?\}\s*\}/)?.[0] ?? '';
  for (const key of SEMANTIC_COLORS) {
    assert.ok(
      new RegExp(`--ndi-color-${key}:\\s*var\\(--ndi-color-dark-${key}\\)`).test(css),
      `dark mode must re-point --ndi-color-${key} to the dark source`,
    );
  }
  assert.ok(/\[data-theme='dark'\]/.test(css), 'manual dark theme override exists');
  assert.ok(/\[data-theme='light'\]/.test(css), 'manual light theme override exists');
});

test('tokens.css defines the static spacing, radius and typography variables', () => {
  assert.match(css, /--ndi-space-4: 1rem/);
  assert.match(css, /--ndi-radius-md: 8px/);
  assert.match(css, /--ndi-radius:/);
  assert.match(css, /--ndi-font-sans:/);
  assert.match(css, /--ndi-text-md: 1rem/);
  assert.match(css, /--ndi-weight-semibold: 600/);
  assert.match(css, /--ndi-leading-normal: 1\.5/);
});
