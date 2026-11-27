# Security Policy

## Reporting a Vulnerability

**Do not report security vulnerabilities in public issues or pull requests.**

Report suspected vulnerabilities privately using one of these paths:

- **GitHub private vulnerability reporting:** Use the [Security tab → Report a vulnerability](https://github.com/Ndi-Fi/Ndi-Fi/security/advisories/new) form in this repository. This keeps the report confidential and routes it directly to the maintainers.
- **Email:** Send a report to the repository maintainers. Contact details are listed in the GitHub organisation profile.

Include:
- A clear description of the vulnerability and its potential impact.
- Steps to reproduce or a proof-of-concept (can be shared privately as a draft advisory attachment).
- The affected component(s) and version/commit.

We will acknowledge receipt within **2 business days** and aim to provide an initial assessment within **5 business days**.

## Response SLAs

| Severity | Initial response | Fix target | Public disclosure |
|---|---|---|---|
| Critical | 2 business days | 7 days | After fix ships or 90 days, whichever is sooner |
| High | 2 business days | 14 days | After fix ships or 90 days, whichever is sooner |
| Medium / Low | 5 business days | Next release cycle | After fix ships |

We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure): we work with the reporter before making anything public, and we credit reporters in the release notes unless they prefer to remain anonymous.

## Scope

The following are **in scope**:

- Solidity contracts in `src/`, `script/`, and `test/`.
- Stellar/Soroban contracts and tooling in `stellar/`.
- CI/CD workflows and GitHub Actions configuration.
- Deployment scripts and configuration files.

The following are **out of scope**:

- Third-party dependencies (report these upstream and notify us).
- Front-end UI bugs that have no on-chain impact.
- Issues in forked or archived repositories.

## Supported Versions

Security fixes target the latest commit on `main`. Older tags are not backported unless a critical vulnerability warrants it.

## Dependency and Secret Protection

This repository uses the following controls:

- **GitHub secret scanning:** enabled for the repository to detect leaked credentials in code and history.
- **Push protection:** enabled to block pushes that contain supported secret patterns (Settings → Code security and analysis).
- **Dependency review on PRs:** the [`Dependency Review`](.github/workflows/dependency-review.yml) workflow runs on pull requests and blocks merges on known critical advisories (`fail-on-severity: critical`).

Maintainers keep secret scanning, push protection, and Dependabot alerts enabled, and review dependency-review findings before merging.

## CI and Deployment Safeguards

- **Solidity verification:** [`verify-solidity.yml`](.github/workflows/verify-solidity.yml) runs on tagged releases or manual dispatch and reads `ETHERSCAN_API_KEY` from repository secrets. Keys must never be hardcoded.
- **Stellar testnet deploys:** [`deploy-stellar-testnet.yml`](.github/workflows/deploy-stellar-testnet.yml) is manual-dispatch only and requires approval via the `stellar-testnet` GitHub environment before running. Deployment scripts must not print or commit secret keys.

## PGP Contact

We do not currently publish a PGP key. Use the GitHub private advisory form as the primary channel; it provides end-to-end confidentiality within GitHub. If you require encrypted email contact, open a draft advisory and request a PGP key from the maintainers there.

---

*This policy is linked from the [README](README.md) and from the repository's Security tab.*
