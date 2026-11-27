# 01 — Landing page & protocol overview

Closes #136 · Spec for the public landing page: the first impression and the
route into Lending and Staking.

> See [README.md](README.md) for tokens, shared components and responsiveness
> conventions used here.

## Goal

A visitor should understand, within one screen, **what Ndi-Fi does** (lend and
stake across Ethereum and Stellar, earn yield and NDI rewards), **that it is
live** (TVL, APR), and **where to go next** (Connect wallet → Lend or Stake).
No marketing fluff the contracts can't back up.

## Layout — desktop (`> 1024px`)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ◆ Ndi-Fi          Lending  Staking  Docs          [Connect wallet ▾]  │  ← Nav
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   Lend and stake across                     ┌───────────────────────┐ │
│   Ethereum and Stellar.                     │                       │ │
│   One vault standard. NDI rewards.           │   [protocol abstract  │ │  ← Hero
│                                             │    illustration]      │ │
│   [ Start lending →]  [ Start staking →]    │   TVL $—.—M  APR —.—%  │ │
│                                             └───────────────────────┘ │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│   TVL              APR (lend)        APR (stake)       NDI distributed │  ← Stats strip
│   $—.—M            —.—%             —.—%             — NDI           │
│   across chains    vault yield       NDI rewards       to stakers      │
├──────────────────────────────────────────────────────────────────────┤
│   Why Ndi-Fi                                                          │
│                                                                       │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │  ← Features
│   │ Lending      │  │ Staking      │  │ NDI rewards  │  │ Cross-chain│ │
│   │ …            │  │ …            │  │ …            │  │ ETH + Stellar│
│   └──────────────┘  └──────────────┘  └──────────────┘  └───────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│   How it works                                                        │
│   1 Connect wallet   →   2 Deposit or stake   →   3 Earn yield + NDI    │  ← How it works
├──────────────────────────────────────────────────────────────────────┤
│   Ready to start?            [ Open the app → ]                       │  ← CTA band
├──────────────────────────────────────────────────────────────────────┤
│   Ndi-Fi  ·  Docs  ·  GitHub  ·  Security  ·  © Ndi-Fi                 │  ← Footer
└──────────────────────────────────────────────────────────────────────┘
```

## Layout — mobile (`< 640px`)

```
┌──────────────────────────┐
│ ◆ Ndi-Fi        ☰         │
├──────────────────────────┤
│                          │
│ Lend and stake across    │
│ Ethereum and Stellar.    │
│ One vault standard.      │
│ NDI rewards.             │
│                          │
│ [ Start lending →]       │
│ [ Start staking →]       │
├──────────────────────────┤
│ TVL       APR(lend)      │   ← 2×2 stats grid
│ $—.—M     —.—%           │
│ APR(stake) NDI dist.     │
│ —.—%      — NDI          │
├──────────────────────────┤
│ Why Ndi-Fi                │
│ ┌──────────────────────┐ │   ← stacked feature cards
│ │ Lending              │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ Staking              │ │
│ └──────────────────────┘ │
│ …                        │
├──────────────────────────┤
│ How it works              │
│ 1 Connect → 2 Deposit →   │   ← vertical stepper
│ 3 Earn                    │
├──────────────────────────┤
│ Ready to start?           │
│ [ Open the app →]        │
├──────────────────────────┤
│ Ndi-Fi · Docs · GitHub    │
└──────────────────────────┘
```

## Section specs

### Nav

- Left: `◆ Ndi-Fi` wordmark in `--accent`, links home.
- Center (desktop): `Lending`, `Staking`, `Docs`. `Lending`/`Staking` route to
  the positions pages (#137/#138); `Docs` opens the external docs index.
- Right: `<ChainBadge>` + `[Connect wallet ▾]` — see
  [`04-wallet-connection.md`](04-wallet-connection.md). When connected, the
  button shows the truncated address and opens the account menu.
- Mobile: wordmark + hamburger. Menu is a full-width sheet listing the same
  items plus Connect.

### Hero

- **Headline (Display):** "Lend and stake across Ethereum and Stellar."
  This is the value prop: a single vault-standard product on two chains with
  NDI rewards. Sub-headline (Body, `--text-secondary`): "Deposit into an
  ERC-4626 vault, borrow against collateral, or stake for NDI — one interface,
  Ethereum and Soroban."
- **Primary CTAs:**
  - `[ Start lending →]` — primary, `--accent`; scrolls/routes to Lending.
  - `[ Start staking →]` — secondary, outlined `--border-subtle`.
  Both are disabled with tooltip "Connect a wallet first" until a wallet is
  connected (#140); tapping while disconnected opens the connect sheet.
- **Right panel:** an abstract protocol illustration (orbiting vault ↔
  lending ↔ staking nodes). Below it, a live mini-stat pair: `TVL $—.—M` and
  `APR —.—%` pulled from the same sources as the stats strip, so the hero and
  the strip never disagree.

### Stats strip

Four `<StatChip>`s. Each value is live (polled every ~30s, debounced) and
renders `—` while loading so the layout never jumps. Data sources:

| Chip | Label | Value source | Secondary line |
|---|---|---|---|
| TVL | "across chains" | Sum of `NdiFiVault.totalAssets()` (ETH, priced via the lending-token feed) + `ndi_lending::total_assets()` (Stellar, priced via a SEP-40/Reflector feed) | "across chains" |
| APR (lend) | "vault yield" | Depositor APR = borrower APR × utilization. Stellar: `ndi_lending::interest_rate() * utilization() / 1e7`. Ethereum: vault interest model rate (`NdiInterestRate`) × `NdiFiLending.getContractStats().utilizationRate`. Per-chain figure; never exceed what the contracts can return. | "vault yield" |
| APR (stake) | "NDI rewards" | `NdiFiStaking.apy` (ETH, APY) and `ndi_staking.config().reward_rate` (Stellar, APR, scaled 1e7). Label explicitly **APR/APY per chain**; do not average an APY with an APR. | "NDI rewards" |
| NDI distributed | "to stakers" | `NdiPoint.totalSupply()` minus initial `100_000_000` mint (or a tracked distribution counter), shown in NDI with `--ndi` accent | "to stakers" |

Rounding: TVL to 2 decimals with an `M`/`K` suffix; APR to 1 decimal; NDI to
whole tokens with thousands separators.

**Q:** Should the stats strip show per-chain breakdowns (a small "(ETH / XLM)"
sub-line), or a single blended figure? Recommended: per-chain sub-line on
desktop, blended on mobile to save space — confirm with maintainer.

### Features section ("Why Ndi-Fi")

Four cards, equal width on desktop (`1fr 1fr 1fr 1fr`), stacked on mobile.
Each card: icon (24px, in the card's accent), `H3` title, one Body line, a
"Learn more →" link to the relevant docs section. Copy must match contract
capabilities — do not promise liquidations on Stellar.

- **Lending** — "Deposit any supported asset into an ERC-4626 vault for yield,
  or borrow against collateral on Ethereum." Links to `docs/VAULT_ERC4626.md`
  and the lending flow. Accent `--accent`.
- **Staking** — "Stake Uniswap V3 positions on Ethereum or LP tokens on
  Stellar, and earn NDI. Unstake after a cooldown, or exit anytime and forgo
  pending rewards." Accent `--positive`.
- **NDI rewards** — "NDI rewards flow to stakers and, planned, to lenders and
  borrowers. Capped at 1B supply." Accent `--ndi`. Link `Tokenomics.md`.
- **Cross-chain** — "One interface for Ethereum and Stellar (Soroban). Same
  vault standard, native to each chain." Accent `--accent`. Shows the
  `<ChainBadge>` twice (ETH + XLM).

### How it works

Three numbered steps with a connector line on desktop, vertical on mobile:

1. **Connect wallet** — "Connect MetaMask on Ethereum or a Stellar wallet on
   Soroban. We detect your network for you." (links #140)
2. **Deposit or stake** — "Supply assets to the vault, or stake for NDI
   rewards. You always see the exact shares, max withdraw and health factor
   before confirming." (links #137/#138)
3. **Earn yield + NDI** — "Vault yield accrues to your shares; NDI rewards
   accrue to your stake. Claim anytime, unstake after cooldown."

### CTA band + footer

- CTA band: `--bg-surface-raised` card, "Ready to start?" + a single primary
  `[ Open the app →]` that routes to Lending.
- Footer: wordmark, `Docs`, `GitHub`, `Security` (→ `SECURITY.md`),
  `CONTRIBUTING.md`, and a line: "Ndi-Fi is unaudited MVP software. Use at your
  own risk." (matches the risk-disclosure tone in `SECURITY.md`).

## Responsive behavior

| Breakpoint | Nav | Hero | Stats | Features |
|---|---|---|---|---|
| `< 640px` | hamburger sheet | stacked, CTAs full width | 2×2 grid | stacked |
| `640–1024px` | inline links | side-by-side, illustration smaller | 2×2 or 4-up | 2×2 |
| `> 1024px` | inline links | side-by-side | 4-up row | 4-up row |

The hero illustration hides on `< 640px` to keep the value prop above the fold;
the mini-stats move into the stats strip.

## On-brand checks

- Only colors from [README.md](README.md) tokens; `--ndi` reserved for NDI
  rewards branding, never used for general UI.
- Headline copy ties to the real protocol ("vault standard", "NDI rewards")
  rather than generic DeFi slogans.
- Numbers come from contracts, never hard-coded marketing figures.
- Risk language in the footer matches `SECURITY.md` (unaudited, MVP).

## Acceptance criteria — #136

- [x] Hero with value prop and primary CTAs — §Hero, two CTAs routed to Lending/Staking, disabled until connected.
- [x] Protocol features section (lending, staking, NDI rewards) — §Features, four cards incl. NDI rewards.
- [x] Stats strip (TVL, APR) and a "how it works" summary — §Stats strip (TVL + APR lend/stake + NDI distributed) and §How it works.
- [x] Responsive and on-brand — §Responsive behavior + §On-brand checks; tokens from README.
