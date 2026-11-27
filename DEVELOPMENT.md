# Development guide

This guide covers local tooling for contributors. To run the full local stack
(anvil + Stellar + web UIs) in one go, see [**docs/LOCAL_STACK.md**](docs/LOCAL_STACK.md).
For the beginner onboarding path and starter issues, see [**docs/ONBOARDING.md**](docs/ONBOARDING.md).
For workflow, branches, and PR rules, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Docker Compose & Environment Setup

Ndi-Fi includes a containerized development environment via `docker-compose.yml`.

### Setting up `.env`

Copy `.env.example` to create your local `.env`:

```bash
cp .env.example .env
```

Validate `.env.example` and `.env` at any time with:

```bash
node scripts/validate-env.js --check-example
```

### Running with Docker Compose

Both backend and frontend services load `.env` through the `env_file: .env` directive in `docker-compose.yml`:

```bash
# Start backend (Anvil EVM node :8545) and frontend (Help UI :3000)
docker-compose up -d --build

# Inspect logs
docker-compose logs -f

# Shut down
docker-compose down
```

All `NEXT_PUBLIC_*` variables in `.env` are forwarded to the frontend container for client-side contract interactions.

## Pre-commit (format and lint)

Quick local checks run before each commit so issues are caught before CI.

### Install

1. Install [pre-commit](https://pre-commit.com/):
   - `pip install pre-commit` (or `pipx install pre-commit`, `brew install pre-commit`)
2. From the repo root, install the git hook:
   ```bash
   pre-commit install
   ```
3. (Optional) Run against all files once:
   ```bash
   pre-commit run --all-files
   ```

### What runs

Configured in [`.pre-commit-config.yaml`](.pre-commit-config.yaml):

- **Solidity (Foundry):** `forge fmt --check` on `.sol` changes (requires Foundry).
- **Rust (Stellar):** `cargo fmt --all --check` in `stellar/` on Rust/Cargo changes (requires Rust).
- **Prettier:** `npx --no-install prettier --check .` on common web/doc formats when present (requires Node + local Prettier).
- **ESLint:** `npx --no-install eslint .` on JS/TS files when present (requires Node + local ESLint).
- Basic hygiene hooks (merge conflicts, EOF, trailing whitespace).

Hooks that depend on external tools are **skipped with a message** if the tool is
not installed, so you can adopt them incrementally. For full CI parity also run:

```bash
# Solidity
forge build && forge test

# Stellar (from stellar/)
cd stellar && cargo clippy --all-targets -- -D warnings && cargo test && stellar contract build
```

Pre-commit is optional but recommended for contributors.
