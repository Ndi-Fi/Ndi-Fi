# 04 — Wallet connection states & flows

Closes #140 · Connection states, network switch prompts, unsupported-chain
messaging, account menu and mobile wallet patterns.

> See [README.md](README.md) for tokens and shared components. Every other
> screen depends on this one: until a wallet is connected and on a supported
> network, action buttons route here.

## Two connection models

| | Ethereum | Stellar |
|---|---|---|
| Provider | EIP-1193 injected (`window.ethereum`) — MetaMask, Rabby, etc. | Wallet-specific APIs — Freighter (extension), xBull (extension), Albedo (popup signer), Lobstr |
| Chain switch | EIP-3326 `wallet_switchEthereumChain`, EIP-3085 `wallet_addEthereumChain` if missing | re-select network in the wallet; no EIP-3326 equivalent |
| Account | EIP-1193 `eth_accounts` / `accountsChanged` | wallet pubkey; reconnect per session for popup signers |
| Events | `chainChanged`, `accountsChanged` | poll / wallet event where available |

The flow is the same shape; the differences are the wallets listed and how
"switch network" works.

## Entry points

- **Nav `[Connect wallet ▾]`** — primary entry; opens the connect sheet.
  Becomes `[0x1234…abcd ▾]` once connected (opens the account menu).
- **Action-gated connect** — every action button (#137/#138) is disabled with
  "Connect a wallet first" until connected; tapping it opens the connect sheet
  (same sheet) rather than the action screen.
- **Cross-chain toggle** — a `<ChainBadge>` in the nav that, when clicked,
  opens the network sheet (see §Network switch) to move between Ethereum and
  Stellar.

## Connect sheet — wallet picker

```
DESKTOP (modal)                         MOBILE (bottom sheet, full-width)
┌──────────────────────────────┐        ┌──────────────────────────┐
│ Connect a wallet              │        │ Connect a wallet          │
│ Choose how to sign.           │        │                           │
│                              │        │ Ethereum                  │
│ Ethereum                     │        │  ┌──────────────────────┐ │
│  ○ MetaMask        ●installed│        │  │ MetaMask      Install │ │
│  ○ Rabby           ●installed│        │  │ Rabby        Installed│ │
│  ○ Browser wallet   ▸ WalletConnect│   │  │ WalletConnect        │ │
│                              │        │  └──────────────────────┘ │
│ Stellar                      │        │ Stellar                   │
│  ○ Freighter       ●installed│        │  ┌──────────────────────┐ │
│  ○ xBull           not found │        │  │ Freighter    Installed│ │
│  ○ Albedo          popup     │        │  │ xBull       Not found │ │
│  ○ Lobstr                     │        │  │ Albedo  Popup signer  │ │
│                              │        │  └──────────────────────┘ │
│ By connecting you agree to … │        │ By connecting you agree … │
└──────────────────────────────┘        └──────────────────────────┘
```

- Each row shows a status dot: `●installed` (green), `not found` (grey), or
  `popup` (signer service, no install) for Albedo.
- Selecting a not-installed wallet opens the **not-installed** state (below).
- Selecting an installed/injected wallet goes to the **connecting** state.
- The "By connecting you agree…" line links the risk disclosure (matches
  `SECURITY.md` tone); connection never spends gas or moves funds.

## Connection state map

```
            ┌───────────────┐
   open ──▶ │  idle/listing  │  ◀── dismissed / back
            └───────┬───────┘
                    │ pick wallet
            ┌───────┴────────┐
            ▼                ▼
     ┌────────────┐   ┌─────────────┐
     │ not-       │   │ connecting  │
     │ installed  │   │ (wallet      │
     └────────────┘   │  prompt open)│
                      └──────┬──────┘
                  ┌──────────┼─────────────┐
                  ▼          ▼             ▼
            ┌──────────┐ ┌──────────┐ ┌─────────────┐
            │ connected│ │ wrong    │ │  error       │
            │ (right   │ │ network  │ │ (rejected/   │
            │  chain)  │ │          │ │  rpc/fail)   │
            └──────────┘ └────┬─────┘ └─────────────┘
                              │ switch/add
                              ▼
                        ┌──────────┐
                        │ connected│
                        └──────────┘
```

### Per-state screens

**`not-installed`**

```
┌──────────────────────────────┐
│  MetaMask isn't installed     │
│  Install MetaMask to connect  │
│  on Ethereum.                 │
│  [ Install MetaMask ↗ ]       │   ← opens the wallet's official site
│  [ Use WalletConnect instead ] │   ← fallback to a connection that works
│            [ Back ]            │
└──────────────────────────────┘
```

For Albedo and other popup signers there is no "install"; the row shows
"popup signer" and selecting it goes straight to connecting.

**`connecting`**

```
┌──────────────────────────────┐
│  Connecting to MetaMask…      │
│  Confirm the request in your  │
│  wallet.                      │
│  [ spinner ]                  │
│  [ Cancel ]                   │
└──────────────────────────────┘
```

The sheet stays in this state until the wallet responds. A visible spinner plus
the instruction text — never a silent wait.

**`connected` (right chain)**

Nav button becomes `[0x1234…abcd ▾]` with a green status dot and the
`<ChainBadge>` (`ETH · Mainnet` / `XLM · Public`). The connect sheet closes;
the user lands on their last screen (Lending/Staking hub).

**`wrong-network`**

```
┌──────────────────────────────┐
│  ⚠ Wrong network              │
│  You're on Ethereum Goerli.   │
│  Ndi-Fi uses Mainnet.         │
│  [ Switch to Mainnet ]        │
│  [ Keep this network  ⓘ ]     │   ← expands: read-only, actions disabled
└──────────────────────────────┘
```

See §Network switch for the switch/add flow. While wrong-network, every action
screen (#137/#138) shows this banner and disables confirm.

**`error`**

```
┌──────────────────────────────┐
│  Couldn't connect             │
│  MetaMask rejected the        │
│  connection request.         │
│  [ Try again ]   [ Back ]     │
└──────────────────────────────┘
```

Plain-English cause + a retry. For RPC/connection failures, the message names
the network ("Couldn't reach Stellar testnet RPC.").

### State table

| State | Trigger | Nav button | Action screens |
|---|---|---|---|
| `not-installed` | wallet not detected on pick | `[Connect wallet ▾]` | route to connect |
| `connecting` | wallet prompt open | spinner + truncated (if known) | disabled, "connecting…" |
| `connected` | account + right chain | `[0x1234…abcd ▾]` + `ChainBadge` | enabled |
| `wrong-network` | account ok, unsupported chain | `⚠ Wrong network` | banner + disabled confirm |
| `error` | request rejected / rpc fail | `[Connect wallet ▾]` | route to connect |
| `disconnected` | user disconnects / menu | `[Connect wallet ▾]` | route to connect |

## Network switch prompts

### Ethereum (EIP-3326 / EIP-3085)

When the user is on an unsupported Ethereum chain, `[ Switch to Mainnet ]`
calls `wallet_switchEthereumChain({ chainId })`. If the wallet returns error
`4902` (chain not added), follow with `wallet_addEthereumChain` (EIP-3085) with
the chain's params, then switch again.

```
  [ Switch to Mainnet ]
        │ wallet_switchEthereumChain
        ▼
   ┌───────────┐  ok   ┌───────────┐
   │ switching  │──────▶│ connected │
   └─────┬─────┘       └───────────┘
         │ error 4902 (not added)
         ▼
   wallet_addEthereumChain  →  switch  →  connected
```

Unsupported-but-known chains (e.g. a testnet the app reads but doesn't act on):
offer "Keep this network" which puts the app in **read-only** mode — balances
and stats load, but every write action is disabled with "Switch to Mainnet to
{action}."

### Unsupported-chain messaging

For chains Ndi-Fi will never support on this wallet type:

```
┌──────────────────────────────┐
│  ⚠ This network isn't supported│
│  Ndi-Fi runs on Ethereum      │
│  Mainnet and Stellar Public.  │
│  [ Switch to a supported net ]│
└──────────────────────────────┘
```

Never silently drop the user into read-only for an unsupported chain without a
message. The list of supported chains is a single source of truth shared by
the nav badge and these prompts.

### Stellar

Stellar wallets select their network in-wallet (Public / Testnet / Futurenet).
The app can't force a switch via EIP-3326; instead:

- On `wrong-network` show the supported network (Public for prod, Testnet for
  staging) and instruct the user to change it in their wallet, with a deep link
  where the wallet supports one.
- Re-check on reconnect; the Stellar RPC the app talks to must match the
  wallet's network, or reads/writes silently mismatch. Validate by comparing a
  known contract's presence on the RPC the wallet reports.

## Account menu

Opened from `[0x1234…abcd ▾]`.

```
┌──────────────────────────────┐
│  ● 0x1234…abcd                │   ← full address on hover/focus; status dot
│      Mainnet  ·  12.34 ETH    │
│  ─────────────────────────────│
│  ⧉  Copy address              │
│  ↗  View on Etherscan         │
│  ⇄  Switch network…           │   → network sheet
│  ⤶  Switch account…           │   → wallet account switcher (EIP-1193)
│  ─────────────────────────────│
│  ⏏  Disconnect                │   (red text)
└──────────────────────────────┘
```

- **Copy address** copies the full address to clipboard; toast "Address
  copied". The truncated label is also click-to-copy.
- **View on explorer** opens the address page (Etherscan / Stellar Expert)
  for the active chain.
- **Switch network** opens the network sheet (same as the wrong-network path).
- **Switch account** calls the wallet's account switcher where supported;
  `accountsChanged` updates the UI live.
- **Disconnect** clears the connection (and for popup Stellar signers, ends
  the session), returning the nav to `[Connect wallet ▾]`. Disconnect never
  revokes the wallet's in-app permission (that's the user's to do in their
  wallet) — state this in the disconnect confirm.
- A small balance line (`12.34 ETH` / `1,234.567 XLM`) keeps the menu useful.

## Mobile wallet connection patterns

Mobile is where most new users connect, and where the model diverges most from
desktop.

- **No injected extension on mobile browsers.** Default to **WalletConnect
  (v2)** for Ethereum and **deep links / wallet protocol** for Stellar. The
  connect sheet's "Browser wallet" row becomes the primary path on mobile.
- **In-app browser wallets** (MetaMask in-app, Coinbase Wallet browser) are
  detected and surfaced first; selecting them deep-links back into the app
  after signing.
- **QR + deep link sheet:**

```
  Ethereum · WalletConnect         Stellar · Freighter / Albedo
  ┌────────────────────┐          ┌────────────────────┐
  │   ▓▓▓▓▓▓▓▓         │          │  Open in Freighter ↗ │  ← deep link
  │   ▓ QR  ▓          │          │  Open in Albedo   ↗ │
  │   ▓▓▓▓▓▓▓▓         │          │  or scan to pair    │
  │   ▓▓▓▓▓▓▓▓         │          │   ▓▓▓▓▓▓▓▓          │
  │                    │          │   ▓▓▓▓▓▓▓▓          │
  │  Scan in your      │          │                    │
  │  wallet app        │          │                    │
  └────────────────────┘          └────────────────────┘
```

- **Cross-app return:** after the user approves in their wallet app, the
  browser tab must return to the same screen (preserve route + form state).
  Don't drop them on the landing page.
- **Persistence:** offer "remember this wallet" so reconnect isn't required
  every visit, but never auto-reconnect a wallet that has since been
  uninstalled — detect first, then connect.
- **Security:** on mobile, never request a spending approval at connection
  time; connection is view-only. Any approval happens later, in an explicit
  action sheet (#137/#138).

## Cross-chain toggle

`<ChainBadge>` in the nav opens the network sheet listing the supported
chains. Selecting the other chain:

1. Disconnects/parks the current wallet session (Ethereum) or switches RPC
   (Stellar).
2. Re-runs wallet detection for the new chain.
3. Lands on the equivalent screen for that chain (Lending/Staking hub).

Because Ethereum and Stellar use entirely different wallets, switching chains
almost always means switching wallets — the connect sheet re-appears if no
wallet for the target chain is connected. State this in the toggle: "Switching
to Stellar — connect a Stellar wallet."

## Handoff notes for engineers

Detection + connection (single source of truth):

- **Ethereum:** detect `window.ethereum`; support multiple injected providers
  (MetaMask, Rabby) by reading `window.ethereum.providers` when present. Use
  EIP-1193 `eth_requestAccounts`, listen for `chainChanged` and
  `accountsChanged`. Switch via EIP-3326, add via EIP-3085.
- **Stellar:** per-wallet integration — Freighter/`@stellar/freighter-api`,
  xBull extension, Albedo via its SDK, Lobstr. No universal injected
  provider; keep a registry of connectors and their `isAvailable()` checks.
- **WalletConnect (v2):** one project id, paired session per chain.

Supported chains table (shared by nav + prompts):

| Chain | Network | Chain id / network id | RPC | Explorer |
|---|---|---|---|---|
| Ethereum | Mainnet (prod) / Sepolia (staging) | `0x1` / `0xaa36a7` | mainnet/staging RPC | Etherscan |
| Stellar | Public (prod) / Testnet (staging) | Public / Testnet | Soroban RPC | Stellar Expert |

Error mapping:

| Condition | Display |
|---|---|
| No injected provider (ETH) | not-installed sheet → install / WalletConnect. |
| `4001` (user rejected) | "Connection request rejected." + retry. |
| `-32002` (already pending) | "A request is already pending in your wallet." |
| `4902` (chain not added) | auto-add then switch. |
| Stellar wallet not installed | not-installed sheet (per wallet). |
| Stellar network mismatch | "Your wallet is on Testnet; Ndi-Fi uses Public." + reconnect. |
| RPC unreachable | "Couldn't reach the {chain} RPC." + retry. |

Persistence: store the last wallet id + chain in `localStorage`; on load,
detect-then-reconnect, and fall back to the connect sheet if the wallet is
gone. Never auto-connect a missing wallet.

Accessibility: the address truncation has a real button to copy (focusable, key
operable); status (connected/wrong-network) is announced via `aria-live`; the
connect sheet traps focus and restores it on close; "not installed" vs
"connected" differ by text + icon, not color alone.

## Acceptance criteria — #140

- [x] States: not installed, connecting, connected, wrong network, error — §Connection state map + per-state screens + state table.
- [x] Network switch prompts and unsupported chain messaging — §Network switch (EIP-3326/3085 for ETH, Stellar network guidance) + §Unsupported-chain messaging + read-only mode.
- [x] Account menu with disconnect and copy address — §Account menu (copy address, view on explorer, switch network/account, disconnect with messaging).
- [x] Mobile wallet connection patterns — §Mobile wallet connection patterns (WalletConnect, deep links, in-app browsers, QR sheet, cross-app return, persistence, security).
