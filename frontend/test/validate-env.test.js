import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEnvExample, parseEnvFile } from '../../scripts/validate-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../..');
const ENV_EXAMPLE_PATH = resolve(ROOT_DIR, '.env.example');

test('.env.example exists and contains valid syntax', () => {
  const result = validateEnvExample(ENV_EXAMPLE_PATH);
  assert.equal(result.valid, true, `Validation failed with issues: ${result.issues.join(', ')}`);
  assert.ok(result.keysCount > 15, 'Should have multiple configured keys');
});

test('.env.example defines all required backend, stellar, and frontend keys', () => {
  const { entries } = parseEnvFile(ENV_EXAMPLE_PATH);

  // Backend
  assert.ok(entries.has('ETH_RPC_URL'), 'ETH_RPC_URL must be defined');
  assert.ok(entries.has('ANVIL_PORT'), 'ANVIL_PORT must be defined');
  assert.ok(entries.has('CHAIN_ID'), 'CHAIN_ID must be defined');
  assert.ok(entries.has('PRIVATE_KEY'), 'PRIVATE_KEY must be defined');

  // Stellar
  assert.ok(entries.has('STELLAR_NETWORK'), 'STELLAR_NETWORK must be defined');
  assert.ok(entries.has('STELLAR_RPC_URL'), 'STELLAR_RPC_URL must be defined');

  // Frontend NEXT_PUBLIC_*
  assert.ok(entries.has('NEXT_PUBLIC_APP_ENV'), 'NEXT_PUBLIC_APP_ENV must be defined');
  assert.ok(entries.has('NEXT_PUBLIC_ETH_RPC_URL'), 'NEXT_PUBLIC_ETH_RPC_URL must be defined');
  assert.ok(entries.has('NEXT_PUBLIC_DEFAULT_CHAIN_ID'), 'NEXT_PUBLIC_DEFAULT_CHAIN_ID must be defined');
  assert.ok(entries.has('NEXT_PUBLIC_STELLAR_NETWORK'), 'NEXT_PUBLIC_STELLAR_NETWORK must be defined');
  assert.ok(entries.has('NEXT_PUBLIC_STELLAR_RPC_URL'), 'NEXT_PUBLIC_STELLAR_RPC_URL must be defined');
});

test('all client-side frontend keys follow NEXT_PUBLIC_* convention', () => {
  const { entries } = parseEnvFile(ENV_EXAMPLE_PATH);
  const frontendKeys = Array.from(entries.keys()).filter((k) => k.startsWith('NEXT_PUBLIC_'));

  assert.ok(frontendKeys.length >= 5, 'Should have at least 5 NEXT_PUBLIC_* variables');
  for (const key of frontendKeys) {
    assert.match(key, /^NEXT_PUBLIC_[A-Z0-9_]+$/, `${key} must follow NEXT_PUBLIC_* uppercase naming`);
  }
});
