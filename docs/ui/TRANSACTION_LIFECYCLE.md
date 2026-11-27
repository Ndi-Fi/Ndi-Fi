# Transaction Lifecycle Feedback

> Closes #141

## Overview

This document defines how submitted, pending, confirmed, and failed transactions are communicated to users. Consistent, informative feedback at every stage reduces user anxiety, prevents duplicate submissions, and surfaces actionable recovery paths when things go wrong.

---

## Transaction States

A transaction moves through the following states:

```
Submitted → Pending → Confirmed
                ↘
                  Failed
```

| State | Trigger | User Expectation |
|---|---|---|
| **Submitted** | User signs and broadcasts | "My action was sent" |
| **Pending** | Transaction in mempool / awaiting finality | "It's processing" |
| **Confirmed** | On-chain inclusion confirmed | "It succeeded" |
| **Failed** | Reverted, timeout, or rejection | "It failed — here's why and what to do" |

---

## Toast Notifications

Toasts are the primary real-time feedback mechanism. They appear in the **top-right corner** (desktop) or **bottom center** (mobile) and are stacked when multiple notifications are active, newest on top.

### Toast Anatomy

```
┌────────────────────────────────────────────┐
│  [Icon]  [Title]                      [✕] │
│          [Body text]                       │
│          [Action link / button]            │
└────────────────────────────────────────────┘
```

| State | Icon | Background | Title | Body |
|---|---|---|---|---|
| Submitted | Spinner (animated) | Neutral | "Transaction submitted" | "Waiting for confirmation…" |
| Pending | Spinner (animated) | Neutral | "Transaction pending" | "Block N of M confirmed" (if data available) |
| Confirmed | ✓ Checkmark | Success (green) | "Transaction confirmed" | Action summary, e.g., "Supplied 500 USDC" |
| Failed | ✗ Cross | Error (red) | "Transaction failed" | Short reason (see Failure Messaging) |

### Persistence Rules

- **Submitted / Pending:** Toast persists until the transaction resolves. No auto-dismiss. The user may close it manually but it re-appears on the next page load until resolved.
- **Confirmed:** Auto-dismisses after **5 seconds**. Can be dismissed early.
- **Failed:** Persists until dismissed. No auto-dismiss (error requires acknowledgement).

### Action Links

Each toast includes one contextual link:

| State | Link |
|---|---|
| Submitted / Pending | "View on explorer" (opens block explorer in new tab) |
| Confirmed | "View on explorer" |
| Failed | "Retry" (re-opens the original confirmation modal pre-filled) or "Get help" (links to docs/support) |

---

## In-App Activity List

The activity list is accessible from a persistent icon in the navigation bar (bell or clock icon). It shows all transactions for the current wallet session, persisted in local storage.

### List Item Design

```
┌──────────────────────────────────────────────────┐
│  [Status icon]  Supplied 500 USDC                │
│                 Ethereum · 2 min ago       [link]│
└──────────────────────────────────────────────────┘
```

| Field | Content |
|---|---|
| Status icon | Spinner (pending), ✓ (confirmed), ✗ (failed) |
| Action summary | Verb + amount + asset, e.g., "Borrowed 0.5 ETH" |
| Chain and time | Chain name · relative time (e.g., "2 min ago") |
| Explorer link | External link icon, opens in new tab |

### Badge

The nav icon shows a numeric badge for the count of pending transactions. The badge clears when all pending transactions resolve.

### Grouping and Limits

- Transactions are grouped by date: Today, Yesterday, then older dates.
- The list retains the last **50 transactions**. Older entries are pruned from local storage automatically.
- A "Clear history" button at the bottom of the list clears all confirmed and failed entries, leaving any pending ones.

---

## Pending State with Progress and Explorer Links

When a transaction is pending, the toast and activity list item both show:

1. **Animated spinner** — a rotating ring that respects `prefers-reduced-motion` (see Reduced-Motion section).
2. **Block confirmation progress** (if the chain provides this data):
   ```
   Block confirmations: ██░░░░ 2 / 6
   ```
   Displayed as a narrow progress bar with a text label. Hidden if confirmation data is unavailable.
3. **Estimated time** (optional, if the RPC provides a mempool estimate): "~30 seconds remaining".
4. **Explorer link**: always present regardless of confirmation data availability.

The confirmation progress bar uses the token colors for the fill and a neutral color for the track. The percentage is also communicated as `aria-valuenow` / `aria-valuemax` on a `role="progressbar"` element.

---

## Failure Messaging with Retry Guidance

Failures are grouped into three categories, each with a distinct message and action:

### User-Rejected

Triggered when the wallet prompt is dismissed.

- **Title:** "Transaction cancelled"
- **Body:** "You rejected the transaction in your wallet."
- **Action:** "Try again" — re-opens the confirmation modal.

### On-Chain Revert

Triggered when the transaction is included but reverts.

- **Title:** "Transaction failed"
- **Body:** Plain-language summary of the revert reason when available (e.g., "Insufficient collateral to borrow this amount"), otherwise "The transaction was reverted by the contract."
- **Action:** "Review position" — links to the relevant dashboard section, or "Retry" if the error is transient.

Revert reason mapping (non-exhaustive):

| Contract error | User-facing message |
|---|---|
| `InsufficientCollateral` | "Add more collateral before borrowing." |
| `HealthFactorTooLow` | "Repay part of your loan to improve your health factor." |
| `DepositCapReached` | "This pool has reached its deposit limit. Try again later." |
| `UtilizationTooHigh` | "The pool is at capacity. Try a smaller amount." |
| Unknown / unparseable | "The transaction was reverted. Check your position and try again." |

### Network / Timeout

Triggered when the transaction cannot be broadcast (RPC error) or times out without inclusion.

- **Title:** "Transaction not sent"
- **Body:** "There was a network issue. Your funds were not moved."
- **Action:** "Retry" — re-attempts the broadcast without re-signing. If the issue persists: "Get help" link.

---

## Reduced-Motion Friendly Animations

All animations in this system respect the `prefers-reduced-motion: reduce` media query.

| Element | Default animation | Reduced-motion fallback |
|---|---|---|
| Pending spinner | Rotating ring (360° loop) | Static dotted ring with pulsing opacity |
| Toast entry | Slide in from edge | Instant appear (fade in, 150 ms) |
| Toast exit | Slide out to edge | Instant disappear (fade out, 150 ms) |
| Progress bar fill | Width transition (300 ms ease) | No transition (immediate jump) |
| Confirmation checkmark | Scale + fade in | Fade in only |

Implementation note: apply `@media (prefers-reduced-motion: reduce)` overrides in a dedicated motion stylesheet. Never disable animations globally — users who do not set the preference should still see the full motion.

```css
@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; opacity-pulse: 1s ease infinite; }
  .toast-enter { transition: opacity 150ms ease; transform: none; }
  .toast-exit  { transition: opacity 150ms ease; transform: none; }
  .progress-fill { transition: none; }
}
```

---

## Accessibility

- Toasts use `role="status"` for confirmed and `role="alert"` for failed states, ensuring screen readers announce them without interrupting the user.
- Submitted/Pending toasts use `role="status"` with `aria-live="polite"` to avoid interrupting active work.
- The close (✕) button on each toast has `aria-label="Dismiss notification"`.
- The activity list toggle button has `aria-label="Transaction history"` and `aria-expanded` reflects the open state.
- Spinner elements carry `aria-label="Loading"` and `role="img"`.
- Explorer links include `aria-label="View transaction on [chain] block explorer (opens in new tab)"`.
