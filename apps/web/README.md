# Ndi-Fi dApp (`apps/web`)

The Ndi-Fi dApp is the React/Next.js frontend for the Ndi-Fi lending and staking
protocol. It connects to on-chain contracts via wagmi and displays real-time
position data, health factors, and transaction flows.

---

## Prerequisites

| Tool | Minimum version |
|---|---|
| Node.js | 18 |
| pnpm | 8 (or npm ≥ 9 / yarn ≥ 1.22) |
| A wallet | MetaMask or any WalletConnect-compatible wallet |

---

## Install

```bash
# From the repo root
pnpm install

# Or inside this directory
cd apps/web
pnpm install
```

---

## Development

```bash
pnpm dev
```

The app starts at `http://localhost:3000`. Hot-reload is enabled by default.

---

## Build

```bash
pnpm build
```

Output is written to `.next/`. Preview the production bundle with:

```bash
pnpm start
```

---

## Tests

```bash
# Run all unit and component tests (Vitest)
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

End-to-end tests (Playwright) live in `e2e/` and require a local stack:

```bash
pnpm test:e2e
```

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values before starting the
dev server.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | Yes | Target chain ID (`1` = mainnet, `11155111` = Sepolia) |
| `NEXT_PUBLIC_VAULT_ADDRESS` | Yes | Deployed `NdiFiVault` contract address |
| `NEXT_PUBLIC_LENDING_ADDRESS` | Yes | Deployed `NdiFiLending` contract address |
| `NEXT_PUBLIC_STAKING_ADDRESS` | Yes | Deployed `NdiFiStaking` contract address |
| `NEXT_PUBLIC_NDI_TOKEN_ADDRESS` | Yes | Deployed `NdiPoint` (NDI token) contract address |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect Cloud project ID |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | No | Alchemy RPC key (falls back to public RPC) |

All `NEXT_PUBLIC_*` variables are embedded into the client bundle at build time.
Never store private keys or secrets in `NEXT_PUBLIC_*` variables.

---

## Project structure

```
apps/web/
├── app/                  # Next.js App Router pages and layouts
│   ├── layout.tsx        # Root layout (providers, fonts, metadata)
│   ├── page.tsx          # Landing / dashboard
│   ├── lend/             # Lending flows (deposit collateral, borrow, repay)
│   └── stake/            # Staking flows (stake, claim rewards, withdraw)
├── components/           # Shared UI components (see Conventions below)
│   ├── ui/               # Primitive design-system pieces (Button, Input, …)
│   └── protocol/         # Protocol-aware composites (HealthFactorBadge, …)
├── hooks/                # Custom React hooks (see Conventions below)
├── lib/                  # Non-React utilities (contract ABIs, formatters, …)
│   ├── abis/             # JSON ABIs auto-generated from Foundry output
│   └── wagmi.ts          # wagmi config and chain definitions
├── e2e/                  # Playwright end-to-end tests
├── public/               # Static assets
└── .env.example          # Template for required environment variables
```

---

## Conventions

### Hooks

- One hook per file, named `use<Concept>.ts` (e.g. `useVaultBalance.ts`).
- Hooks that read contract state use `useContractRead` / `useReadContract` from
  wagmi and return `{ data, isLoading, error }` so callers handle all states.
- Hooks that write to contracts use `useWriteContract` and expose a `write`
  function together with `isPending` and `isSuccess`.
- Do not fetch the same data in multiple places; lift shared reads into a
  context provider under `app/providers/`.

### Components

- Use the `components/ui/` primitives for every interactive element so styling
  is consistent.
- Protocol components in `components/protocol/` may import wagmi hooks directly
  but must not embed raw `fetch` calls.
- Prop types are defined with TypeScript interfaces in the same file as the
  component, exported as `<ComponentName>Props`.
- Every interactive component has an accessible name (`aria-label` or visible
  `<label>`).

### Tests

- Unit tests live next to the file they test: `useVaultBalance.test.ts` beside
  `useVaultBalance.ts`.
- Use `@testing-library/react` for component tests; avoid snapshot tests for
  protocol components whose output changes with chain state.
- Mock wagmi hooks with `vi.mock` at the top of the test file — do not connect
  to a live network in unit tests.
- End-to-end tests in `e2e/` use a local Anvil fork of Sepolia (see
  `e2e/setup.ts`).

---

## Design system

The app uses the Ndi-Fi shared design system (Storybook). To browse components:

```bash
pnpm storybook
```

The Storybook is also published to GitHub Pages on every merge to `main`.
See [`.github/workflows/`](../../.github/workflows/) for the publish workflow.

---

## Related docs

- [Protocol overview](../../README.md)
- [Interest rate model](../../docs/interest-rate-model.md)
- [Risk disclosures](../../docs/risk-disclosures.md)
- [Contributing guide](../../CONTRIBUTING.md)
- [Deployment scripts](../../script/)
