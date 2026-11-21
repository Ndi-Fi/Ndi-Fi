---
name: Wave task
about: A scoped task for the Stellar Wave Program (Drips Wave)
title: "[Wave] "
labels: ["wave", "stellar"]
assignees: []
---

> **Do not start work on this issue until a maintainer assigns it to you.**
> Comment below to express interest. Your PR must include `Closes #<this issue>`.

## Summary

<!-- One or two sentences: what needs to be done. -->

## Context

<!-- Why this matters and any background a new contributor needs. Link code and docs. -->

## Acceptance criteria

- [ ] 
- [ ] 
- [ ] 

## Files likely involved

<!-- e.g. stellar/contracts/ndi_staking/src/contract.rs -->

## Complexity

<!-- Pick one: Trivial / Medium / High -->

## How to test

```bash
cd stellar
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test
stellar contract build
```

<!-- Add any task-specific steps. -->

## Resources

- [docs/stellar/ARCHITECTURE.md](../../docs/stellar/ARCHITECTURE.md)
- [docs/stellar/MIGRATION.md](../../docs/stellar/MIGRATION.md)
- [CONTRIBUTING.md](../../CONTRIBUTING.md)
