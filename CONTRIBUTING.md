# Contributing to Ndi-Fi

Thanks for helping build Ndi-Fi. This guide covers contribution rules, workflows,
and review expectations across the repository, including our participation in the
[Stellar Wave Program on Drips](https://www.drips.network/wave/stellar).

> 🐣 **New contributor?** Start with our comprehensive [**Contributor Onboarding Guide**](docs/ONBOARDING.md) for step-by-step environment setup, starter task ladders, and curated good first issues!
> 🖥 **Running the full stack locally?** See [**docs/LOCAL_STACK.md**](docs/LOCAL_STACK.md) for anvil, Stellar/Soroban, frontend, and web UI setup in one place.

## Ground rules

- **Do not start work on an issue until a maintainer assigns it to you. Comment on the issue to express interest.**
- Every PR must include `Closes #<issue>` in its description so Drips Wave can link it.
- Keep PRs to one issue. Do not change files outside the directories the issue covers.
- Report security problems privately — see [SECURITY.md](SECURITY.md).

---

## Quick start

Run the bootstrap script from the repository root to install submodules, build both Foundry and Soroban contracts, and run all tests in one shot:

```bash
./bootstrap.sh
```

The script checks for missing tools ([Foundry](https://book.getfoundry.sh/getting-started/installation), [Rust/rustup](https://rustup.rs), [Node.js ≥ 18](https://nodejs.org), [Stellar CLI 28.x](https://github.com/stellar/stellar-cli/releases)) and tells you what to install before it proceeds.

## Setup

### Stellar / Soroban

1. **Rust.** Install [rustup](https://rustup.rs). The toolchain version, the `wasm32v1-none` target, `rustfmt`, and `clippy` are pinned in `stellar/rust-toolchain.toml`:

   ```bash
   cd stellar
   rustup toolchain install
   ```

2. **Stellar CLI** (version 28.x):

   ```bash
   cargo install --locked stellar-cli
   # or a prebuilt binary from https://github.com/stellar/stellar-cli/releases
   ```

   Check: `stellar --version`.

3. **Build and test**

   ```bash
   cd stellar
   cargo test
   stellar contract build   # writes target/wasm32v1-none/release/*.wasm
   ```

### Solidity / Foundry

1. **Foundry.** Install from <https://getfoundry.sh>. CI pins the version in
   `Dockerfile.foundry` (`FOUNDRY_VERSION`).

2. **Install dependencies**

   ```bash
   git submodule update --init --recursive
   ```

3. **Build and test**

   ```bash
   forge build --sizes
   forge test -vvv
   ```

### Frontend

1. **Node.js** ≥ 20. Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to manage versions.

2. **Install dependencies**

   ```bash
   cd frontend
   npm install
   ```

3. **Run the dev server**

   ```bash
   npm run dev
   ```

4. **Run checks**

   ```bash
   npm run lint
   npm run build   # ensure the production build succeeds
   ```

---

## Branch Strategy

Branch from `main` and name the branch by type and issue number:

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/<issue>-short-name` | `feat/42-staking-topups` |
| Bug fix | `fix/<issue>-short-name` | `fix/99-interest-rounding` |
| Documentation | `docs/<issue>-short-name` | `docs/180-stellar-api-reference` |
| Tests | `test/<issue>-short-name` | `test/105-token-fuzz` |

Keep branches short-lived. Rebase on `main` before opening a PR if the branch is behind.

---

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org):

```
feat(staking): allow topping up an existing stake
fix(lending): round shares down on deposit
docs(stellar): add error-code reference
test(token): cover burn_from
```

Scopes: `token`, `lending`, `staking`, `stellar` (workspace, CI, scripts), `docs`, `frontend`, `ci`.

PR titles follow the same format and are enforced by CI. See [Commit and PR title format](#commit-and-pr-title-format) below.

## Pre-commit Hooks (optional, recommended)

Install [pre-commit](https://pre-commit.com) to catch formatting and lint issues locally:

```bash
pip install pre-commit   # or pipx/brew
pre-commit install
pre-commit run --all-files   # optional first run
```

Hooks are configured in `.pre-commit-config.yaml` (Foundry `forge fmt`, Stellar `cargo fmt`, Prettier, ESLint, and basic hygiene checks). Hooks that require tools you haven't installed are skipped automatically. See [DEVELOPMENT.md](DEVELOPMENT.md) for details.

---

## Before Opening a PR

### Stellar / Soroban checks

Run these from `stellar/`. CI runs the same commands.

```bash
cargo fmt --all --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
stellar contract build
```

### Solidity checks

```bash
forge fmt --check
forge build --sizes
forge test -vvv
forge doc --build
```

Document every public/external function, event and public state variable with NatSpec
(`@notice`/`@dev`, plus `@param` and `@return`) so the generated contract reference stays
complete. `forge doc --build` writes the browsable API reference to
`docs/reference/solidity/`; see [docs/SOLIDITY_API.md](docs/SOLIDITY_API.md).

The root `.gitignore` ignores Foundry's build outputs in `docs/` while tracking markdown
guides in `docs/` and `docs/stellar/`. See [docs/ONBOARDING.md](docs/ONBOARDING.md) for full
setup and first-issue guidance.

**Stellar / Soroban**
- [ ] `cargo fmt --all --check` passes.
- [ ] `cargo clippy --all-targets --locked -- -D warnings` passes.
- [ ] `cargo test --locked` passes.
- [ ] `stellar contract build` succeeds and produces `.wasm` files.
- [ ] All public functions have `///` doc comments.
- [ ] New error variants have explicit numeric codes in the `#[contracterror]` enum.
- [ ] Every state change emits an event.
- [ ] TTLs are extended for any new persistent storage keys.
- [ ] No `panic!` with strings; `panic_with_error!` only.

**Solidity**
- [ ] `forge fmt --check` passes.
- [ ] `forge build --sizes` passes.
- [ ] `forge test -vvv` passes.
- [ ] New functions and storage variables have NatSpec comments.

## Linting GitHub Actions workflows locally

[actionlint](https://github.com/rhysd/actionlint) catches misconfigured workflows before they reach CI.

Install it once:

```bash
# macOS
brew install actionlint

# Linux — download the binary
bash <(curl -s https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)
```

Then run it from the repository root:

```bash
actionlint
```

CI runs the same check on every change to `.github/workflows/**`.

## CI

### Supported toolchain versions

| Tool | Supported (pinned, blocking) | Also tested (informational) |
| --- | --- | --- |
| Foundry | `FOUNDRY_VERSION` in `Dockerfile.foundry` | `stable`, `nightly` |
| solc | auto-detected from `pragma` (`^0.8.20`) | `0.8.24`, `0.8.28` (on Foundry `stable`) |
| Rust (Stellar) | `RUST_VERSION` in `Dockerfile.stellar` | none |
| Stellar CLI | `STELLAR_CLI_VERSION` in `Dockerfile.stellar` | none |

Only the pinned Foundry job (`Foundry project (pinned, blocking)` in
`.github/workflows/test.yml`) can fail the build. The `compat` matrix jobs,
marked `(informational)`, use `continue-on-error`. A red informational job
means a newer toolchain breaks something, but it does not block a merge.
The blocking job builds inside the `Dockerfile.foundry` image, so to change the
pinned version, update `FOUNDRY_VERSION` there (and this table if needed) in
the same PR.

### Build artifacts

CI uploads build outputs so you can inspect or deploy them without rebuilding.
Download them from the **Artifacts** section of a workflow run.

| Artifact | Workflow | Contents |
| --- | --- | --- |
| `forge-out-<sha>` | CI (`test.yml`) | Foundry `out/` (ABIs, bytecode, build info) |
| `stellar-wasm-<sha>` | Stellar (`stellar.yml`) | `ndi_token.wasm`, `ndi_lending.wasm`, `ndi_staking.wasm` |
| `web-build-<sha>` | Web (`web.yml`) | Web app build output (`dist/`, `build/`, `out/` or `.next/`), or the static files if there is no `build` script |

Artifacts are kept for **14 days**, then GitHub deletes them. The web job
uses the first of `web/`, `frontend/` or `app/` that has a `package.json`
(today that is `web/`).

### Environment variables

Every environment variable the code reads must be listed in `.env.example`.
Variables a deploy cannot run without also go in `.github/env/required.txt`.
The `Env check` workflow runs `.github/scripts/check_env.py --strict` when
`.env.example`, config or source files change, and fails if:

- a required variable is missing from `.env.example`,
- code reads a variable that `.env.example` does not list,
- `.env.example` lists a variable no code reads (renamed or removed), or
- `.env.example` has a duplicate or malformed line.

Run it locally with `python3 .github/scripts/check_env.py`.

## Stale issue and PR policy

A bot (`.github/workflows/stale.yml`) runs daily to keep the tracker tidy:

- **Issues** with no activity for **60 days** get the `stale` label and a
  comment. They close **14 days** later if nothing happens.
- **Pull requests** with no activity for **30 days** get the `stale` label and
  close **14 days** later.
- Any comment, commit or label change removes the `stale` label and resets
  the clock.
- These are **never** marked stale: anything labelled `pinned`, `security`,
  `Stellar Wave` or `wave`, anything in a milestone, and anything with an
  assignee.

Closed items can be reopened. Maintainers review these thresholds every
quarter (January, April, July, October) and adjust them in `stale.yml` and
here if they close too much or too little.

## Pull requests

**Documentation**
- [ ] All links resolve correctly.
- [ ] Code blocks are accurate against the current codebase.
- [ ] Spelling and grammar checked.
