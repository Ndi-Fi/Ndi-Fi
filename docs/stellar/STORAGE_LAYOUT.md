# Storage Layout Compatibility Policy

All three Stellar/Soroban contracts (`NdiToken`, `NdiLending`, `NdiStaking`) implement OpenZeppelin `Upgradeable`. An upgrade replaces the WASM in place and keeps all storage. Any change to storage keys or value types that is not backward-compatible will corrupt existing data.

## CI check

The `.github/workflows/storage-layout.yml` workflow runs on every pull request that touches `stellar/contracts/**`. It:

1. Builds the contracts at the PR head and at the base commit.
2. Runs `stellar contract inspect` on each WASM to extract the storage layout.
3. Diffs base vs head and fails if any layout changed.

A failing check does not mean the change is forbidden. It means a migration plan is required (see below).

## Compatible changes (no migration needed)

- Adding a new storage key that did not exist before.
- Adding new functions that do not touch existing keys.
- Changing business logic without touching storage types.

## Incompatible changes (migration required)

- Removing or renaming an existing storage key.
- Changing the value type of an existing key.
- Reordering enum variants that are used as storage keys.

## Migration plan

For any incompatible change:

1. Bump `schema_version` using `stellar_contract_utils::upgradeable`.
2. Add a `migrate(env, old_version)` function gated on the schema version.
3. Document the migration in `docs/stellar/MIGRATION.md`.
4. Add an upgrade + migration test (see `WAVE_ISSUES.md` issue 14).

The CI check can be overridden by a maintainer when a migration plan is in place.
