# Development guide

This guide covers local tooling for contributors. For workflow, branches, and PR
rules see [CONTRIBUTING.md](CONTRIBUTING.md).

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
