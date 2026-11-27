# Onboarding: guided tour and contextual hints

| File | Role |
| --- | --- |
| `onboarding-model.js` | DOM-free state: tour steps, skip/replay, persistence, wallet prompts, risk acknowledgement, one-time hints |
| `ndi-onboarding.js` | `<ndi-onboarding-tour>` and `<ndi-hint>`, sharing one controller via `getOnboarding()` |
| `ndi-onboarding.css` | Shadow styles (panel, bottom sheet on mobile, hint) |
| `onboarding.css` | Page-level spotlight for `[data-ndi-tour-target]` — link it once per page |

The full spec (flow, wireframes, step copy, when to prompt for a wallet, risk
gating, accessibility and an integration example) is in
[`docs/design/06-onboarding.md`](../../../docs/design/06-onboarding.md).

## Minimal setup

```html
<link rel="stylesheet" href="/web/components/onboarding/onboarding.css" />
<script type="module" src="/web/components/onboarding/ndi-onboarding.js"></script>

<button data-tour="connect-wallet">Connect wallet</button>
<button data-ndi-tour-replay>Replay tour</button>
<ndi-onboarding-tour autostart></ndi-onboarding-tour>
<ndi-hint hint-id="deposit-shares"></ndi-hint>
```

## Controller API (`getOnboarding()` / `createOnboarding()`)

| Method | Description |
| --- | --- |
| `state` | `{ status, active, step, index, total, isFirst, isLast, canAdvance, riskAcknowledged, context }` |
| `start()` · `next()` · `back()` · `skip()` · `complete()` · `replay()` | Tour flow. `next()` is refused on the risk step until acknowledged |
| `shouldAutoStart()` | `true` for new users and interrupted tours |
| `acknowledgeRisk(bool)` · `canBorrow()` | Risk education gate |
| `walletPrompt(action)` | `{ prompt: true, … }` only for on-chain actions without a wallet |
| `setContext({ walletConnected, screen, healthFactor, networkSupported })` | Drives step visibility and hint triggers |
| `activeHint()` · `shouldShowHint(id, { ignoreTrigger })` · `dismissHint(id)` · `resetHints()` | One-time hints |
| `reset()` | Forget everything |
| `subscribe(fn)` | `fn(snapshot, reason)`; returns an unsubscribe function |

State is stored in `localStorage` under `ndi-onboarding`. A storage failure
never breaks the UI.
