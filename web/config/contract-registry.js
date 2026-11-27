function normalizeChainId(value) {
  let chainId = value;
  if (typeof chainId === 'string') {
    if (/^0x[0-9a-f]+$/i.test(chainId)) {
      chainId = Number.parseInt(chainId.slice(2), 16);
    } else if (/^\d+$/.test(chainId)) {
      chainId = Number(chainId);
    }
  } else if (typeof chainId === 'bigint' && chainId <= BigInt(Number.MAX_SAFE_INTEGER)) {
    chainId = Number(chainId);
  }

  if (!Number.isSafeInteger(chainId) || chainId < 1) {
    throw new TypeError(`Invalid chain ID: ${String(value)}`);
  }
  return chainId;
}

/**
 * Create lookups for the configured networks and their deployed contracts.
 * The wallet's connected chain is authoritative; there is no silent fallback.
 */
export function createContractRegistry(config) {
  if (!config?.networks || typeof config.networks !== 'object') {
    throw new TypeError('A valid client configuration is required');
  }

  const networks = new Map(
    Object.values(config.networks).map((network) => [normalizeChainId(network.chainId), network]),
  );
  const supportedChainIds = [...networks.keys()].sort((a, b) => a - b);

  function getNetworkConfig(chainId) {
    const id = normalizeChainId(chainId);
    const network = networks.get(id);
    if (!network) {
      throw new Error(
        `Unsupported chain ID ${id}. Supported chain IDs: ${supportedChainIds.join(', ')}.`,
      );
    }
    return network;
  }

  function getContractAddress(chainId, contractName) {
    const network = getNetworkConfig(chainId);
    const address = network.addresses[contractName];
    if (!address) {
      throw new Error(`Unknown contract "${contractName}" for chain ID ${network.chainId}.`);
    }
    return address;
  }

  async function getConnectedChainAddresses(provider) {
    if (!provider || typeof provider.request !== 'function') {
      throw new TypeError('A wallet provider with an EIP-1193 request method is required');
    }
    const chainId = await provider.request({ method: 'eth_chainId' });
    const network = getNetworkConfig(chainId);
    return Object.freeze({
      chainId: network.chainId,
      rpcUrl: network.rpcUrl,
      addresses: network.addresses,
    });
  }

  return Object.freeze({
    supportedChainIds: Object.freeze(supportedChainIds),
    getNetworkConfig,
    getContractAddress,
    getConnectedChainAddresses,
  });
}

export { normalizeChainId };
