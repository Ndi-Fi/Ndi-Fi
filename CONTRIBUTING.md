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

Scopes: `token`, `lending`, `staking`, `stellar` (workspace, CI, scripts), `docs`.

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

## CI

### Supported toolchain versions

| Tool | Supported (pinned, blocking) | Also tested (informational) |
| --- | --- | --- |
| Foundry | `1.2.3` | `stable`, `nightly` |
| solc | `0.8.30` | `0.8.24`, `0.8.28` |
| Rust (Stellar) | `stellar/rust-toolchain.toml` | none |
| Stellar CLI | `28.1.0` | none |

Only the pinned Foundry job (`Foundry project (pinned, blocking)` in
`.github/workflows/test.yml`) can fail the build. The `compat` matrix jobs,
marked `(informational)`, use `continue-on-error`. A red informational job
means a newer toolchain breaks something, but it does not block a merge.
To change the pinned version, update `PINNED_FOUNDRY_VERSION` /
`PINNED_SOLC_VERSION` in `test.yml` and this table in the same PR.

### Build artifacts

CI uploads build outputs so you can inspect or deploy them without rebuilding.
Download them from the **Artifacts** section of a workflow run.

| Artifact | Workflow | Contents |
| --- | --- | --- |
| `forge-out-<sha>` | CI (`test.yml`) | Foundry `out/` (ABIs, bytecode, build info) |
| `stellar-wasm-<sha>` | Stellar (`stellar.yml`) | `ndi_token.wasm`, `ndi_lending.wasm`, `ndi_staking.wasm` |
| `web-build-<sha>` | Web (`web.yml`) | Web app build output (`dist/`, `build/`, `out/` or `.next/`) |

Artifacts are kept for **14 days**, then GitHub deletes them. The web job
only runs once a `web/`, `frontend/` or `app/` directory with a `package.json`
exists.

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

Fill in the PR template: `Closes #<issue>`, what changed, how you tested it,
and the checklist. A maintainer reviews it. Please respond to review comments
within the Wave cycle.
