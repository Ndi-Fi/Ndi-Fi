# Security Policy

## Reporting a vulnerability

**Do not report security vulnerabilities in public issues or pull requests.**

Report suspected vulnerabilities privately to the maintainers (repository owners/admins). Include enough detail to reproduce the issue, affected components, and potential impact. We will acknowledge receipt and work with you on remediation and coordinated disclosure.

## Supported scope

- Solidity contracts in `src/`, `script/`, and `test/`
- Stellar/Soroban contracts and tooling in `stellar/`
- CI/CD workflows and repository configuration

## Dependency and secret protection

This repository uses the following controls to reduce supply-chain and secret-leak risk:

- **GitHub secret scanning:** should be enabled for the repository to detect leaked credentials in code and history.
- **Push protection:** should be enabled to block pushes that contain supported secret patterns (enable in repository settings: *Settings → Code security and analysis*).
- **Dependency review on PRs:** the [`Dependency Review`](.github/workflows/dependency-review.yml) workflow runs on pull requests and **blocks merges on known critical advisories** (`fail-on-severity: critical`). It posts a summary comment in PRs for visibility.

Maintainers should keep secret scanning, push protection, and Dependabot alerts enabled, and review dependency-review findings before merging. Exceptions require explicit maintainer approval and documented risk acceptance in the PR.

## CI and deployment safeguards

- Solidity verification: [`verify-solidity.yml`](.github/workflows/verify-solidity.yml) runs on tagged releases or manual dispatch and uses `ETHERSCAN_API_KEY` from repository secrets (never hardcode keys).
- Stellar testnet deploys: [`deploy-stellar-testnet.yml`](.github/workflows/deploy-stellar-testnet.yml) is manual-dispatch only and requires approval via the `stellar-testnet` GitHub environment before running. Deployment scripts must not print or commit secret keys.
