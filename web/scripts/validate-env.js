import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadClientConfig } from '../config/client-config.js';

const webDirectory = resolve(fileURLToPath(new URL('..', import.meta.url)));

function readDotEnv(path) {
  let contents;
  try {
    contents = readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }

  return Object.fromEntries(
    contents.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) return [];
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      } else {
        value = value.replace(/\s+#.*$/, '').trim();
      }
      return [[match[1], value]];
    }),
  );
}

const env = {
  ...readDotEnv(resolve(webDirectory, '.env')),
  ...readDotEnv(resolve(webDirectory, '.env.local')),
  ...process.env,
};

const config = loadClientConfig(env);
console.log(`Validated client configuration for chain IDs ${Object.values(config.networks).map(({ chainId }) => chainId).join(', ')}.`);
