# Privacy-respecting event tracking

`event-tracker.js` provides a vendor-neutral event API. Tracking is disabled by
default; the application must obtain analytics consent and call
`setAnalyticsOptIn(true)` before any event can reach the configured sink.
`setEventSink(callback)` lets an app connect its own analytics provider. The
default sink is a no-op.

| Event | Allowed properties | When to emit |
| --- | --- | --- |
| `deposit_started` | `chainId`, `assetSymbol` | Immediately before submitting a deposit |
| `tx_succeeded` | `chainId`, `action` (`deposit`, `withdraw`, `stake`, `unstake`, `borrow`, `repay`, `claim_rewards`) | After a transaction is confirmed successfully |

Unknown properties are discarded. Do not send wallet addresses, names, email
addresses, transaction hashes, amounts, or other identifying/user-specific
data. Integrate `trackDepositStarted` and `trackTransactionSucceeded` into the
corresponding UI flows; this repository currently has no transaction UI to
wire directly.

```js
import {
  setAnalyticsOptIn,
  setEventSink,
  trackDepositStarted,
  trackTransactionSucceeded,
} from './analytics/event-tracker.js';

setEventSink((event) => analyticsProvider.track(event));
setAnalyticsOptIn(userPreferences.analytics === true);

trackDepositStarted({ chainId: 11155111, assetSymbol: 'USDC' });
trackTransactionSucceeded({ chainId: 11155111, action: 'deposit' });
```

The host application owns consent collection and persistence. Turning opt-in
off takes effect immediately and prevents subsequent events from being sent.
