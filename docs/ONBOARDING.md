# Contributor Onboarding Guide

Welcome to **Ndi-Fi**! Whether you are an experienced DeFi developer or making your very first open-source contribution, this guide will help you set up your local development environment, understand the repository architecture, pick your first task, and navigate our review and mentorship process.

Ndi-Fi participates in the [Stellar Wave Program on Drips](https://www.drips.network/wave/stellar). We take pride in cultivating a welcoming, well-documented, and mentor-guided environment for all contributors.

---

## Table of Contents

- [1. Repository Architecture & Stack Overview](#1-repository-architecture--stack-overview)
- [2. Local Environment Setup (Step-by-Step)](#2-local-environment-setup-step-by-step)
  - [2.1 Universal Prerequisites & Git Hygiene](#21-universal-prerequisites--git-hygiene)
  - [2.2 Stellar / Soroban Workspace (`stellar/`)](#22-stellar--soroban-workspace-stellar)
  - [2.3 Ethereum / EVM Workspace (`src/`, `test/`)](#23-ethereum--evm-workspace-src-test)
  - [2.4 Frontend & UI Workspaces (`frontend/`, `web/`)](#24-frontend--ui-workspaces-frontend-web)
  - [2.5 Pre-flight Sanity Check](#25-pre-flight-sanity-check)
- [3. The Starter Task Path (Progression Ladder)](#3-the-starter-task-path-progression-ladder)
- [4. Curated Good First Issues Catalog](#4-curated-good-first-issues-catalog)
- [5. Working with the Wave-Task Issue Template](#5-working-with-the-wave-task-issue-template)
- [6. Mentorship & Review Expectations](#6-mentorship--review-expectations)
  - [The Golden Rule: Issue Assignment First](#the-golden-rule-issue-assignment-first)
  - [How to Express Interest & Request Assignment](#how-to-express-interest--request-assignment)
  - [Mentorship Channels & Support SLA](#mentorship-channels--support-sla)
  - [Branching, Commits, and Pull Requests](#branching-commits-and-pull-requests)
- [7. Keeping this Guide Updated as the Stack Evolves](#7-keeping-this-guide-updated-as-the-stack-evolves)

---

## 1. Repository Architecture & Stack Overview

Ndi-Fi is a hybrid repository supporting both **Stellar (Soroban)** smart contracts and **Ethereum (EVM)** smart contracts, complemented by accessible frontend components and shared UI libraries.

```
Ndi-Fi/
├── stellar/                   # Stellar / Soroban smart contracts (Rust)
│   ├── contracts/
│   │   ├── ndi_token/         # SEP-41 compliant reward token
│   │   ├── ndi_lending/       # Single-asset lending vault (fixed APR)
│   │   └── ndi_staking/       # LP token staking with cooldown & rewards
│   ├── tests/                 # End-to-end integration tests
│   └── scripts/               # Testnet deployment scripts
├── src/                       # Ethereum / EVM smart contracts (Solidity)
│   ├── core/                  # Lending & staking contracts (NdiFiVault, NdiFiLending)
│   ├── tokens/                # NdiPoint and test tokens
│   └── interfaces/            # Contract interfaces
├── test/                      # Foundry test suites for Solidity contracts
├── frontend/                  # Accessible DeFi tooltips & progressive inline help
│   ├── src/                   # Custom elements and localized content (en, es, fr)
│   └── test/                  # Node.js DOM-based test suite
├── web/                       # Shared UI components
│   └── components/footer/     # Framework-agnostic accessible footer
├── docs/                      # Technical specifications & protocol architecture
│   ├── ONBOARDING.md          # This onboarding guide
│   ├── AUDIT_READINESS.md     # Pre-audit security checklist
│   ├── ORACLE.md              # Price oracle wiring & integration guide
│   ├── UPGRADEABILITY.md      # Contract upgradeability models & governance
│   ├── VAULT_ERC4626.md       # ERC-4626 vault conformance matrix
│   └── stellar/               # Soroban architecture, migration notes & issue backlog
│       ├── ARCHITECTURE.md    # Soroban system architecture
│       ├── MIGRATION.md       # Solidity-to-Soroban migration matrix & known issues
│       └── WAVE_ISSUES.md     # Curated backlog of draft Wave tasks
└── .github/                   # GitHub workflows and issue/PR templates
    ├── ISSUE_TEMPLATE/
    │   ├── bug-report.md      # Bug report template
    │   └── wave-task.md       # Scoped Wave task template (Drips Wave)
    └── pull_request_template.md
```

---

## 2. Local Environment Setup (Step-by-Step)

You do not need to install every toolchain on day one. Install the toolchain corresponding to the area you wish to contribute to:

| Area | Primary Languages | Core Tools Required | Workspace Directory |
|---|---|---|---|
| **Stellar Contracts** | Rust | Rustup, `wasm32v1-none`, `stellar-cli` (v28.x) | `stellar/` |
| **Solidity Contracts** | Solidity | Foundry (`forge`, `cast`, `anvil`) | Root / `src/` / `test/` |
| **Frontend & UI** | JavaScript / CSS | Node.js (v18+ or v20+), npm | `frontend/`, `web/` |
| **Documentation** | Markdown | Prettier, Markdown linting | `docs/`, `*.md` |

### 2.1 Universal Prerequisites & Git Hygiene

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ndi-Fi/Ndi-Fi.git
   cd Ndi-Fi
   ```

2. **Initialize Git submodules** (required for Foundry dependencies):
   ```bash
   git submodule update --init --recursive
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   node scripts/validate-env.js --check-example
   ```

4. **Install `pre-commit` (Recommended):**
   We use [`pre-commit`](https://pre-commit.com) to catch formatting and lint errors before they reach CI. Hooks that require tools you do not have installed will automatically skip cleanly.
   ```bash
   pip install pre-commit      # or: brew install pre-commit / pipx install pre-commit
   pre-commit install
   ```

---

### 2.2 Stellar / Soroban Workspace (`stellar/`)

The Stellar contracts use Soroban and OpenZeppelin Stellar Contracts.

1. **Install Rust and the pinned toolchain:**
   The exact Rust version and targets are pinned in `stellar/rust-toolchain.toml`:
   ```bash
   cd stellar
   rustup toolchain install
   ```
   If managing manually, ensure you add the WASM target:
   ```bash
   rustup target add wasm32v1-none
   ```

2. **Install Stellar CLI (v28.x):**
   ```bash
   cargo install --locked stellar-cli
   ```
   *(Alternatively, grab a prebuilt binary from [Stellar CLI Releases](https://github.com/stellar/stellar-cli/releases).)*  
   Confirm your installation:
   ```bash
   stellar --version
   ```

3. **Compile and run the test suite:**
   ```bash
   cd stellar
   cargo fmt --all --check
   cargo clippy --all-targets -- -D warnings
   cargo test
   stellar contract build
   ```
   All test crates (`ndi-token`, `ndi-lending`, `ndi-staking`, and `stellar-integration-tests`) should pass.

---

### 2.3 Ethereum / EVM Workspace (`src/`, `test/`)

1. **Install Foundry:**
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```
   Confirm with `forge --version`.

2. **Compile and run the Foundry tests:**
   ```bash
   forge fmt --check
   forge build --sizes
   forge test -vvv
   ```

---

### 2.4 Frontend & UI Workspaces (`frontend/`, `web/`)

Our frontend and reusable web UI packages have zero external runtime framework dependencies.

1. **Run the DeFi Help UI tests:**
   ```bash
   cd frontend
   npm test
   ```
   To preview the live interactive tooltips and locale switcher:
   ```bash
   npm run demo
   # Opens http://localhost:3000
   ```

2. **Run the Shared Footer UI tests:**
   ```bash
   cd web
   npm test
   ```
   To preview the shared footer in a browser:
   ```bash
   python3 -m http.server 8000
   # Open http://localhost:8000/web/index.html
   ```

---

### 2.5 Pre-flight Sanity Check

Before writing code, verify your active subsystem passes all local tests:
- **Stellar:** `cd stellar && cargo test`
- **Solidity:** `forge test`
- **Frontend/Web:** `npm test --prefix frontend && npm test --prefix web`

If everything is green, your environment is ready!

---

## 3. The Starter Task Path (Progression Ladder)

To help contributors build momentum, we recommend progressing through tasks of increasing depth:

```
┌───────────────────────────────────────────────────────────────┐
│ Level 0: Orientation & Baseline Verification                  │
│ Fork, clone, build, run test suites, set up pre-commit hooks. │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│ Level 1: Starter / Good First Issues (Trivial Complexity)      │
│ Documentation fixes, CLI usage guides, adding test cases for  │
│ negative inputs, allowances, and edge conditions.             │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│ Level 2: Feature & View Helpers (Medium Complexity)           │
│ Adding position view structs, event assertions, idempotency   │
│ in deploy scripts, utilization guards, localized help copy.   │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│ Level 3: Protocol Architecture & Security (High Complexity)   │
│ Staking reward accumulator patterns, in-place contract        │
│ upgrades, Reflector oracle design, ERC-4626 property tests.  │
└───────────────────────────────────────────────────────────────┘
```

- **Level 0 (Day 1):** Orientation, environment verification, reading [`docs/stellar/ARCHITECTURE.md`](stellar/ARCHITECTURE.md) and [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- **Level 1 (First PR):** A scoped task that lets you walk through the pull request lifecycle, conventional commit conventions, and CI checks with zero risk.
- **Level 2 (Expanding Skills):** Implement read-only contracts views, contract events, or script enhancements.
- **Level 3 (Core Protocol):** Tackle advanced multi-contract logic, storage migrations, or oracle adapters.

---

## 4. Curated Good First Issues Catalog

Below is a curated list of starter issues ready for new contributors. These are sourced directly from our master backlog in [`docs/stellar/WAVE_ISSUES.md`](stellar/WAVE_ISSUES.md) and repository issue tracker.

### 🌟 Stellar Starter Tasks

#### 1. CLI Usage Examples in `stellar/README.md`
- **Complexity:** Trivial | **Type:** Documentation & CLI
- **Context:** `stellar/README.md` explains how to build and deploy contracts, but lacks copy-paste `stellar` CLI commands for calling contract methods on testnet.
- **Files Involved:** `stellar/README.md`, `deployments/testnet.json`
- **Task:**
  - Add a "Using the contracts" section with example commands for `deposit`, `withdraw`, `borrow`, `repay`, `stake`, `claim`, and `unstake`.
  - Demonstrate extracting contract IDs from `deployments/testnet.json` using `jq`.
  - Explain token amounts in 7-decimal stroops.
- **Verification:** Run the commands against testnet or a local sandbox.

#### 2. Unit Tests for `ndi_token` `burn_from` & Expired Allowances
- **Complexity:** Trivial | **Type:** Rust / Testing
- **Context:** The token tests cover direct `burn` and `transfer_from`, but do not yet test `burn_from` or allowance expiration when ledger sequence exceeds `live_until_ledger`.
- **Files Involved:** `stellar/contracts/ndi_token/src/test.rs`
- **Task:**
  - Add test: `burn_from` with sufficient allowance reduces allowance and total supply.
  - Add test: `burn_from` exceeding allowance fails with `AllowanceInsufficient`.
  - Add test: allowance expires after ledger sequence advances past `live_until_ledger`.
- **Verification:** `cd stellar && cargo test -p ndi-token`

#### 3. Test Negative Amounts Across All Three Stellar Contracts
- **Complexity:** Trivial | **Type:** Contract Security / Validation
- **Context:** Amounts in contracts use signed `i128`. All contracts check `amount <= 0`, but current unit tests only pass `0`.
- **Files Involved:** `stellar/contracts/*/src/test.rs`
- **Task:**
  - Pass `-1` to: `mint`, `stake`, `deposit`, `withdraw`, `borrow`, `repay`, and `fund_rewards`.
  - Assert that each function rejects the negative value with the exact contract error code (not just a generic failure).
- **Verification:** `cd stellar && cargo test`

#### 4. Soroban Error-Code Reference Page (`docs/stellar/ERRORS.md`)
- **Complexity:** Trivial | **Type:** Documentation & UX
- **Context:** Stellar returns raw numeric error codes (e.g. `Error(Contract, #4)`). Users and frontend developers need a central lookup table.
- **Files Involved:** `docs/stellar/ERRORS.md` (new), `stellar/contracts/*/src/errors.rs`
- **Task:**
  - Create `docs/stellar/ERRORS.md` with tables mapping error codes to names, causes, and user remedies for `ndi_token`, `ndi_lending`, and `ndi_staking`.
  - Include OpenZeppelin standard error ranges (100+, 400+, etc.).
  - Cross-link from `stellar/README.md`.
- **Verification:** Verify all error enums match the source code.

#### 5. Test Lending Deposits via Asset Allowance
- **Complexity:** Trivial | **Type:** Rust / Vault Testing
- **Context:** OpenZeppelin's vault supports operator deposits where `operator != from` (operator spends depositor's allowance). Current tests only test `operator == from`.
- **Files Involved:** `stellar/contracts/ndi_lending/src/test.rs`
- **Task:**
  - Test: Account A approves Account B; Account B calls `deposit` for Account C; balances and allowances update properly.
  - Test: Calling without allowance fails.
- **Verification:** `cd stellar && cargo test -p ndi-lending`

---

### 🎨 Frontend & Web Starter Tasks

#### 6. Add Accessible DeFi Concept Definitions & Translations
- **Complexity:** Trivial | **Type:** Frontend / Localization
- **Context:** The DeFi help UI provides localized tooltips. Additional concepts (e.g., *Loan-to-Value (LTV)*, *Liquidation Penalty*, *Slippage*) can be added.
- **Files Involved:** `frontend/src/help-content.js`, `frontend/src/locales/en.js`, `frontend/src/locales/es.js`, `frontend/src/locales/fr.js`, `frontend/test/help-content.test.js`
- **Task:** Add concept keys, write plain-language explanations in English, Spanish, and French, and ensure test assertions pass.
- **Verification:** `cd frontend && npm test`

---

## 5. Working with the Wave-Task Issue Template

All tasks participating in the Stellar Wave Program are created using the [`.github/ISSUE_TEMPLATE/wave-task.md`](../.github/ISSUE_TEMPLATE/wave-task.md) template.

### Anatomy of a Wave Task

When you open a Wave issue on GitHub, you will see the following structured fields:

```markdown
---
name: Wave task
about: A scoped task for the Stellar Wave Program (Drips Wave)
title: "[Wave] <Task Name>"
labels: ["wave", "stellar"]
---

> **Do not start work on this issue until a maintainer assigns it to you.**
> Comment below to express interest. Your PR must include `Closes #<this issue>`.

## Summary
<!-- Concise 1-2 sentence description of the goal -->

## Context
<!-- Background technical context, why it matters, links to architecture docs -->

## Acceptance criteria
<!-- Checkbox list of exact deliverables required for completion -->
- [ ] Deliverable 1
- [ ] Deliverable 2

## Files likely involved
<!-- Specific files to touch, guarding against out-of-scope changes -->

## Complexity
<!-- Trivial / Medium / High -->

## How to test
<!-- Exact terminal commands maintainers and CI will run to verify your PR -->

## Resources
<!-- Links to SEPs, documentation guides, and reference implementations -->
```

### Finding Active Good First Issues on GitHub

Use these GitHub issue filters to find unassigned starter tasks:
- `is:issue is:open label:"good first issue"`
- `is:issue is:open label:wave label:trivial`
- `is:issue is:open no:assignee label:wave`

You can also browse the draft backlog in [`docs/stellar/WAVE_ISSUES.md`](stellar/WAVE_ISSUES.md). If you see an unposted backlog item you'd like to work on, ask a maintainer in an issue or discussion to create it with the Wave template!

---

## 6. Mentorship & Review Expectations

### The Golden Rule: Issue Assignment First

> **⚠️ Do not start work on an issue until a maintainer assigns it to you.**

Why is this strictly enforced?
1. **Drips Wave Attribution:** The Wave program tracks contributor assignments. Unassigned PRs cannot be counted toward Wave rewards.
2. **Preventing Wasted Effort:** Ensures multiple contributors do not duplicate work on the same task.
3. **Early Architectural Mentorship:** Gives maintainers an opportunity to review and refine your proposed implementation plan before you write code.

---

### How to Express Interest & Request Assignment

Leave a clear comment on the issue. Here is a recommended template:

```markdown
Hi maintainers! I'd like to work on this issue.

- **Approach:** I plan to add the test cases in `stellar/contracts/ndi_token/src/test.rs` covering expired allowances using `env.ledger().set_sequence_number()`.
- **Estimated Turnaround:** 2-3 days.
- **Questions:** None right now / [Any initial clarifying question].

Could you please assign this issue to me?
```

Once a maintainer responds and assigns the issue to your GitHub username, you are clear to begin!

---

### Mentorship Channels & Support SLA

- **Where to ask questions:**
  - **Issue Comments:** Ask directly in your assigned issue. This keeps discussions public, searchable, and beneficial to future contributors.
  - **PR Reviews:** If you have questions about specific lines of code, post them as draft comments in your PR.
  - **General Questions:** See [`SUPPORT.md`](../SUPPORT.md) for reaching maintainers.
- **Review Turnaround (SLA):**
  - Maintainers strive to provide initial reviews on assigned PRs within **48 to 72 hours**.
  - If you haven't received feedback after 3 business days, feel free to post a gentle ping on the PR thread.
- **Contributor Expectations:**
  - If a maintainer requests changes, please respond or push updates within the active Wave sprint cycle (typically within 3–5 days).
  - If unexpected life events come up or you get blocked, just leave a quick comment! We can offer help, pair with you, or release the assignment without any penalty.

---

### Branching, Commits, and Pull Requests

#### 1. Branch Naming
Branch from `main` using the conventional prefix and issue number:
- `feat/<issue>-short-name`
- `fix/<issue>-short-name`
- `docs/<issue>-short-name`
- `test/<issue>-short-name`

*Example:* `git checkout -b test/2-token-burn-from`

#### 2. Commit Messages (Conventional Commits)
Use [Conventional Commits](https://www.conventionalcommits.org):
- `feat(scope): add view function for position status`
- `fix(lending): prevent rounding error on asset deposit`
- `docs(onboarding): add starter issues and setup steps`
- `test(token): cover burn_from and expired allowances`

*Allowed scopes:* `token`, `lending`, `staking`, `stellar`, `solidity`, `frontend`, `web`, `docs`.

#### 3. PR Description & The Magic Keyword
Your PR description **must** begin with `Closes #<issue-number>` so GitHub and Drips Wave automatically link and close the issue on merge:

```markdown
Closes #2

## What changed
Added unit tests for NdiToken burn_from and expired allowances.

## How it was tested
Ran `cargo test -p ndi-token` locally. All 14 tests passing.

## Checklist
- [x] `cargo fmt --all --check` passes
- [x] `cargo clippy --all-targets -- -D warnings` passes
- [x] `cargo test` passes
- [x] No changes outside `stellar/` or `docs/stellar/`
- [x] Assigned to this issue before starting
```

#### 4. Scope Hygiene
Do not bundle unrelated fixes or format files outside your issue's scope. Keep PR diffs minimal and focused.

---

## 7. Keeping this Guide Updated as the Stack Evolves

This onboarding document is a **living specification** maintained under a *Docs-as-Code* philosophy.

### Update Triggers

Maintainers and contributors should update this guide whenever:
1. **Toolchain Bumps:** Upgrades to `stellar-cli`, Soroban SDK, Rust edition/toolchain, Foundry, or Node.js.
2. **Issue Backlog Refresh:** When good first issues listed in [Section 4](#4-curated-good-first-issues-catalog) are merged, graduate them and introduce new tasks from [`docs/stellar/WAVE_ISSUES.md`](stellar/WAVE_ISSUES.md).
3. **Architecture Expansions:** Introduction of new protocol subsystems (e.g. Reflector oracle integration, testnet deploy tooling, new frontend packages).
4. **Onboarding Friction:** If a new contributor encounters ambiguity, broken commands, or missing prerequisites during setup, submit a PR updating this document.

### Document Revision History

| Revision | Date | Summary of Changes | Author |
|---|---|---|---|
| `v1.0.0` | 2026-11-23 | Initial contributor onboarding doc: setup steps, starter task path, curated issues, Wave template guide, mentorship SLA (#208) | Ndi-Fi Contributors |
| `v1.1.0` | 2026-11-23 | Add cross-link to docs/LOCAL_STACK.md for full local stack setup (#209) | Ndi-Fi Contributors |

---

*Thank you for contributing to Ndi-Fi! If you have any questions or feedback on how to make onboarding even smoother, open an issue or submit a PR.*

---

## See Also

- [CONTRIBUTING.md](../CONTRIBUTING.md) — workflow, branch naming, commit conventions
- [DEVELOPMENT.md](../DEVELOPMENT.md) — pre-commit hooks and format/lint reference
- [docs/LOCAL_STACK.md](LOCAL_STACK.md) — run all subsystems locally (anvil, Stellar tests, frontend, web)
