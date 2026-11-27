/**
 * Column designs and mock data for the two Ndi-Fi tables called out in the UI
 * design issue: open positions and account history.
 *
 * These presets are intentionally data-only. Pages can pass their own rows via
 * `setRows()` or a `data-table-config` JSON script without changing the table
 * implementation.
 */

const POSITIONS_COLUMNS = Object.freeze([
  Object.freeze({ key: 'asset', label: 'Asset', filterable: true }),
  Object.freeze({ key: 'type', label: 'Type', filterable: true }),
  Object.freeze({ key: 'supplied', label: 'Supplied', format: 'currency', currency: 'USDC', align: 'end' }),
  Object.freeze({ key: 'value', label: 'Position value', format: 'currency', currency: 'USDC', align: 'end' }),
  Object.freeze({ key: 'apy', label: 'APY', format: 'percent', align: 'end' }),
  Object.freeze({ key: 'health', label: 'Health factor', format: 'number', digits: 2, align: 'end' }),
  Object.freeze({ key: 'status', label: 'Status', format: 'status', filterable: true }),
]);

const POSITIONS_ROWS = Object.freeze([
  { id: 'pos-001', asset: 'NDI / USDC', type: 'Liquidity', supplied: 12500, value: 13240.5, apy: 12.84, health: 2.41, status: 'Healthy' },
  { id: 'pos-002', asset: 'NDI', type: 'Staking', supplied: 8400, value: 9142.8, apy: 9.6, health: 3.12, status: 'Healthy' },
  { id: 'pos-003', asset: 'USDC', type: 'Lending', supplied: 21000, value: 21180.25, apy: 6.2, health: 1.84, status: 'Healthy' },
  { id: 'pos-004', asset: 'XLM', type: 'Lending', supplied: 5600, value: 5388.9, apy: 4.75, health: 1.21, status: 'At risk' },
  { id: 'pos-005', asset: 'NDI / XLM', type: 'Liquidity', supplied: 3200, value: 3476.4, apy: 15.32, health: 2.08, status: 'Healthy' },
  { id: 'pos-006', asset: 'USDC', type: 'Staking', supplied: 4750, value: 4901.15, apy: 7.1, health: 2.76, status: 'Healthy' },
  { id: 'pos-007', asset: 'NDI', type: 'Lending', supplied: 11800, value: 11210.6, apy: 5.45, health: 1.37, status: 'At risk' },
  { id: 'pos-008', asset: 'XLM / USDC', type: 'Liquidity', supplied: 9100, value: 9632.75, apy: 11.08, health: 1.96, status: 'Healthy' },
  { id: 'pos-009', asset: 'NDI', type: 'Staking', supplied: 2250, value: 2401.9, apy: 8.9, health: 4.02, status: 'Healthy' },
  { id: 'pos-010', asset: 'USDC', type: 'Lending', supplied: 15200, value: 15338.4, apy: 6.85, health: 1.68, status: 'Healthy' },
  { id: 'pos-011', asset: 'XLM', type: 'Staking', supplied: 7300, value: 7184.2, apy: 5.9, health: 2.22, status: 'Healthy' },
  { id: 'pos-012', asset: 'NDI / USDC', type: 'Liquidity', supplied: 6400, value: 6895.65, apy: 13.47, health: 1.49, status: 'Pending' },
]);

const HISTORY_COLUMNS = Object.freeze([
  Object.freeze({ key: 'activity', label: 'Activity', filterable: true }),
  Object.freeze({ key: 'asset', label: 'Asset', filterable: true }),
  Object.freeze({ key: 'type', label: 'Type', filterable: true }),
  Object.freeze({ key: 'amount', label: 'Amount', format: 'currency', currency: 'USDC', align: 'end' }),
  Object.freeze({ key: 'date', label: 'Date', format: 'date' }),
  Object.freeze({ key: 'status', label: 'Status', format: 'status', filterable: true }),
  Object.freeze({ key: 'tx', label: 'Transaction', format: 'mono', searchable: false }),
]);

const HISTORY_ROWS = Object.freeze([
  { id: 'tx-001', activity: 'Supplied collateral', asset: 'USDC', type: 'Deposit', amount: 2500, date: '2026-11-24T09:42:00Z', status: 'Completed', tx: 'a1b2…9f31' },
  { id: 'tx-002', activity: 'Claimed rewards', asset: 'NDI', type: 'Reward', amount: 184.25, date: '2026-11-23T18:05:00Z', status: 'Completed', tx: 'c7d8…41aa' },
  { id: 'tx-003', activity: 'Borrowed', asset: 'XLM', type: 'Borrow', amount: 1200, date: '2026-11-22T11:27:00Z', status: 'Completed', tx: 'e3f4…b802' },
  { id: 'tx-004', activity: 'Added liquidity', asset: 'NDI / USDC', type: 'Deposit', amount: 8400, date: '2026-11-21T15:51:00Z', status: 'Completed', tx: '95a6…7cd4' },
  { id: 'tx-005', activity: 'Withdrew', asset: 'USDC', type: 'Withdrawal', amount: 960, date: '2026-11-20T08:14:00Z', status: 'Pending', tx: 'b1c2…30de' },
  { id: 'tx-006', activity: 'Staked', asset: 'NDI', type: 'Stake', amount: 3200, date: '2026-11-19T20:36:00Z', status: 'Completed', tx: 'd4e5…88f1' },
  { id: 'tx-007', activity: 'Repaid debt', asset: 'XLM', type: 'Repay', amount: 640, date: '2026-11-18T13:09:00Z', status: 'Completed', tx: 'f6a7…12b9' },
  { id: 'tx-008', activity: 'Removed liquidity', asset: 'XLM / USDC', type: 'Withdrawal', amount: 2150, date: '2026-11-17T16:48:00Z', status: 'Completed', tx: '08b9…5e42' },
  { id: 'tx-009', activity: 'Claimed rewards', asset: 'NDI', type: 'Reward', amount: 92.7, date: '2026-11-16T10:22:00Z', status: 'Failed', tx: '3c4d…6a17' },
  { id: 'tx-010', activity: 'Supplied collateral', asset: 'XLM', type: 'Deposit', amount: 4100, date: '2026-11-15T07:55:00Z', status: 'Completed', tx: '7e8f…0b35' },
  { id: 'tx-011', activity: 'Unstaked', asset: 'NDI', type: 'Unstake', amount: 1250, date: '2026-11-14T19:03:00Z', status: 'Completed', tx: 'a9b0…cc28' },
  { id: 'tx-012', activity: 'Borrowed', asset: 'USDC', type: 'Borrow', amount: 1800, date: '2026-11-13T12:41:00Z', status: 'Completed', tx: 'c1d2…94ef' },
  { id: 'tx-013', activity: 'Added liquidity', asset: 'NDI / XLM', type: 'Deposit', amount: 5600, date: '2026-11-12T14:18:00Z', status: 'Completed', tx: 'e5f6…70a1' },
  { id: 'tx-014', activity: 'Withdrew', asset: 'XLM', type: 'Withdrawal', amount: 375, date: '2026-11-11T09:37:00Z', status: 'Pending', tx: '97a8…fb63' },
  { id: 'tx-015', activity: 'Repaid debt', asset: 'USDC', type: 'Repay', amount: 2200, date: '2026-11-10T17:12:00Z', status: 'Completed', tx: 'b2c3…18d9' },
  { id: 'tx-016', activity: 'Claimed rewards', asset: 'XLM', type: 'Reward', amount: 46.8, date: '2026-11-09T11:29:00Z', status: 'Completed', tx: 'd6e7…af04' },
  { id: 'tx-017', activity: 'Staked', asset: 'USDC', type: 'Stake', amount: 1500, date: '2026-11-08T22:06:00Z', status: 'Completed', tx: 'f8a9…53bc' },
  { id: 'tx-018', activity: 'Removed liquidity', asset: 'NDI / USDC', type: 'Withdrawal', amount: 4300, date: '2026-11-07T08:44:00Z', status: 'Failed', tx: '0b1c…e971' },
]);

export const TABLE_PRESETS = Object.freeze({
  positions: Object.freeze({
    label: 'Open positions',
    description: 'Lending, staking and liquidity positions with live health factors.',
    emptyMessage: 'No open positions yet.',
    pageSize: 5,
    columns: POSITIONS_COLUMNS,
    rows: POSITIONS_ROWS,
  }),
  history: Object.freeze({
    label: 'Activity history',
    description: 'Deposits, withdrawals, rewards and borrows across your account.',
    emptyMessage: 'No activity to show yet.',
    pageSize: 5,
    columns: HISTORY_COLUMNS,
    rows: HISTORY_ROWS,
  }),
});

/** Resolve a preset by name, falling back to positions for unknown values. */
export function getTablePreset(name) {
  return Object.hasOwn(TABLE_PRESETS, name) ? TABLE_PRESETS[name] : TABLE_PRESETS.positions;
}
