# Contributor Onboarding & First Issues

Welcome to **Ndi-Fi**! We are thrilled you want to contribute.

To help new contributors ramp up quickly and submit their first pull request with confidence, we maintain a comprehensive, step-by-step onboarding guide:

👉 **[Read the Full Contributor Onboarding Guide](docs/ONBOARDING.md)**

---

## Quick Start Summary

### 1. Choose Your Workspace & Set Up

- **Stellar (Soroban / Rust):**
  ```bash
  cd stellar
  rustup toolchain install
  cargo install --locked stellar-cli
  cargo test
  ```
- **Solidity (Foundry):**
  ```bash
  git submodule update --init --recursive
  forge test
  ```
- **Frontend / UI (Vanilla JS & Components):**
  ```bash
  cd frontend && npm test
  cd web && npm test
  ```
- **Pre-commit Checks (Recommended):**
  ```bash
  pip install pre-commit && pre-commit install
  ```

### 2. The Golden Rule
> **⚠️ Do not start work on an issue until a maintainer assigns it to you.**  
> Leave a comment on the issue stating your interest, your planned approach, and your estimated turnaround time. Once assigned, you're good to go!

### 3. Curated Good First Issues
Check out the curated starter issues in [`docs/ONBOARDING.md#4-curated-good-first-issues-catalog`](docs/ONBOARDING.md#4-curated-good-first-issues-catalog):
1. **CLI Usage Examples in `stellar/README.md`** *(Trivial / Docs)*
2. **Unit Tests for `ndi_token` `burn_from` & Expired Allowances** *(Trivial / Tests)*
3. **Test Negative Amounts Across Contracts** *(Trivial / Contract Security)*
4. **Soroban Error-Code Reference Page (`docs/stellar/ERRORS.md`)** *(Trivial / Docs & UX)*
5. **Test Lending Deposits via Asset Allowance** *(Trivial / Tests)*
6. **Accessible DeFi Concept Definitions & Translations** *(Trivial / Frontend)*

You can also browse open issues filtered by:
- [`is:issue is:open label:"good first issue"`](https://github.com/Ndi-Fi/Ndi-Fi/labels/good%20first%20issue)
- [`is:issue is:open label:wave label:trivial`](https://github.com/Ndi-Fi/Ndi-Fi/issues?q=is%3Aissue+is%3Aopen+label%3Awave+label%3Atrivial)
- The draft Wave backlog in [`docs/stellar/WAVE_ISSUES.md`](docs/stellar/WAVE_ISSUES.md).

### 4. Review & Mentorship Expectations
- **Branch Naming:** `feat/<issue>-name`, `fix/<issue>-name`, `docs/<issue>-name`, `test/<issue>-name`
- **Conventional Commits:** `feat(scope): description`, `fix(scope): description`, `docs(scope): description`, `test(scope): description`
- **Linking Issues:** PR descriptions must include `Closes #<issue>` for Drips Wave tracking.
- **Review SLA:** Maintainers review within 48–72 hours.

For complete details, checklists, and architecture overviews, read [`docs/ONBOARDING.md`](docs/ONBOARDING.md).
