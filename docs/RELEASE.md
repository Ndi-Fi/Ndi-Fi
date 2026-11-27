# Release process

This document defines how Ndi-Fi versions are numbered, how the changelog is maintained, and how a release is cut.

---

## Versioning

Ndi-Fi uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html): `MAJOR.MINOR.PATCH`.

| Change type | Version increment | Examples |
|---|---|---|
| Breaking: new required storage, removed function, changed ABI | MAJOR | Upgrading a contract that requires a migration step |
| New feature, backward-compatible | MINOR | New view function, new owner setter |
| Bug fix, documentation, CI change | PATCH | Test fix, corrected comment |

Pre-release labels use the form `1.0.0-alpha.1`, `1.0.0-rc.1`.

---

## Release cadence

- **Patch releases** are cut as needed, within days of a fix merging.
- **Minor releases** are cut when a coherent feature set is ready, typically every 4–6 weeks.
- **Major releases** are planned with the team and announced in advance on the project Discord.

---

## Changelog maintenance

The changelog lives in `CHANGELOG.md` at the repo root and follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

**Rules:**
- Every merged PR that changes behaviour, adds a feature, or fixes a bug must have a corresponding entry under `[Unreleased]`.
- Entries are categorised as `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security`.
- Reference the closed issue or PR number in each entry where relevant (e.g., `— closes #42`).
- Do not add entries for whitespace-only or formatting-only commits.

---

## Cutting a release

### 1. Prepare

```bash
git checkout main
git pull upstream main
```

Ensure CI is green on `main`.

### 2. Update the changelog

Move entries from `[Unreleased]` to a new versioned section:

```markdown
## [1.1.0] — YYYY-MM-DD

### Added
- ...

### Fixed
- ...
```

Add a new empty `[Unreleased]` section at the top.

### 3. Bump version references

Update any hardcoded version strings in `stellar/Cargo.toml` workspace manifests if the contracts have a `version` field.

### 4. Commit and tag

```bash
git add CHANGELOG.md stellar/Cargo.toml   # and any other changed files
git commit -m "chore: release v1.1.0"
git tag -a v1.1.0 -m "Release v1.1.0"
git push upstream main --tags
```

### 5. Create the GitHub release

```bash
gh release create v1.1.0 \
  --title "v1.1.0" \
  --notes-from-tag \
  --verify-tag
```

Or use the GitHub web UI: go to **Releases → Draft a new release**, select the tag, paste the changelog section as the body.

### 6. Attach WASM artifacts (Stellar releases)

Build the contracts and attach them to the release:

```bash
cd stellar
stellar contract build
gh release upload v1.1.0 \
  target/wasm32v1-none/release/ndi_token.wasm \
  target/wasm32v1-none/release/ndi_lending.wasm \
  target/wasm32v1-none/release/ndi_staking.wasm
```

### 7. Update deployment guides

If the release includes contract changes, update or create the deployment guide for this version. Link it from the GitHub release notes.

---

## CI release-notes automation

The `stellar.yml` and `test.yml` workflows do not automatically create releases. Release creation is a manual step to ensure the changelog is reviewed before publishing. Future automation (e.g., a `release.yml` workflow triggered by a `v*` tag push) can be added when the team is ready. When it lands, document it in `docs/CICD.md`.

---

## Deployment guides per release

Each release that changes deployed contracts should link to a deployment guide. Store guides at `docs/deployments/v<VERSION>.md`. The guide must include:

- Which contracts changed and what the WASM hash is
- Whether a migration step is required (storage schema version bump)
- The upgrade invocation (see `docs/RUNBOOK.md` for the upgrade procedure)
- Testnet and mainnet transaction IDs after deployment
