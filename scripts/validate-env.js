#!/usr/bin/env node

/**
 * Build-time and pre-flight validator for .env.example and .env.
 *
 * Ensures:
 * 1. .env.example exists, is well-formed, and has no duplicate keys.
 * 2. Required backend and frontend environment variables are documented.
 * 3. Frontend client variables follow the NEXT_PUBLIC_* naming convention.
 * 4. When .env is present (or in --strict mode), verifies all required keys exist.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const ENV_EXAMPLE_PATH = resolve(ROOT_DIR, '.env.example');
const ENV_PATH = resolve(ROOT_DIR, '.env');

const REQUIRED_BACKEND_KEYS = [
  'ETH_RPC_URL',
  'ANVIL_PORT',
  'CHAIN_ID',
  'PRIVATE_KEY',
];

const REQUIRED_STELLAR_KEYS = [
  'STELLAR_NETWORK',
  'STELLAR_RPC_URL',
];

const REQUIRED_FRONTEND_KEYS = [
  'NEXT_PUBLIC_APP_ENV',
  'NEXT_PUBLIC_ETH_RPC_URL',
  'NEXT_PUBLIC_DEFAULT_CHAIN_ID',
  'NEXT_PUBLIC_STELLAR_NETWORK',
  'NEXT_PUBLIC_STELLAR_RPC_URL',
];

export function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Environment file does not exist at: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const entries = new Map();
  const errors = [];

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Skip empty lines and full-line comments
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      errors.push(`Line ${lineNum}: Invalid syntax '${trimmed}' (expected KEY=VALUE)`);
      return;
    }

    const [, key, rawValue] = match;
    if (entries.has(key)) {
      errors.push(`Line ${lineNum}: Duplicate key '${key}' already defined on line ${entries.get(key).lineNum}`);
      return;
    }

    // Strip optional surrounding quotes and inline comments
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      const commentIndex = value.indexOf(' #');
      if (commentIndex !== -1) {
        value = value.substring(0, commentIndex).trim();
      }
    }

    entries.set(key, { value, lineNum });
  });

  return { entries, errors };
}

export function validateEnvExample(examplePath = ENV_EXAMPLE_PATH) {
  const issues = [];
  const warnings = [];

  let parsed;
  try {
    parsed = parseEnvFile(examplePath);
  } catch (err) {
    return { valid: false, issues: [err.message], warnings };
  }

  issues.push(...parsed.errors);
  const keys = parsed.entries;

  // 1. Check required backend keys
  for (const key of REQUIRED_BACKEND_KEYS) {
    if (!keys.has(key)) {
      issues.push(`Missing required backend key in .env.example: ${key}`);
    }
  }

  // 2. Check required Stellar keys
  for (const key of REQUIRED_STELLAR_KEYS) {
    if (!keys.has(key)) {
      issues.push(`Missing required Stellar key in .env.example: ${key}`);
    }
  }

  // 3. Check required frontend keys
  for (const key of REQUIRED_FRONTEND_KEYS) {
    if (!keys.has(key)) {
      issues.push(`Missing required frontend key in .env.example: ${key}`);
    }
  }

  // 4. Validate NEXT_PUBLIC_* convention for frontend variables
  for (const [key] of keys) {
    if (key.startsWith('NEXT_PUBLIC_')) {
      if (key.length <= 'NEXT_PUBLIC_'.length) {
        issues.push(`Invalid frontend variable name '${key}' (must have descriptive name after prefix)`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    keysCount: keys.size,
  };
}

export function validateEnvFile(envPath = ENV_PATH, examplePath = ENV_EXAMPLE_PATH) {
  const issues = [];
  const warnings = [];

  if (!existsSync(envPath)) {
    return {
      valid: true,
      skipped: true,
      message: `.env file not found at ${envPath} (optional in CI/clean checkout)`,
      issues,
      warnings,
    };
  }

  const exampleParsed = parseEnvFile(examplePath);
  const envParsed = parseEnvFile(envPath);

  issues.push(...envParsed.errors);

  // Check that all required backend, stellar, and frontend keys exist in .env
  const allRequired = [
    ...REQUIRED_BACKEND_KEYS,
    ...REQUIRED_STELLAR_KEYS,
    ...REQUIRED_FRONTEND_KEYS,
  ];

  for (const key of allRequired) {
    if (!envParsed.entries.has(key)) {
      issues.push(`Missing key in .env required by .env.example: ${key}`);
    }
  }

  return {
    valid: issues.length === 0,
    skipped: false,
    issues,
    warnings,
    keysCount: envParsed.entries.size,
  };
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('validate-env.js')) {
  const checkOnlyExample = process.argv.includes('--check-example');
  const strictEnv = process.argv.includes('--strict');

  console.log('==> Validating .env.example specification...');
  const exampleResult = validateEnvExample();

  if (!exampleResult.valid) {
    console.error('\x1b[31m[ERROR] .env.example validation failed:\x1b[0m');
    exampleResult.issues.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log(`\x1b[32m[OK]\x1b[0m .env.example is valid (${exampleResult.keysCount} keys configured).`);

  if (!checkOnlyExample) {
    console.log('==> Checking active .env file (if present)...');
    const envResult = validateEnvFile();

    if (envResult.skipped) {
      if (strictEnv) {
        console.error('\x1b[31m[ERROR] .env file is strictly required but not found.\x1b[0m');
        process.exit(1);
      }
      console.log(`\x1b[33m[INFO]\x1b[0m ${envResult.message}`);
    } else if (!envResult.valid) {
      console.error('\x1b[31m[ERROR] .env validation failed:\x1b[0m');
      envResult.issues.forEach((err) => console.error(`  - ${err}`));
      process.exit(1);
    } else {
      console.log(`\x1b[32m[OK]\x1b[0m Active .env contains all required keys (${envResult.keysCount} keys).`);
    }
  }

  console.log('\x1b[32m[SUCCESS]\x1b[0m Environment validation passed.');
}
