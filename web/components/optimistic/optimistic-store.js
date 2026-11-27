/**
 * Optimistic UI store for Ndi-Fi.
 *
 * Reflects a submitted transaction immediately by applying its speculative
 * delta to the known (confirmed) state, then reconciles with confirmed state
 * on success or rolls back on failure. Each transaction is keyed by a unique
 * nonce/id; a duplicate key is rejected to guard against race conditions.
 *
 * State shape:
 *   { balances: Map<string, bigint>, positions: Map<string, Position> }
 *
 * Delta shape (applied on top of confirmed state):
 *   {
 *     balances: { DAI: 10n, ETH: -1n },          // additive (bigint)
 *     positions: { 'pool-1': { staked: 50n } }    // merged (bigint fields add, others replace)
 *   }
 *
 * Lifecycle:
 *   submit(key, delta)  -> optimistic delta applied, status 'pending'
 *   confirm(key)        -> marks 'confirmed', refetches confirmed state, clears
 *                          confirmed deltas once the fresh base is set
 *   fail(key)           -> rolls back: removes the pending delta
 *
 * @example
 * const store = new OptimisticStore({
 *   refetch: async () => fetchBalancesAndPositions(),
 * });
 * store.setBaseState({ balances: { DAI: 100n }, positions: {} });
 * store.submit('nonce-7', { balances: { DAI: -40n } });
 * // UI shows DAI 60 immediately
 * try { await sendTx(); await store.confirm('nonce-7'); }
 * catch { store.fail('nonce-7'); }
 */

function toMap(obj) {
  const map = new Map();
  if (obj && typeof obj === 'object') {
    if (obj instanceof Map) {
      for (const [k, v] of obj) map.set(k, v);
    } else {
      for (const [k, v] of Object.entries(obj)) map.set(k, v);
    }
  }
  return map;
}

function normalizeState(state) {
  const s = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  const balances = s.balances instanceof Map ? new Map(s.balances) : toMap(s.balances);
  const positions =
    s.positions instanceof Map
      ? new Map([...s.positions].map(([k, v]) => [k, { ...v }]))
      : new Map([...toMap(s.positions)].map(([k, v]) => [k, v && typeof v === 'object' ? { ...v } : v]));
  return { balances, positions };
}

function normalizeDelta(delta) {
  const d = delta && typeof delta === 'object' && !Array.isArray(delta) ? delta : {};
  const balances = {};
  if (d.balances && typeof d.balances === 'object') {
    for (const [k, v] of Object.entries(d.balances)) balances[k] = v;
  }
  const positions = {};
  if (d.positions && typeof d.positions === 'object') {
    for (const [k, v] of Object.entries(d.positions)) {
      positions[k] = v && typeof v === 'object' ? { ...v } : v;
    }
  }
  return { balances, positions };
}

function applyBalanceDelta(balances, delta) {
  for (const [token, amount] of Object.entries(delta)) {
    if (typeof amount !== 'bigint') continue; // balances are bigint
    balances.set(token, (balances.get(token) ?? 0n) + amount);
  }
}

function mergePosition(existing, delta) {
  const out = existing ? { ...existing } : {};
  for (const [field, value] of Object.entries(delta)) {
    const current = out[field];
    // Additive for bigint numeric fields; replace otherwise.
    out[field] = typeof current === 'bigint' && typeof value === 'bigint' ? current + value : value;
  }
  return out;
}

function applyPositionDelta(positions, delta) {
  for (const [id, posDelta] of Object.entries(delta)) {
    if (!posDelta || typeof posDelta !== 'object') continue;
    positions.set(id, mergePosition(positions.get(id), posDelta));
  }
}

function applyDelta(state, delta) {
  if (delta.balances) applyBalanceDelta(state.balances, delta.balances);
  if (delta.positions) applyPositionDelta(state.positions, delta.positions);
}

function cloneState(state) {
  return {
    balances: new Map(state.balances),
    positions: new Map([...state.positions].map(([k, v]) => [k, { ...v }])),
  };
}

export class OptimisticStore {
  #base = { balances: new Map(), positions: new Map() };
  #pending = new Map(); // key -> { delta, status, submittedAt }
  #refetch = null;
  #listeners = new Set();

  constructor({ refetch } = {}) {
    if (refetch != null) this.setRefetch(refetch);
  }

  /** Provide the async function that returns a fresh confirmed state. */
  setRefetch(fn) {
    if (fn != null && typeof fn !== 'function') {
      throw new TypeError('refetch must be a function');
    }
    this.#refetch = fn ?? null;
  }

  /** Replace the confirmed base state. Clears any deltas whose tx confirmed. */
  setBaseState(state) {
    this.#base = normalizeState(state);
    for (const [key, tx] of this.#pending) {
      if (tx.status === 'confirmed') this.#pending.delete(key);
    }
    this.#emit();
  }

  getBaseState() {
    return cloneState(this.#base);
  }

  /**
   * Apply a transaction's optimistic delta. The `key` (tx nonce/id) must be
   * unique among in-flight transactions; reusing one is treated as a race
   * condition and rejected.
   */
  submit(key, delta) {
    if (typeof key !== 'string' || key.trim() === '') {
      throw new TypeError('tx key must be a non-empty string');
    }
    if (this.#pending.has(key)) {
      throw new Error(`OptimisticStore: duplicate tx key "${key}" — possible race condition`);
    }
    this.#pending.set(key, {
      delta: normalizeDelta(delta),
      status: 'pending',
      submittedAt: Date.now(),
    });
    this.#emit();
    return key;
  }

  /**
   * Mark a transaction confirmed and reconcile with the chain. Calls `refetch`
   * (if set) for the fresh confirmed state; once set, the confirmed delta is
   * dropped because its effect is now in the base. If refetch is unavailable or
   * fails, the confirmed delta stays applied (it reflects a real on-chain
   * change) until the base is later refreshed.
   */
  async confirm(key) {
    const tx = this.#pending.get(key);
    if (!tx || tx.status === 'confirmed') return false;
    tx.status = 'confirmed';
    if (this.#refetch) {
      try {
        const fresh = await this.#refetch();
        if (fresh) this.setBaseState(fresh);
      } catch (error) {
        console.warn('OptimisticStore: refetch failed after confirm, keeping optimistic delta:', error);
      }
    }
    this.#emit();
    return true;
  }

  /** Roll back a pending transaction: remove its speculative delta. */
  fail(key) {
    const tx = this.#pending.get(key);
    if (!tx || tx.status === 'confirmed') return false; // can't undo a confirmed tx
    this.#pending.delete(key);
    this.#emit();
    return true;
  }

  /** Confirmed base + all in-flight deltas (pending and confirmed). */
  getOptimisticState() {
    const snapshot = cloneState(this.#base);
    for (const tx of this.#pending.values()) {
      if (tx.status === 'failed') continue;
      applyDelta(snapshot, tx.delta);
    }
    return snapshot;
  }

  getStatus(key) {
    return this.#pending.get(key)?.status;
  }

  has(key) {
    return this.#pending.has(key);
  }

  get pendingCount() {
    return this.#pending.size;
  }

  getPending() {
    return [...this.#pending.entries()].map(([key, tx]) => ({
      key,
      status: tx.status,
      submittedAt: tx.submittedAt,
    }));
  }

  /** Subscribe to state changes; returns an unsubscribe function. */
  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Roll back everything still in flight. */
  clear() {
    this.#pending.clear();
    this.#emit();
  }

  #emit() {
    const state = this.getOptimisticState();
    for (const listener of this.#listeners) {
      try {
        listener(state);
      } catch (error) {
        console.warn('OptimisticStore: subscriber threw:', error);
      }
    }
  }
}

export default OptimisticStore;
