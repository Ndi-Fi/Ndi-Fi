/**
 * Onboarding state for Ndi-Fi — framework-free and DOM-free, so it can be
 * unit-tested and shared by `<ndi-onboarding-tour>`, `<ndi-hint>` and any
 * app code that needs to ask "should I prompt for a wallet now?".
 *
 * It owns four things:
 *   1. The guided tour — ordered steps, progress, back/next, skip, replay.
 *   2. Contextual hints — short tips shown once, the first time a screen or
 *      situation comes up, each dismissible and resettable.
 *   3. Wallet prompts — wallet connect is surfaced only when the user tries
 *      something that needs it, never as a wall in front of browsing.
 *   4. Risk education — the user must read and acknowledge how borrowing and
 *      liquidation work before their first borrow.
 *
 * State persists to `localStorage` (key `ndi-onboarding`) so a returning
 * user is never re-toured, and survives storage being unavailable.
 */

export const ONBOARDING_STORAGE_KEY = 'ndi-onboarding';
export const ONBOARDING_VERSION = 1;

/** Tour status values. */
export const TOUR_STATUS = Object.freeze({
  NEW: 'new', // never seen
  ACTIVE: 'active', // in progress (resumes at `index`)
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
});

/**
 * Default tour. Each step:
 *   id        stable key (persisted progress refers to it)
 *   target    CSS selector to spotlight; omit for a centred step
 *   icon      icon name from components/icon/icons.js
 *   title     ≤ 6 words
 *   body      ≤ 2 short sentences
 *   when      optional predicate on context — step is skipped when false
 *   action    optional CTA the step offers ('connect-wallet')
 *   requiresAcknowledgement  user must tick the box before moving on
 *   points    optional bullet list (risk education)
 */
export const DEFAULT_STEPS = Object.freeze([
  Object.freeze({
    id: 'welcome',
    icon: 'sparkle',
    title: 'Welcome to Ndi-Fi',
    body: 'Lend, borrow and stake on Ethereum and Stellar. This 1-minute tour shows you around — you can skip it and replay it any time from Help.',
  }),
  Object.freeze({
    id: 'connect-wallet',
    target: '[data-tour="connect-wallet"]',
    icon: 'connect-wallet',
    title: 'Connect when you’re ready',
    body: 'You can explore rates and pools without a wallet. Connect one when you want to deposit, borrow or stake.',
    action: 'connect-wallet',
    when: (ctx) => !ctx.walletConnected,
  }),
  Object.freeze({
    id: 'deposit',
    target: '[data-tour="deposit"]',
    icon: 'deposit',
    title: 'Earn by depositing',
    body: 'Deposit into the lending vault to earn interest. You receive vault shares that grow in value as borrowers pay interest.',
  }),
  Object.freeze({
    id: 'borrow-risk',
    target: '[data-tour="borrow"]',
    icon: 'risk',
    title: 'Borrowing has real risk',
    body: 'Borrowing lets you take a loan against collateral. Read this before your first loan.',
    points: Object.freeze([
      'Your health factor compares your collateral to your debt. Above 1.00 your position is safe.',
      'If prices move and your health factor drops below 1.00, your position can be liquidated.',
      'Liquidation sells part of your collateral to repay the debt, plus a penalty of up to 20%.',
      'Borrow well below your limit and watch your health factor, especially when markets are volatile.',
    ]),
    requiresAcknowledgement: true,
  }),
  Object.freeze({
    id: 'stake',
    target: '[data-tour="stake"]',
    icon: 'stake',
    title: 'Stake to earn NDI',
    body: 'Stake tokens to earn NDI rewards. Unstaking has a cooldown before you can withdraw.',
  }),
  Object.freeze({
    id: 'done',
    icon: 'check',
    title: 'You’re all set',
    body: 'Start with a small deposit to see how it works. Replay this tour any time from the Help menu.',
  }),
]);

/**
 * Contextual hints, shown once each the first time `trigger` matches.
 * `trigger(context)` decides relevance; dismissed hints never reappear until
 * `resetHints()` (which "Replay tour" also calls).
 */
export const DEFAULT_HINTS = Object.freeze({
  'deposit-shares': Object.freeze({
    icon: 'lightbulb',
    title: 'About vault shares',
    body: 'Your deposit is converted into shares. Withdraw at any time for the shares’ current value, as long as the vault has liquidity.',
    trigger: (ctx) => ctx.screen === 'deposit',
  }),
  'borrow-health-factor': Object.freeze({
    icon: 'health',
    title: 'Keep a safety buffer',
    body: 'Aim for a health factor above 1.5 so normal price swings don’t put you at risk of liquidation.',
    trigger: (ctx) => ctx.screen === 'borrow',
  }),
  'health-factor-low': Object.freeze({
    icon: 'warning',
    title: 'Your health factor is getting low',
    body: 'Repay part of your loan or add collateral to move away from liquidation.',
    trigger: (ctx) => typeof ctx.healthFactor === 'number' && ctx.healthFactor < 1.2,
  }),
  'stake-cooldown': Object.freeze({
    icon: 'history',
    title: 'Unstaking takes time',
    body: 'Request a withdrawal first; you can complete it after the cooldown. Emergency withdrawal is instant but forfeits pending rewards.',
    trigger: (ctx) => ctx.screen === 'stake',
  }),
  'wrong-network': Object.freeze({
    icon: 'switch-network',
    title: 'Switch networks from here',
    body: 'Use the network button in the header to move between Ethereum and Stellar.',
    trigger: (ctx) => ctx.walletConnected && ctx.networkSupported === false,
  }),
});

/** Actions that need a connected wallet (browsing never does). */
export const WALLET_ACTIONS = Object.freeze(['deposit', 'withdraw', 'borrow', 'repay', 'stake', 'unstake', 'claim', 'liquidate']);

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function emptyState() {
  return {
    version: ONBOARDING_VERSION,
    status: TOUR_STATUS.NEW,
    stepId: null,
    seenHints: [],
    riskAcknowledgedAt: null,
  };
}

function load(storage) {
  try {
    const raw = storage?.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== ONBOARDING_VERSION) return emptyState();
    return {
      ...emptyState(),
      status: Object.values(TOUR_STATUS).includes(parsed.status) ? parsed.status : TOUR_STATUS.NEW,
      stepId: typeof parsed.stepId === 'string' ? parsed.stepId : null,
      seenHints: Array.isArray(parsed.seenHints) ? parsed.seenHints.filter((h) => typeof h === 'string') : [],
      riskAcknowledgedAt: typeof parsed.riskAcknowledgedAt === 'number' ? parsed.riskAcknowledgedAt : null,
    };
  } catch {
    return emptyState();
  }
}

/**
 * Create an onboarding controller.
 *
 * @param {object} [options]
 * @param {Storage|null} [options.storage]  defaults to localStorage
 * @param {ReadonlyArray<object>} [options.steps]
 * @param {Readonly<Record<string, object>>} [options.hints]
 * @param {object} [options.context]  { walletConnected, screen, healthFactor, networkSupported }
 * @param {() => number} [options.now]
 */
export function createOnboarding({ storage = defaultStorage(), steps = DEFAULT_STEPS, hints = DEFAULT_HINTS, context = {}, now = Date.now } = {}) {
  let state = load(storage);
  let ctx = { walletConnected: false, ...context };
  const listeners = new Set();

  const save = () => {
    try {
      storage?.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked: onboarding still works for this visit.
    }
  };

  const visibleSteps = () => steps.filter((s) => (typeof s.when === 'function' ? s.when(ctx) : true));

  const currentIndex = () => {
    const list = visibleSteps();
    const i = list.findIndex((s) => s.id === state.stepId);
    return i === -1 ? 0 : i;
  };

  const snapshot = () => {
    const list = visibleSteps();
    const index = currentIndex();
    const step = state.status === TOUR_STATUS.ACTIVE ? list[index] ?? null : null;
    return Object.freeze({
      status: state.status,
      active: state.status === TOUR_STATUS.ACTIVE,
      step,
      index,
      total: list.length,
      isFirst: index === 0,
      isLast: index === list.length - 1,
      canAdvance: Boolean(step) && (!step.requiresAcknowledgement || state.riskAcknowledgedAt !== null),
      riskAcknowledged: state.riskAcknowledgedAt !== null,
      context: Object.freeze({ ...ctx }),
    });
  };

  const emit = (reason) => {
    const snap = snapshot();
    for (const fn of listeners) fn(snap, reason);
  };

  const commit = (reason) => {
    save();
    emit(reason);
    return snapshot();
  };

  const goTo = (index) => {
    const list = visibleSteps();
    const clamped = Math.max(0, Math.min(index, list.length - 1));
    state.stepId = list[clamped]?.id ?? null;
  };

  return {
    /** Current, immutable view of the tour. */
    get state() {
      return snapshot();
    },

    /** Steps that apply in the current context. */
    get steps() {
      return visibleSteps();
    },

    /** Should the tour open by itself? Only for first-time visitors. */
    shouldAutoStart() {
      return state.status === TOUR_STATUS.NEW || state.status === TOUR_STATUS.ACTIVE;
    },

    /** Start (or resume) the tour. */
    start() {
      if (state.status !== TOUR_STATUS.ACTIVE) {
        state.status = TOUR_STATUS.ACTIVE;
        goTo(0);
      }
      return commit('start');
    },

    next() {
      const snap = snapshot();
      if (!snap.active || !snap.canAdvance) return snap;
      if (snap.isLast) return this.complete();
      goTo(snap.index + 1);
      return commit('next');
    },

    back() {
      const snap = snapshot();
      if (!snap.active || snap.isFirst) return snap;
      goTo(snap.index - 1);
      return commit('back');
    },

    /** Leave the tour; it will not auto-start again. */
    skip() {
      if (state.status !== TOUR_STATUS.ACTIVE && state.status !== TOUR_STATUS.NEW) return snapshot();
      state.status = TOUR_STATUS.SKIPPED;
      return commit('skip');
    },

    complete() {
      state.status = TOUR_STATUS.COMPLETED;
      state.stepId = null;
      return commit('complete');
    },

    /** Restart from the first step and re-enable every hint. */
    replay() {
      state.status = TOUR_STATUS.ACTIVE;
      state.seenHints = [];
      goTo(0);
      return commit('replay');
    },

    /** Record that the risk step was read and acknowledged. */
    acknowledgeRisk(value = true) {
      state.riskAcknowledgedAt = value ? now() : null;
      return commit('acknowledge');
    },

    /**
     * Gate for the first borrow: if risk hasn't been acknowledged, the app
     * should show the risk step (or `<ndi-onboarding-tour step="borrow-risk">`)
     * instead of submitting.
     */
    canBorrow() {
      return state.riskAcknowledgedAt !== null;
    },

    /**
     * Should the app prompt for a wallet before `action`? Returns
     * `{ prompt: false }` for browsing or when already connected.
     */
    walletPrompt(action) {
      if (ctx.walletConnected || !WALLET_ACTIONS.includes(action)) return { prompt: false };
      return { prompt: true, action, reason: `Connect a wallet to ${action}.` };
    },

    /** Update context (wallet state, current screen, health factor…). */
    setContext(patch) {
      const before = snapshot();
      ctx = { ...ctx, ...patch };
      // If the visible steps changed (e.g. wallet connected mid-tour), keep
      // the user on the same step when possible, else the nearest one.
      if (state.status === TOUR_STATUS.ACTIVE && !visibleSteps().some((s) => s.id === state.stepId)) {
        goTo(before.index);
      }
      return commit('context');
    },

    /** The hint to show right now (first relevant, unseen), or null. */
    activeHint() {
      if (state.status === TOUR_STATUS.ACTIVE) return null; // don't stack on the tour
      for (const [id, hint] of Object.entries(hints)) {
        if (state.seenHints.includes(id)) continue;
        if (typeof hint.trigger === 'function' && hint.trigger(ctx)) return { id, ...hint };
      }
      return null;
    },

    /**
     * Should this specific hint show now? `ignoreTrigger` is for hints placed
     * in the page markup, where the placement itself is the context.
     */
    shouldShowHint(id, { ignoreTrigger = false } = {}) {
      const hint = hints[id];
      if (!hint || state.seenHints.includes(id) || state.status === TOUR_STATUS.ACTIVE) return false;
      if (ignoreTrigger || typeof hint.trigger !== 'function') return true;
      return Boolean(hint.trigger(ctx));
    },

    /** Look up a hint definition by id. */
    getHint(id) {
      return hints[id] ? { id, ...hints[id] } : null;
    },

    dismissHint(id) {
      if (!state.seenHints.includes(id)) state.seenHints = [...state.seenHints, id];
      return commit('hint');
    },

    resetHints() {
      state.seenHints = [];
      return commit('hint');
    },

    /** Forget everything (e.g. from a settings page). */
    reset() {
      state = emptyState();
      return commit('reset');
    },

    /** Listen for changes. Returns an unsubscribe function. */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
