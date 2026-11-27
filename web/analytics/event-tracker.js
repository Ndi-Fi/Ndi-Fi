const ALLOWED_ACTIONS = new Set([
  'deposit',
  'withdraw',
  'stake',
  'unstake',
  'borrow',
  'repay',
  'claim_rewards',
]);

let optedIn = false;
let eventSink = () => {};

function safeChainId(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function safeAssetSymbol(value) {
  return typeof value === 'string' && /^[A-Z0-9]{1,12}$/.test(value) ? value : undefined;
}

function sanitizeProperties(eventName, properties) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {};

  const clean = {};
  const chainId = safeChainId(properties.chainId);
  if (chainId !== undefined) clean.chainId = chainId;

  if (eventName === 'deposit_started') {
    const assetSymbol = safeAssetSymbol(properties.assetSymbol);
    if (assetSymbol) clean.assetSymbol = assetSymbol;
  }
  if (eventName === 'tx_succeeded' && ALLOWED_ACTIONS.has(properties.action)) {
    clean.action = properties.action;
  }
  return clean;
}

/**
 * Analytics is disabled until the user opts in. A host app may provide a
 * vendor-neutral sink; unknown fields are discarded to prevent PII leakage.
 */
export function setAnalyticsOptIn(enabled) {
  if (typeof enabled !== 'boolean') {
    throw new TypeError('Analytics opt-in must be a boolean');
  }
  optedIn = enabled;
}

export function setEventSink(sink) {
  if (typeof sink !== 'function') {
    throw new TypeError('The event sink must be a function');
  }
  eventSink = sink;
}

export function trackEvent(eventName, properties = {}) {
  if (!['deposit_started', 'tx_succeeded'].includes(eventName)) {
    throw new Error(`Unknown analytics event: ${String(eventName)}`);
  }
  if (!optedIn) return false;

  eventSink(Object.freeze({
    name: eventName,
    ...sanitizeProperties(eventName, properties),
  }));
  return true;
}

export function trackDepositStarted({ chainId, assetSymbol } = {}) {
  return trackEvent('deposit_started', { chainId, assetSymbol });
}

export function trackTransactionSucceeded({ chainId, action } = {}) {
  return trackEvent('tx_succeeded', { chainId, action });
}
