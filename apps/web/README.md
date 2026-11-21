# Ndi-Fi Frontend (apps/web)

The Ndi-Fi dApp is a Next.js application that provides a web interface for interacting with the Ndi-Fi lending and staking protocol.

---

## Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 8 (or npm ≥ 9 / yarn ≥ 1.22)
- A wallet (MetaMask or any WalletConnect-compatible wallet)

---

## Installation

```bash
# From the repo root
pnpm install

# Or from this directory
cd apps/web
pnpm install
```

---

## Development

```bash
pnpm dev
```

The app starts at `http://localhost:3000`.

---

## Build

```bash
pnpm build
```

Output is written to `.next/`. Preview the production build with:

```bash
pnpm start
```

---

## Tests

```bash
# Unit and integration tests (Vitest)
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

End-to-end tests use Playwright:

```bash
pnpm test:e2e
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values before running the app.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | ✅ | Target chain ID (e.g. `1` for Mainnet, `11155111` for Sepolia) |
| `NEXT_PUBLIC_RPC_URL` | ✅ | JSON-RPC endpoint for the target chain |
| `NEXT_PUBLIC_LENDING_CONTRACT` | ✅ | Deployed `NdiFiLending` contract address |
| `NEXT_PUBLIC_STAKING_CONTRACT` | ✅ | Deployed `NdiFiStaking` contract address |
| `NEXT_PUBLIC_VAULT_CONTRACT` | ✅ | Deployed `NdiFiVault` contract address |
| `NEXT_PUBLIC_NDI_TOKEN_CONTRACT` | ✅ | Deployed `NdiPoint` token address |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | ✅ | WalletConnect Cloud project ID |
| `NEXT_PUBLIC_ANALYTICS_ID` | ❌ | Optional analytics identifier |

> **Never commit `.env.local`.** It is listed in `.gitignore`.

---

## Contract Configuration

ABI files and contract addresses are co-located in `src/config/contracts/`:

```
src/config/contracts/
├── addresses.ts          # Per-chain contract addresses
├── abis/
│   ├── NdiFiLending.json
│   ├── NdiFiStaking.json
│   ├── NdiFiVault.json
│   └── NdiPoint.json
└── index.ts              # Re-exports addresses + ABIs
```

To add a new network, append its chain ID and addresses to `addresses.ts`. The ABI files are generated from the Foundry build artifacts in `out/` — run `forge build` and copy the relevant `abi` fields.

---

## Conventions

### Hooks

Custom React hooks live in `src/hooks/`. Each hook file exports a single hook named after the file.

- **Contract hooks** (`useNdiFiLending`, `useNdiFiStaking`, etc.) wrap wagmi `useReadContract` / `useWriteContract` calls and handle loading and error states internally.
- **UI hooks** (`useModal`, `useToast`, etc.) manage local UI state and are kept free of contract logic.
- Hooks that fetch data must expose `{ data, isLoading, error }` so components can render consistently.

### Components

Components live in `src/components/`. Shared primitives (Button, Input, Modal) are in `src/components/ui/`. Feature-specific components are grouped by domain: `src/components/lending/`, `src/components/staking/`.

- One component per file. Filename matches the exported component name.
- Props are typed with a `<ComponentName>Props` interface in the same file.
- Avoid business logic in components; delegate to hooks.

### Tests

- Unit tests for hooks and utilities sit alongside the source file as `*.test.ts`.
- Component tests use React Testing Library and sit alongside the component as `*.test.tsx`.
- E2E tests live in `e2e/` and use Playwright.
- Mock contract calls with `vitest-mock-extended` or `msw` — do not make real RPC calls in unit tests.

---

## Design System

The UI is built on [shadcn/ui](https://ui.shadcn.com/) with Tailwind CSS. Refer to the design system docs at `docs/design-system.md` for the color palette, typography scale, and component usage guidelines.

---

## Related Docs

- [Main README](../../README.md)
- [NdiFi Staking contract](../../NdiFiStaking_README.md)
- [NdiFi Lending contract](../../TechnicalAnalysis.md)
- [Contributing guide](../../CONTRIBUTING.md)
