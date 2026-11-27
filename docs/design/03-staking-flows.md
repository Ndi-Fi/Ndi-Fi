# 03 — Staking flow screens

Closes #138 · Wireframes for stake, claim, unstake and emergency-withdraw,
cooldown countdown, penalty disclosures, rewards accrual visualization, and
Ethereum ↔ Stellar parity.

> See [README.md](README.md) for tokens and shared components. State-map
> vocabulary is shared with [`02-lending-flows.md`](02-lending-flows.md).

## Staking variants to design for

| Variant | Chain | Stake token | Reward | Cooldown | Emergency withdraw |
|---|---|---|---|---|---|
| `NdiFiStaking` (ERC-20 into ERC-4626 vault) | Ethereum | ERC-20 | NDI, linear **APY** | 21 days fixed (`WITHDRAW_WAIT`) | not implemented |
| `NdiStaking` (Uniswap V3 NFT position) | Ethereum | UniV3 NFT | NDI, time-based | (per NFT staking) | not implemented |
| `ndi_staking` (LP token) | Stellar | SEP-41 LP | NDI, linear **APR** (`reward_rate` × 1e7) | configurable `cooldown` (s) | ✓ forfeits pending rewards |

The screen is the same shape for all three; differences are flagged. The
Uniswap V3 NFT variant substitutes "NFT position" for "amount" and shows the
position's tick range instead of an amount input — noted where relevant.

> **Parity note:** the four flows below are designed once and reused. Where a
> chain differs, the spec says so explicitly. The single biggest parity gap is
> **emergency-withdraw**: it exists on Stellar and not on Ethereum; see
> §Emergency-withdraw and §Parity.

## Staking hub (entry screen)

```
┌────────────────────────────────────────────────────────────────────┐
│  Staking                                [ETH ▾][0x1234…abcd ▾]      │
│                                                                      │
│  ┌─ Your stake ───────────────────────────┐  ┌─ Pool ───────────────┐ │
│  │ Staked       1,200 LP   ≈ $—          │  │ Total staked — LP    │ │
│  │ Staked since 2025-05-01                │  │ Reward pool  — NDI   │ │
│  │ Accruing    +0.0042 NDI / min  ↗       │  │ APR          —.—%    │ │
│  │ Pending     12.40 NDI   [ Claim ]      │  └─────────────────────┘ │
│  └────────────────────────────────────────┘                          │
│                                                                      │
│  [ Stake ]  [ Request unstake ]        [ Emergency withdraw ]        │
│                                                                      │
│  Cooldown                              none active                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Unstake available in  20d 14h 03m   [████████░░░░░░░░] 64%     │   │
│  │   (requested 2025-11-03 · unlocks 2025-11-24)                 │   │
│  │   [ Complete unstake (locked) ]   rewards keep accruing       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

Position card data:

- **Staked** — `StakeInfo.amount` (Stellar) / `stakes[user].amount` (ETH ERC-20).
  NFT variant: the staked token id + tick range.
- **Staked since** — `staked_at` / `timestamp`.
- **Pending** — `pending_rewards(user)` (Stellar) / `pendingRewards(user)`
  (ETH). Live-ticking (see §Rewards accrual).
- **Pool** — `total_staked()`, `reward_pool()`, `config().reward_rate` (APR,
  Stellar) / `apy` (APY, ETH).
- **Cooldown card** — appears once `unstake_requested_at` is set; see
  §Cooldown.

## Stake

```
DESKTOP                                  MOBILE
┌──────────────────────────────┐         ┌──────────────────────────┐
│ Stake                         │         │ Stake                     │
│ Asset  [LP ▾]                 │         │ Asset [LP ▾]              │
│ ┌──────────────────────┐ [Max]│         │ ┌────────────┬─────┐      │
│ │ 0.0                  │      │         │ │ 0.0        │ Max │      │
│ └──────────────────────┘      │         │ └────────────┴─────┘      │
│ Balance 1,234 LP              │         │ Balance 1,234 LP          │
│ Min —  · Max — LP  APR —.—%   │         │ Min — · Max — · APR —.—%  │
│ You'll earn ≈ +X NDI / day     │         │ ≈ +X NDI / day            │
│ ┌──────────────────────────┐ │         │ ┌──────────────────────┐  │
│ │ One stake per account.   │ │         │ │ One stake per account│  │
│ │ Topping up not supported.│ │         │ └──────────────────────┘  │
│ └──────────────────────────┘ │         │ [        Stake        ]   │
│ [          Stake           ] │         └──────────────────────────┘
└──────────────────────────────┘
```

- **Bounds:** Stellar enforces `min_stake ≤ amount ≤ max_stake`
  (`StakeOutOfRange`). Show Min/Max from `config()`. The ETH ERC-20 variant
  has the same `minStake`/`maxStake`.
- **One stake per account:** both contracts reject a second stake
  (`AlreadyStaked`). The info box makes this explicit; if a stake already
  exists, the Stake button becomes "You already have a stake" and routes to
  the hub.
- **Rewards preview:** "≈ +X NDI / day" from the linear formula at the entered
  amount (see §Rewards accrual). Label **APR** (Stellar) / **APY** (ETH) —
  never swap.
- **NFT variant:** the input becomes a position picker listing the user's
  UniV3 NFTs (token id, tick range, notional); amount is the position value.
- Confirm → `stake(user, amount)` (Stellar) / `stake(amount)` (ETH). On
  success, refresh the hub.

## Claim

```
┌──────────────────────────────┐
│ Claim rewards                 │
│ Pending  12.40 NDI            │
│ Reward pool  480,000 NDI  ✓   │   ← pool ≥ pending, healthy
│ ┌──────────────────────────┐ │
│ │ Claims don't end your     │ │
│ │ stake. Rewards keep       │ │
│ │ accruing after claiming.  │ │
│ └──────────────────────────┘ │
│ [        Claim 12.40 NDI   ]  │
└──────────────────────────────┘
```

- `pending_rewards(user)` drives the button label ("Claim 12.40 NDI").
  `0` pending → `NoRewards` error state; disable with "No rewards to claim
  yet."
- **Pool sufficiency:** if `pending > reward_pool()`, show
  `InsufficientRewardPool` warning ("The reward pool is temporarily short.
  Try again later, or use emergency-withdraw to exit."), keep the button
  disabled. This matches the contract's `pay_reward` check.
- Confirm → `claim(user)` (Stellar) / `claimRewards()` (ETH). Toast
  pending → success; refresh pending counter.
- Claims never end the stake (both contracts); state this for user trust.

## Unstake (request → cooldown → complete)

Two steps, both from the hub.

```
REQUEST UNSTAKE                          COMPLETE UNSTAKE (after cooldown)
┌──────────────────────────────┐         ┌──────────────────────────────┐
│ Request unstake                │         │ Complete unstake             │
│ You'll start a 21-day cooldown.│         │ Cooldown complete.           │
│                                │         │ Returning  1,200 LP          │
│ Staked        1,200 LP          │         │ Paying     +12.40 NDI        │
│ Pending       12.40 NDI         │         │   (rewards accrued through   │
│ Pending will KEEP accruing      │         │    the cooldown)            │
│ until you complete.            │         │ [      Complete unstake    ] │
│ [       Request unstake      ] │         └──────────────────────────────┘
└──────────────────────────────┘
```

- **Request** → `request_unstake(user)` (Stellar) / `requestWithdrawal()`
  (ETH). Returns/records `available_at = now + cooldown`. Emits
  `UnstakeRequested` / `WithdrawalRequested`.
- **Already requested?** `UnstakeAlreadyRequested` — disable request, jump
  straight to the cooldown card.
- **Rewards keep accruing through the cooldown** (both contracts: Stellar
  computes pending up to `unstake`; ETH `pendingRewards` ignores the request).
  State this clearly — it's the opposite of what many users assume.
- **Complete** (enabled only when `now ≥ available_at`) → `unstake(user)`
  (Stellar) / `executeWithdrawal()` (ETH). Returns principal + pays pending
  rewards. `CooldownNotElapsed` if called early → keep button locked with
  the countdown.
- **Edge (ETH only):** `NdiFiStaking.executeWithdrawal` has a known final-reward
  bug (sets `withdrawn = true` before computing rewards, so the final payout is
  0 unless claimed first — see `NdiFiStaking_README.md` caveats). **Handoff:
  prompt users to `Claim` before completing unstake on Ethereum**, and surface
  the pending amount they should claim. Flag the bug to maintainers; do not
  silently lose their rewards.
- Paused? Stellar blocks `request_unstake` and `unstake` (`when_not_paused`);
  the buttons go disabled with a "Staking is paused" banner.

## Emergency withdraw

```
┌──────────────────────────────────────────┐
│  ⚠  Emergency withdraw                     │
│                                           │
│  Exit your stake right now, even if       │
│  staking is paused.                       │
│                                           │
│  Returning      1,200 LP   (full principal)│
│  Forfeiting    −12.40 NDI  pending rewards│
│                                           │
│  ┌──────────────────────────────────────┐│
│  │ I understand I lose my unclaimed NDI. ││
│  └──────────────────────────────────────┘│   ← checkbox required
│                                           │
│  [   Emergency withdraw   ]   (red)       │
└──────────────────────────────────────────┘
```

- **Available even while paused** (Stellar `emergency_withdraw` has no
  `when_not_paused`). This is the "panic exit" path; style it `--negative` and
  require the checkbox to confirm.
- **Penalty disclosure (required by #138):** show the forfeited reward
  prominently (`forfeited_reward = pending_for(...)`), with a minus sign and
  `--negative`. State that **principal is returned in full** — only rewards are
  forfeited. This is the single most important trust message on this screen.
- Confirm → `emergency_withdraw(user)` (Stellar). Emits `EmergencyWithdrawn`
  with `forfeited_reward`.
- **Ethereum parity gap:** `NdiFiStaking` has **no** emergency-withdraw today
  (it is a documented future enhancement). On Ethereum, this screen should:
  - show "Emergency withdraw is not available on Ethereum yet," and
  - route to the normal **Request unstake → complete** flow, noting the 21-day
    wait and that rewards are paid on completion (see §Unstake edge).
  - **Recommend (design note):** add an Ethereum emergency-withdraw with reward
    forfeiture to match Stellar, so both chains offer the same panic exit.
    File under §Parity.

## Cooldown countdown

`<CooldownCountdown>` appears on the hub once a request is active.

```
  Unstake available in  20d 14h 03m
  [████████████████░░░░░░░░░░░░] 64%
   requested 2025-11-03  unlocks 2025-11-24
   [ Complete unstake  ▸ locked ]
```

- **Source:** `available_at = unstake_requested_at + cooldown`.
  - Stellar: `get_stake(user).unstake_requested_at` + `config().cooldown`.
  - ETH ERC-20: `withdrawalRequests(user).requestedAt` + `WITHDRAW_WAIT`
    (21 days, constant).
- **Progress bar** fills over the real cooldown duration
  (`elapsed / cooldown`); it is **not** a fake animation. Width transitions
  update on each second tick.
- **Countdown text** `20d 14h 03m` recomputed each second; `aria-live="polite"`
  announces when it hits zero ("Unstake available now").
- **Complete button** is locked (greyed, tooltip "Unlocks in 20d 14h") until
  `now ≥ available_at`, then turns primary.
- **Reduces motion:** with `prefers-reduced-motion`, drop the bar fill
  animation; show only the remaining time text.

## Penalty disclosures (summary)

| Exit path | Principal | Pending rewards | Disclosure shown |
|---|---|---|---|
| Claim | stays staked | paid out | "Claims don't end your stake." |
| Unstake (after cooldown) | returned in full | paid out (accrued through cooldown) | "Rewards keep accruing through the cooldown." + ETH claim-first nudge |
| Emergency withdraw | returned in full | **forfeited** | "You forfeit X NDI. Principal returned in full." + checkbox |

No path slashes the principal. State that once on the hub so users aren't
afraid to stake.

## Rewards accrual visualization

A small panel on the hub showing rewards building over time.

```
  Rewards           12.40 NDI pending      +0.0042 NDI/min ↗
  ┌─────────────────────────────────────────────┐
  │   NDI                                          │
  │ 12 ┤                                  ╭──────  │   ← linear ramp
  │  8 ┤                          ╭───────╯        │
  │  4 ┤            ╭─────────────╯                │
  │  0 ┼─────────────┘  (claim here resets to 0)   │
  │     ├──────┬──────┬──────┬──────┬──── now      │
  │     d−30   d−20   d−10   d−5                  │
  └─────────────────────────────────────────────┘
  Rate 8.0% APR · pool 480,000 NDI  ✓
```

- **Live ticker:** pending increments every few seconds from the linear
  formula, not from a poll. Recompute `pending = accrued − claimed` locally
  between polls and reconcile on each read.
  - Stellar: `accrued = amount * rate * elapsed / (1e7 * SECONDS_PER_YEAR)`.
  - ETH ERC-20: `pendingRewards(user)`; the ramp is linear in `apy`.
- **Sparkline:** a 30-day linear ramp with drops at each claim (reset to ~0).
  Static SVG; no auto-zoom; honor `prefers-reduced-motion`.
- **Rate label:** APR (Stellar) / APY (ETH) — matched to the contract. Show the
  raw rate and the human %.
- **Pool health:** `reward_pool()` with ✓ if `pool ≥ pending`, ⚠ if short.
  Clicking ⚠ explains the `InsufficientRewardPool` state and offers the
  emergency-withdraw exit.

## Parity (Ethereum ↔ Stellar)

| Aspect | Ethereum | Stellar | Design handling |
|---|---|---|---|
| Rate type | APY (`apy`) | APR (`reward_rate` × 1e7) | Label correctly per chain; never average. |
| Cooldown | 21 days fixed | configurable `cooldown` | same `<CooldownCountdown>`, reads per-chain. |
| Emergency withdraw | not implemented | ✓ (forfeits rewards) | show "not available" + route to unstake; recommend adding it. |
| Multiple stakes | one position | one stake | identical "one stake per account" copy. |
| Top-up | not supported | not supported | identical info box. |
| Pauses | ERC-20 variant pausable? (see code) | stake/claim/unstake paused; emergency open | reflect pause per chain; emergency always open. |
| NFT staking | UniV3 NFT positions | — | NFT variant of the Stake screen; not on Stellar. |
| Final-reward bug | ETH `executeWithdrawal` pays 0 unless claimed first | n/a | nudge claim-before-unstake on ETH. |

**Consistency principle:** the four flow screens are identical between chains
except for the labeled differences above. A user who learned the flow on one
chain should need zero re-learning on the other.

## State map (staking-specific)

Reuses the [lending state map](02-lending-flows.md#state-map) plus:

| State | Trigger | UI |
|---|---|---|
| `no-stake` | no active stake | hub shows `<EmptyState>` "No stake yet" + `[Stake]`; claim/unstake/emergency hidden. |
| `already-staked` | second `stake` attempted | Stake button disabled, "You already have a stake." |
| `out-of-range` | amount < min or > max (Stellar) | "Stake must be between X and Y LP." confirm disabled. |
| `no-rewards` | `pending == 0` | Claim disabled, "No rewards to claim yet." |
| `pool-short` | `pending > reward_pool` | Claim disabled, "Reward pool temporarily short." + emergency option. |
| `cooldown-active` | request made, `now < available_at` | countdown card shown, complete locked. |
| `cooldown-done` | `now ≥ available_at` | complete button enabled. |
| `already-requested` | second `request_unstake` | request disabled, jump to countdown card. |
| `paused` | paused (and not emergency) | stake/claim/unstake disabled with banner; emergency still available. |

## Handoff notes for engineers

Data sources (single source of truth):

- **Position:** `get_stake(user)` → `StakeInfo { amount, staked_at, rewards_claimed, unstake_requested_at }`
  (Stellar) / `stakes[user]`, `withdrawalRequests[user]` (ETH).
- **Pending:** `pending_rewards(user)` (Stellar) / `pendingRewards(user)` (ETH).
- **Config:** `config()` → `{ stake_token, reward_token, reward_rate, min_stake, max_stake, cooldown }`
  (Stellar) / `apy`, `minStake`, `maxStake`, `WITHDRAW_WAIT` (ETH).
- **Pool:** `total_staked()`, `reward_pool()` (Stellar).

Action calls:

| Action | Ethereum | Stellar |
|---|---|---|
| Stake | `stake(amount)` (ERC-20) / NFT stake | `stake(user, amount)` |
| Claim | `claimRewards()` | `claim(user)` |
| Request unstake | `requestWithdrawal()` | `request_unstake(user)` |
| Complete unstake | `executeWithdrawal()` | `unstake(user)` |
| Emergency withdraw | — (not implemented) | `emergency_withdraw(user)` |

Error mapping:

| Code | Display |
|---|---|
| `StakeOutOfRange` | "Stake must be between X and Y LP." |
| `AlreadyStaked` | "You already have an active stake." |
| `NoActiveStake` | "You don't have a stake." |
| `NoRewards` | "No rewards to claim yet." |
| `UnstakeAlreadyRequested` | "Unstake already requested — see the cooldown." |
| `UnstakeNotRequested` | "Request unstake first to start the cooldown." |
| `CooldownNotElapsed` | "Cooldown not finished. Unlocks in 20d 14h." |
| `InsufficientRewardPool` | "Reward pool is temporarily short. Try later, or emergency-withdraw." |
| `InvalidAmount` | "Enter a positive amount." |

Polling: pending rewards tick locally (linear formula) and reconcile on each
read; refresh position after every action success.

Accessibility: countdown and pending in `aria-live`; the forfeiture disclosure
conveys risk via text + icon, not color alone; the emergency checkbox is a
real focusable control, not a styled div.

## Acceptance criteria — #138

- [x] Wireframes for stake, claim, unstake, emergency withdraw — §Stake, §Claim, §Unstake (request→cooldown→complete), §Emergency withdraw.
- [x] Cooldown countdown and penalty disclosures — §Cooldown countdown + §Penalty disclosures (forfeited rewards, principal-safe messaging, required checkbox).
- [x] Rewards accrual visualization — §Rewards accrual visualization (live ticker, 30-day sparkline, APR/APY, pool health).
- [x] Consistent between Ethereum and Stellar variants — §Parity table + "consistency principle"; per-chain differences labeled, screens otherwise identical.
