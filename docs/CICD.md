# CI/CD Pipelines

Ndi-Fi uses two GitHub Actions workflows. Both run on push, pull request, and manual dispatch (`workflow_dispatch`).

---

## `test.yml` — EVM (Foundry)

**File:** `.github/workflows/test.yml`

### When it runs

| Trigger | Condition |
|---|---|
| `push` | Any branch, any file |
| `pull_request` | Any target branch, any file |
| `workflow_dispatch` | Manual trigger from the Actions tab |

### What it does

| Step | Command | Purpose |
|---|---|---|
| Checkout | `actions/checkout@v4` with `submodules: recursive` | Clones the repo and all git submodules (OpenZeppelin, forge-std, Chainlink) |
| Install Foundry | `foundry-rs/foundry-toolchain@v1`, pinned to `1.2.3` | Installs `forge`, `cast`, and `anvil` |
| Show version | `forge --version` | Confirms the pinned toolchain is active |
| Format check | `forge fmt --check` (auto-formats and continues if check fails) | Ensures consistent Solidity formatting |
| Build | `forge build --sizes` | Compiles all contracts and prints bytecode sizes |
| Test | `forge test -vvv` | Runs the full test suite with verbose output |

### Required secrets

None. The workflow uses no external services and needs only read access to the repository (`permissions: contents: read`).

### Runner assumptions

- `ubuntu-latest` (GitHub-hosted runner)
- Internet access to download the Foundry toolchain and install submodule dependencies

### Running steps locally

```bash
# Install Foundry (once)
curl -L https://foundry.paradigm.xyz | bash
foundryup --version 1.2.3

# From the repo root
forge build --sizes
forge test -vvv

# Format check
forge fmt --check
# Auto-fix formatting
forge fmt
```

---

## `stellar.yml` — Stellar / Soroban

**File:** `.github/workflows/stellar.yml`

### When it runs

| Trigger | Condition |
|---|---|
| `push` | Only when files under `stellar/**` or `.github/workflows/stellar.yml` change |
| `pull_request` | Same path filter |
| `workflow_dispatch` | Manual trigger |

The path filter means changes that only touch Solidity contracts, documentation, or other non-Stellar files do not trigger this workflow.

### What it does

| Step | Command | Purpose |
|---|---|---|
| Checkout | `actions/checkout@v4` | Clones the repo (no submodules needed for Stellar) |
| Install Rust | `rustup toolchain install` | Reads `stellar/rust-toolchain.toml` to install the pinned toolchain (`1.99.1`) with the `wasm32v1-none` target, `rustfmt`, and `clippy` |
| Cache cargo | `actions/cache@v4` | Caches `~/.cargo/registry`, `~/.cargo/git`, and `stellar/target` keyed by `Cargo.lock` and `rust-toolchain.toml` |
| Install Stellar CLI | `curl` + `tar` | Downloads Stellar CLI `28.1.0` for `x86_64-unknown-linux-gnu` and puts it on `$PATH` |
| Format check | `cargo fmt --all --check` | Verifies consistent Rust formatting across all crates |
| Clippy | `cargo clippy --all-targets --locked -- -D warnings` | Lints all targets; warnings are errors |
| Tests | `cargo test --locked` | Runs all unit and integration tests |
| Contract build | `stellar contract build` | Compiles each contract to WASM; asserts the three output files exist: `ndi_token.wasm`, `ndi_lending.wasm`, `ndi_staking.wasm` |

All steps run with `defaults.run.working-directory: stellar`.

### Required secrets

None. The workflow reads no secrets. Testnet deployments are done separately via `stellar/scripts/deploy_testnet.sh` (see `stellar/README.md`).

### Runner assumptions

- `ubuntu-latest` (GitHub-hosted runner)
- Internet access to download the Stellar CLI tarball and Rust/Cargo dependencies

### Running steps locally

```bash
cd stellar

# Install the pinned Rust toolchain (reads rust-toolchain.toml automatically)
rustup toolchain install

# Install Stellar CLI (replace version as needed)
STELLAR_CLI_VERSION=28.1.0
curl -sSfL -o /tmp/stellar-cli.tar.gz \
  "https://github.com/stellar/stellar-cli/releases/download/v${STELLAR_CLI_VERSION}/stellar-cli-${STELLAR_CLI_VERSION}-x86_64-unknown-linux-gnu.tar.gz"
mkdir -p ~/.local/bin
tar -xzf /tmp/stellar-cli.tar.gz -C ~/.local/bin stellar

# Format
cargo fmt --all

# Lint
cargo clippy --all-targets --locked -- -D warnings

# Test
cargo test --locked

# Build WASMs
stellar contract build
```

---

## Debugging failures

### Format failures

`forge fmt --check` or `cargo fmt --all --check` exits non-zero when any file is not formatted. Run `forge fmt` or `cargo fmt --all` locally, commit the result.

### Build failures

- **Solidity:** `forge build --sizes` failures are usually compilation errors or missing submodule dependencies. Run `git submodule update --init --recursive` and try again.
- **Rust:** `cargo clippy` or `cargo test` failures print the error directly. `--locked` means the `Cargo.lock` must be committed and in sync with `Cargo.toml`.

### Test failures

- Foundry: `forge test -vvv` prints a trace for each failing test. Use `forge test --match-test <test_name> -vvvvv` for maximum verbosity on a single test.
- Stellar: `cargo test -- --nocapture` prints `println!` output from tests. Run `cargo test -p ndi-lending` to isolate a single crate.

### Cache issues

If a Stellar build fails after a `Cargo.lock` change, the old cache may be stale. The cache key includes `Cargo.lock`, so a lock-file change invalidates it automatically. For a forced refresh, change the `restore-keys` prefix in `stellar.yml`.

---

## Adding new workflows

When frontend and docs pipelines land, document them here with the same structure: triggers, steps, secrets, runner requirements, and local equivalents.
