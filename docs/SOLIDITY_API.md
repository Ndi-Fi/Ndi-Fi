# Solidity contract API reference

This page is the welcome page for the generated [Ndi-Fi Solidity API
reference](https://adams813.github.io/Ndi-Fi/). The reference is built from the
[NatSpec](https://docs.soliditylang.org/en/v0.8.20/natspec-format.html) comments in
`src/` with `forge doc`, so it always reflects the checked-in contracts.

## Published reference

The docs workflow builds an mdBook from the Solidity sources and publishes it to
GitHub Pages (repository setting: **Settings → Pages → Source → GitHub Actions**).
Open the [published contract reference](https://adams813.github.io/Ndi-Fi/) to browse:

- [NdiFiLending](src/NdiFiLending.sol/contract.NdiFiLending.md) — collateralized lending market
- [NdiStaking](src/NdiFiStaking.sol/contract.NdiStaking.md) — staking and reward distribution
- [NdiFiVault](src/NdiFiVault.sol/contract.NdiFiVault.md) — ERC-4626 liquidity vault
- [NdiPoint](src/NdiPoint.sol/contract.NdiPoint.md) — reward points ERC-20
- [NdiPointIntegrationExample](src/NdiPointIntegrationExample.sol/contract.NdiPointIntegrationExample.md) — integration example
- [MockDAI](src/testMockDai.sol/contract.MockDAI.md) — local test token

Each contract page lists its events, errors, public state variables and public /
external functions declared in `src/`, including parameter and return
descriptions supplied by NatSpec. Behaviour inherited from OpenZeppelin bases
(such as ERC-20, ERC-4626, Ownable and Pausable) is described in the relevant
contract overview and in the
[OpenZeppelin Contracts documentation](https://docs.openzeppelin.com/contracts/5.x/).

## Generate locally

Foundry 1.2.3 is the version used in CI:

```bash
forge doc --build
```

The generated mdBook is written to `docs/reference/solidity/` and its rendered
HTML to `docs/reference/solidity/book/`. Open
`docs/reference/solidity/book/index.html` in a browser, or run
`forge doc --build --serve` for a local server. Both directories are ignored by Git; only the checked-in
NatSpec comments and this page are versioned.

## Keep the reference complete

When adding or changing a public or external function, event, or public state
variable in `src/`, add a `/// @notice` (or `@dev`) comment and `@param` / `@return`
tags for its inputs and outputs. The docs workflow runs `forge doc --build` on
every pull request so a broken reference fails CI before merge.
