# Changelog

All notable changes to Ndi-Fi are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html): `MAJOR.MINOR.PATCH`. Breaking changes (new required storage, changed function signatures, incompatible ABI) increment `MAJOR`. New features that are backward-compatible increment `MINOR`. Bug fixes and documentation-only changes increment `PATCH`.

---

## [Unreleased]

### Added
- CI/CD pipeline documentation (`docs/CICD.md`) — closes #198
- Protocol incident runbook (`docs/RUNBOOK.md`) — closes #197
- Troubleshooting FAQ (`docs/FAQ.md`) — closes #201
- Changelog and release process (`CHANGELOG.md`, `docs/RELEASE.md`) — closes #199
- Error states: `<ndi-error>` plus a template catalogue that maps protocol reverts, wallet and network errors to en/es/fr copy with retry / switch-network / connect-wallet actions (`web/components/error/`) — closes #145
- Icon set: 46 SVG icons, `<ndi-icon>`, `iconSvg()` and iconography guidelines (`web/components/icon/`, `web/icons.html`) — closes #146
- Dark mode to WCAG AA: contrast audit and CI test for every token pair, no-flash theme runtime (`web/design-tokens/contrast.js`, `web/theme/`, `docs/design/05-dark-mode.md`) — closes #147
- Onboarding: guided tour, contextual hints, wallet prompts and borrowing risk acknowledgement (`web/components/onboarding/`, `docs/design/06-onboarding.md`) — closes #152

### Changed
- Light-theme `success`, `warning`, `info` and `focus-ring` tokens darkened to meet WCAG AA (#147)

---

## [0.2.0] — 2024-11-21

### Added
- Stellar / Soroban implementation: `NdiToken`, `NdiLending`, `NdiStaking` contracts in `stellar/contracts/`
- Stellar deployment script: `stellar/scripts/deploy_testnet.sh`
- Architecture and migration notes: `docs/stellar/ARCHITECTURE.md`, `docs/stellar/MIGRATION.md`
- GitHub Actions workflow for Soroban: `.github/workflows/stellar.yml`

### Changed
- `NdiLending` on Stellar uses a fixed-APR model with simple interest capitalised on each borrow/repay/rate-change call, replacing the Chainlink-based collateral model (deferred to a future release)
- Staking principal is held in the staking contract directly; the Solidity vault hook is replaced by an owner-approved borrower pattern

---

## [0.1.0] — 2024-10-01

### Added
- EVM smart contracts: `NdiFiVault`, `NdiFiLending`, `NdiFiStaking`, `NdiPoint`
- Foundry test suite and deployment scripts
- GitHub Actions CI workflow: `.github/workflows/test.yml`
- Protocol documentation: `README.md`, `NdiFiStaking_README.md`, `NdiPoint_README.md`, `Tokenomics.md`, `Roadmap.md`

---

## Release process

See [docs/RELEASE.md](docs/RELEASE.md) for the full release checklist, versioning policy, and automation details.
