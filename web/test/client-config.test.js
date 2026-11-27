import assert from 'node:assert/strict';
import test from 'node:test';

import { loadClientConfig } from '../config/client-config.js';

const CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';

function validEnvironment() {
  return {
    NEXT_PUBLIC_MAINNET_CHAIN_ID: '1',
    NEXT_PUBLIC_MAINNET_RPC_URL: 'https://mainnet.example/rpc',
    NEXT_PUBLIC_TESTNET_CHAIN_ID: '11155111',
    NEXT_PUBLIC_TESTNET_RPC_URL: 'https://testnet.example/rpc',
    NEXT_PUBLIC_MAINNET_NDI_POINT_ADDRESS: CONTRACT_ADDRESS,
    NEXT_PUBLIC_MAINNET_NDI_FI_VAULT_ADDRESS: CONTRACT_ADDRESS,
    NEXT_PUBLIC_MAINNET_NDI_FI_LENDING_ADDRESS: CONTRACT_ADDRESS,
    NEXT_PUBLIC_MAINNET_NDI_STAKING_ADDRESS: CONTRACT_ADDRESS,
    NEXT_PUBLIC_TESTNET_NDI_POINT_ADDRESS: CONTRACT_ADDRESS,
    NEXT_PUBLIC_TESTNET_NDI_FI_VAULT_ADDRESS: CONTRACT_ADDRESS,
    NEXT_PUBLIC_TESTNET_NDI_FI_LENDING_ADDRESS: CONTRACT_ADDRESS,
    NEXT_PUBLIC_TESTNET_NDI_STAKING_ADDRESS: CONTRACT_ADDRESS,
  };
}

test('loads typed chain, RPC, and contract settings for mainnet and testnet', () => {
  const config = loadClientConfig(validEnvironment());

  assert.equal(config.networks.mainnet.chainId, 1);
  assert.equal(config.networks.testnet.chainId, 11155111);
  assert.equal(config.networks.mainnet.rpcUrl, 'https://mainnet.example/rpc');
  assert.deepEqual(Object.keys(config.networks.testnet.addresses), [
    'ndiPoint',
    'ndiFiVault',
    'ndiFiLending',
    'ndiStaking',
  ]);
  assert.equal(config.networks.mainnet.addresses.ndiPoint, CONTRACT_ADDRESS);
  assert.equal(config.networks.testnet.addresses.ndiStaking, CONTRACT_ADDRESS);
  assert.ok(Object.isFrozen(config.networks));
});

test('fails with the exact missing required variable', () => {
  const env = validEnvironment();
  delete env.NEXT_PUBLIC_TESTNET_RPC_URL;

  assert.throws(
    () => loadClientConfig(env),
    /Missing required environment variable: NEXT_PUBLIC_TESTNET_RPC_URL/,
  );
});

test('rejects invalid chain IDs, duplicate chain IDs, unsafe RPC URLs, and invalid addresses', () => {
  const invalidChain = validEnvironment();
  invalidChain.NEXT_PUBLIC_MAINNET_CHAIN_ID = '0';
  assert.throws(() => loadClientConfig(invalidChain), /NEXT_PUBLIC_MAINNET_CHAIN_ID must be a positive integer/);

  const duplicateChain = validEnvironment();
  duplicateChain.NEXT_PUBLIC_TESTNET_CHAIN_ID = duplicateChain.NEXT_PUBLIC_MAINNET_CHAIN_ID;
  assert.throws(() => loadClientConfig(duplicateChain), /Chain ID 1 is configured more than once/);

  const unsafeRpc = validEnvironment();
  unsafeRpc.NEXT_PUBLIC_MAINNET_RPC_URL = 'http://rpc.example';
  assert.throws(() => loadClientConfig(unsafeRpc), /NEXT_PUBLIC_MAINNET_RPC_URL must use HTTPS outside localhost/);

  const invalidAddress = validEnvironment();
  invalidAddress.NEXT_PUBLIC_MAINNET_NDI_POINT_ADDRESS = '0x0';
  assert.throws(() => loadClientConfig(invalidAddress), /NEXT_PUBLIC_MAINNET_NDI_POINT_ADDRESS must be a non-zero 20-byte EVM address/);
});
