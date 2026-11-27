import assert from 'node:assert/strict';
import test from 'node:test';

import { createContractRegistry } from '../config/contract-registry.js';
import { loadClientConfig } from '../config/client-config.js';

const MAINNET_POINT = '0x1111111111111111111111111111111111111111';
const TESTNET_POINT = '0x2222222222222222222222222222222222222222';

function createRegistry() {
  const config = loadClientConfig({
    NEXT_PUBLIC_MAINNET_CHAIN_ID: '1',
    NEXT_PUBLIC_MAINNET_RPC_URL: 'https://mainnet.example/rpc',
    NEXT_PUBLIC_MAINNET_NDI_POINT_ADDRESS: MAINNET_POINT,
    NEXT_PUBLIC_MAINNET_NDI_FI_VAULT_ADDRESS: '0x1111111111111111111111111111111111111112',
    NEXT_PUBLIC_MAINNET_NDI_FI_LENDING_ADDRESS: '0x1111111111111111111111111111111111111113',
    NEXT_PUBLIC_MAINNET_NDI_STAKING_ADDRESS: '0x1111111111111111111111111111111111111114',
    NEXT_PUBLIC_TESTNET_CHAIN_ID: '11155111',
    NEXT_PUBLIC_TESTNET_RPC_URL: 'https://testnet.example/rpc',
    NEXT_PUBLIC_TESTNET_NDI_POINT_ADDRESS: TESTNET_POINT,
    NEXT_PUBLIC_TESTNET_NDI_FI_VAULT_ADDRESS: '0x2222222222222222222222222222222222222222',
    NEXT_PUBLIC_TESTNET_NDI_FI_LENDING_ADDRESS: '0x2222222222222222222222222222222222222223',
    NEXT_PUBLIC_TESTNET_NDI_STAKING_ADDRESS: '0x2222222222222222222222222222222222222224',
  });
  return createContractRegistry(config);
}

test('resolves mainnet and testnet addresses by chain ID and contract name', () => {
  const registry = createRegistry();

  assert.deepEqual(registry.supportedChainIds, [1, 11155111]);
  assert.equal(registry.getContractAddress(1, 'ndiPoint'), MAINNET_POINT);
  assert.equal(registry.getContractAddress('11155111', 'ndiPoint'), TESTNET_POINT);
});

test('selects the address registry from the connected wallet chain', async () => {
  const registry = createRegistry();
  const provider = {
    request: async ({ method }) => {
      assert.equal(method, 'eth_chainId');
      return '0xaa36a7';
    },
  };

  const connected = await registry.getConnectedChainAddresses(provider);
  assert.equal(connected.chainId, 11155111);
  assert.equal(connected.rpcUrl, 'https://testnet.example/rpc');
  assert.equal(connected.addresses.ndiPoint, TESTNET_POINT);
});

test('throws clear errors for unsupported chains, unknown contracts, and invalid providers', async () => {
  const registry = createRegistry();

  assert.throws(
    () => registry.getContractAddress(5, 'ndiPoint'),
    /Unsupported chain ID 5\. Supported chain IDs: 1, 11155111\./,
  );
  assert.throws(
    () => registry.getContractAddress(1, 'unknownContract'),
    /Unknown contract "unknownContract" for chain ID 1/,
  );
  await assert.rejects(
    () => registry.getConnectedChainAddresses({ request: async () => '0x5' }),
    /Unsupported chain ID 5/,
  );
  await assert.rejects(
    () => registry.getConnectedChainAddresses({}),
    /A wallet provider with an EIP-1193 request method is required/,
  );
});
