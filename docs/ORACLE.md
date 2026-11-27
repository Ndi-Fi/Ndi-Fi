# Price feeds & oracle configuration

How Ndi-Fi obtains collateral and lending-token prices today, what is **not**
configured yet, and the steps to add a new collateral feed. Covers both the
Solidity (Ethereum) implementation and the Stellar (Soroban) implementation.

Related docs: [`UPGRADEABILITY.md`](UPGRADEABILITY.md) (admin powers that change
feeds), [`AUDIT_READINESS.md`](AUDIT_READINESS.md) (audit checklist).

---

## 1. Where oracles live in the codebase

| Chain | Contract | Oracle | Status |
|---|---|---|---|
| Ethereum (Solidity) | `src/NdiFiLending.sol` | Chainlink `AggregatorV3Interface` feeds, one per collateral + one for the lending token | Implemented, **hardened minimally** — see §3 |
| Stellar (Soroban) | `stellar/contracts/ndi_lending` | None | Not needed for the MVP (single approved borrower, no collateral pricing). Reflector (SEP-40) is the planned source — see §5 |

Only `NdiFiLending` consumes price data. `NdiFiVault`, `NdiFiStaking`,
`NdiPoint` and the three Soroban contracts never read an oracle.

## 2. How feeds are configured (Solidity)

### 2.1 Per-collateral feeds

Each supported collateral token carries its own Chainlink feed, stored in
`NdiFiLending.supportedCollateralTokens`:

```solidity
struct CollateralToken {
    address tokenAddress;
    AggregatorV3Interface priceFeed;
}
mapping(address => CollateralToken) public supportedCollateralTokens;
address[] public supportedCollateralTokenAddresses;
```

The owner registers a token with:

```solidity
addCollateralToken(address _tokenAddress, address _priceFeedAddress) // onlyOwner
```

Requirements enforced on-chain:

- `_tokenAddress != address(0)` and `_priceFeedAddress != address(0)`
- the token must not already be supported
- **no event is emitted** when a token is added or removed — indexers/monitors
  should watch the `supportedCollateralTokenAddresses` array instead
  (adding an event is a recommended hardening, see §6).

`removeCollateralToken(_tokenAddress)` (owner-only) deletes the mapping entry.
**Caveat:** if any user still holds that collateral, their valuation silently
drops and locked collateral for active loans becomes unpriceable — remove a
feed only after all positions using it are closed (known issue, see
`docs/stellar/MIGRATION.md` §4 item 15).

### 2.2 Lending-token feed

The lending token's feed is set once in the constructor and is immutable:

```solidity
constructor(IERC20 _lendingToken, NdiFiVault _vault, AggregatorV3Interface _lendingTokenPriceFeed)
```

### 2.3 Read path

```solidity
function _getLatestPrice(AggregatorV3Interface priceFeed) internal view returns (uint256) {
    (, int256 price,,,) = priceFeed.latestRoundData();
    return uint256(price) * 1e10; // assumes 8-decimal feeds → 18-decimal value domain
}
```

Prices are consumed by `getCollateralValue`, `takeLoan` (collateral and lending
token), `_sortCollateral`, `_seizeFromToken`, `getLoanValue`,
`calculateHealthFactor` and `liquidateLoan`. All value math treats the result
as an 18-decimal "unit of price denomination" amount.

## 3. Current behaviour and known gaps

The contract is intentionally thin around Chainlink. The following table
records what **is** and what is **not** configured on-chain today:

| Protection | Configured? | Notes |
|---|---|---|
| Heartbeat / staleness threshold | ❌ | `updatedAt` from `latestRoundData()` is discarded; a feed that stopped updating would keep returning its last price forever |
| Deviation threshold | ❌ | No check that the new price moved within sane bounds vs the previous round |
| Fallback price source | ❌ | A single feed per asset; a failing feed is a hard dependency |
| Circuit breaker | ❌ | No bound on price level (zero/negative handled unsafely, see below), no pause trigger on oracle failure |
| Feed decimals | ⚠️ Hard-coded | `uint256(price) * 1e10` assumes every feed reports 8 decimals. A feed with different decimals (e.g. 6) would be mis-scaled by 100×. `priceFeed.decimals()` is never queried |
| Negative price | ⚠️ Unsafe | `int256 → uint256` cast without a `price > 0` check |
| L2 sequencer-uptime check | ❌ | On L2 deployments, `latestRoundData` can lag during sequencer outages |
| Freshness of answer vs round (`answeredInRound`) | ❌ | Discarded |

These map to known issue #10 in `docs/stellar/MIGRATION.md` §4. They are
**audit-blocking items** (see `AUDIT_READINESS.md`); do not deploy
`NdiFiLending` against live feeds before the hardening below lands.

## 4. Target configuration (roadmap, not yet implemented)

When the oracle path is hardened, adopt explicit per-asset parameters stored
alongside each `CollateralToken`:

| Parameter | Meaning | Suggested default |
|---|---|---|
| `maxPriceAge` | Revert if `block.timestamp - updatedAt` exceeds this | 1 h for majors (ETH/USD, BTC/USD), 24 h for large-cap stables, 30 min for volatile small-caps |
| `maxDeviationBps` | Revert if `|newPrice - lastGoodPrice| / lastGoodPrice` exceeds this in a single round | 100–500 bps depending on asset volatility |
| `minAnswer` / `maxAnswer` | Circuit-breaker band; revert outside it | `price > 0` always; upper bound = 10× last-good price |
| Fallback behaviour | What happens when the primary feed is stale/invalid | Phase 1: revert (never guess). Phase 2: fall back to a secondary feed (e.g. Pyth/TWAP) only if it is fresh |
| Circuit breaker | Global response to repeated oracle failure | Owner (eventually multisig + timelock, see `UPGRADEABILITY.md`) can `pause()`; liquidations stop, borrows stop, repayments stay open |
| Sequencer uptime feed | L2 only | Check the L2 uptime feed before trusting prices after a restart |

The circuit-breaker policy for the MVP is simple and deliberate:
**if a price cannot be validated, functions that need it revert.** No code
path should act on an unvalidated price. Liquidation needs the same price
check as borrowing — a stale price must not make liquidations impossible or
unfair.

## 5. Stellar (Soroban) — planned Reflector integration

The Soroban MVP has **no oracle**: `NdiLending` is a vault with a single
owner-approved borrower, so no collateral pricing is required. Porting
`NdiFiLending` (collateral, health factor, liquidation) needs prices, and the
planned source is [Reflector](https://reflector.network), a SEP-40 oracle:

- SEP-40 interface: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0040.md
- Design backlog: `docs/stellar/WAVE_ISSUES.md` issue 13
- Migration context: `docs/stellar/MIGRATION.md` §5

The port must re-apply the protections in §4 (staleness, deviation, fallback)
using SEP-40 feed metadata, and must not copy the Solidity gaps listed in §3.
The integration point is the borrower hook: a future collateral/loan contract
becomes the `ndi_lending` borrower via `set_borrower`.

## 6. Adding a new collateral feed (step by step)

Solidity side, today's procedure:

1. **Pick the feed.** Use the official Chainlink feed for the deployment
   chain whose underlying matches the token exactly (same base asset, correct
   quote currency — usually USD).
2. **Check decimals.** Read `AggregatorV3Interface(feed).decimals()`. The
   current contract assumes **8 decimals**; if the feed is not 8, do not
   register it until the scaling bug is fixed (§3).
3. **Get admin access.** `addCollateralToken` is owner-only. Until
   multisig/timelock governance exists, this means the deployer EOA — see
   `UPGRADEABILITY.md` for the key-management guidance.
4. **Call** `addCollateralToken(tokenAddress, feedAddress)` from the owner.
   Reverts if either address is zero or the token is already supported.
5. **Verify on-chain** that `supportedCollateralTokens(token)` returns the
   feed and that `getCollateralValue` for a test deposit prices sanely.
6. **Test.** The lending contract currently has no test suite
   (`test/Placeholder.t.sol` is a stub — `MIGRATION.md` §4 item 18). Before
   mainnet, add Foundry tests with a mock aggregator covering: happy path,
   stale feed, negative price, zero price, decimals ≠ 8, and feed removal
   with open positions.
7. **Monitor.** Because no event is emitted, wire an off-chain watcher on the
   feed address, or add an event to `addCollateralToken` in the hardening PR.
8. **Risk params.** Note that `collateralFactor`, `liquidationThreshold`,
   `originationFeeRate` and `liquidationPenalty` are **global**, not
   per-asset. Registering a riskier collateral under the same global factor
   is a deliberate risk decision that should be recorded (issue-level review
   or a per-asset risk config in the hardening roadmap).
