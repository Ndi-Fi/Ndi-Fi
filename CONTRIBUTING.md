# Contributing to Ndi-Fi

Thanks for helping build Ndi-Fi. This guide covers the **Stellar (Soroban)**
contracts in `stellar/`, which take part in the
[Stellar Wave Program on Drips](https://www.drips.network/wave/stellar).
The Solidity contracts in `src/` follow their own Foundry workflow.

## Ground rules

- **Do not start work on an issue until a maintainer assigns it to you. Comment on the issue to express interest.**
- Every PR must include `Closes #<issue>` in its description so Drips Wave can link it.
- Keep PRs to one issue. Do not change files outside `stellar/` or `docs/stellar/` unless the issue says so. In particular, do not touch the Solidity code in `src/`, `test/` or `script/`.
- Report security problems privately to the maintainers, not in a public issue.

## Setup

1. **Rust.** Install [rustup](https://rustup.rs). The toolchain version, the `wasm32v1-none` target, `rustfmt` and `clippy` are pinned in `stellar/rust-toolchain.toml`, so this installs everything:

   ```bash
   cd stellar
   rustup toolchain install
   ```

   If you manage toolchains yourself: `rustup target add wasm32v1-none`.

2. **Stellar CLI** (version 28.x). Pick one:

   ```bash
   cargo install --locked stellar-cli
   # or a prebuilt binary from https://github.com/stellar/stellar-cli/releases
   ```

   Check with `stellar --version`.

3. **Build and test**

   ```bash
   cd stellar
   cargo test
   stellar contract build   # writes target/wasm32v1-none/release/*.wasm
   ```

## Branches

Branch from `main` and name the branch by type and issue number:

- `feat/<issue>-short-name`, for example `feat/42-staking-topups`
- `fix/<issue>-short-name`
- `docs/<issue>-short-name`
- `test/<issue>-short-name`

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org):

```
feat(staking): allow topping up an existing stake
fix(lending): round shares down on deposit
docs(stellar): add error-code reference
test(token): cover burn_from
```

Scopes: `token`, `lending`, `staking`, `stellar` (workspace, CI, scripts), `docs`, `frontend`, `ci`.

PR titles follow the same format and are enforced by CI. See [Commit and PR title format](#commit-and-pr-title-format) below.

## Before you open a PR

Run these in `stellar/`. CI runs the same checks.

```bash
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test
stellar contract build
```

The root `.gitignore` ignores `docs/` (Foundry's generated docs). Files in
`docs/stellar/` are tracked, so editing them works normally, but a **new** file
there must be added with `git add -f docs/stellar/<file>`.

Contract code rules:

- Every state-changing function that acts for a user calls `user.require_auth()`; admin functions use `#[only_owner]`.
- Errors go in the contract's `#[contracterror]` enum with an explicit code. No `panic!` with strings.
- Use instance storage for config, persistent storage for per-user data, and extend TTLs.
- Use `checked_*` math on `i128`. No floats.
- Emit an event for every state change users or indexers care about.
- Every public function has a `///` doc comment.

## Commit and PR title format

All commits and PR titles must follow [Conventional Commits](https://www.conventionalcommits.org).

```
<type>(<scope>): <subject>
```

Allowed types: `feat`, `fix`, `docs`, `test`, `chore`, `ci`, `refactor`, `perf`.  
Allowed scopes: `token`, `lending`, `staking`, `stellar`, `docs`, `frontend`, `ci`.

PR titles are linted automatically by CI (`pr-lint.yml`). Maintainers can bypass
the check by adding the `bypass-title-lint` label to the PR.

PR titles are also auto-labelled based on their type prefix (e.g. `feat:` → `feature`).

## Frontend E2E tests

The E2E suite lives in `frontend/` and runs with [Playwright](https://playwright.dev).

**Run locally:**

```bash
cd frontend
npm ci
npx playwright install --with-deps
npx playwright test
```

Traces and screenshots are saved to `frontend/playwright-report/`. In CI they
are uploaded as artifacts on failure and kept for 7 days. The E2E job must pass
before a PR can be merged.

## Wasm digest verification

Every push to `main` that touches `stellar/` rebuilds the contracts and records
`sha256` digests in `deployments/wasm-digests.txt`. The previous run's digests
are kept in `deployments/wasm-digests-prev.txt` for comparison.

**Verify a release locally:**

```bash
cd stellar
stellar contract build
for c in ndi_token ndi_lending ndi_staking; do
  sha256sum "target/wasm32v1-none/release/${c}.wasm"
done
```

Compare the output against `deployments/wasm-digests.txt` committed to `main`.
Built `.wasm` files are also uploaded as CI artifacts and retained for 90 days.

## CI artifact and cache retention

| Artifact | Retention |
|---|---|
| Playwright traces/screenshots | 7 days |
| Wasm files + digests | 90 days |

A weekly maintenance workflow (`maintenance.yml`) deletes caches last accessed
more than 7 days ago and prints total cache storage usage to the workflow log.

## Pull requests

Fill in the PR template: `Closes #<issue>`, what changed, how you tested it,
and the checklist. A maintainer reviews it. Please respond to review comments
within the Wave cycle.
