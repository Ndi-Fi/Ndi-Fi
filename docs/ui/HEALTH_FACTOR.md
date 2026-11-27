# Health Factor / Liquidation Risk Visualization

> Closes #142

## Overview

The health factor indicator communicates a borrower's proximity to liquidation. Because liquidation is irreversible and results in direct financial loss, the indicator must be unambiguous at a glance, provide contextual numbers, and guide the user toward recovery actions before the threshold is crossed. Color alone is insufficient; every state must also be communicated through text, iconography, and shape.

---

## Health Factor Definition

Health factor (HF) is defined as:

```
HF = (Σ collateral_value_USD × liquidation_threshold%) / total_borrow_value_USD
```

- **HF > 2.0** — Safe
- **1.5 ≤ HF ≤ 2.0** — Moderate risk
- **1.1 ≤ HF < 1.5** — High risk
- **1.0 ≤ HF < 1.1** — Critical (liquidation imminent)
- **HF < 1.0** — Liquidatable (position can be liquidated now)

---

## Primary Visualization: Gauge

The main health factor display is a **semicircular gauge** (arc gauge). It is used on the borrowing modal, the loan detail panel, and as a mini variant on the portfolio dashboard loan card.

### Full Gauge (Loan Detail / Borrowing Modal)

```
           ╔══════════════╗
           ║   Healthy    ║
    ╔══╗   ║  2.45  HF   ║   ╔══╗
    ║  ╚═══╩══════════════╩═══╝  ║
    ║  ░░░░░░░░░░▓▓▓██████░░░░░  ║
    ╚═══════════════════════════╝
    Liquidation              Safe
     threshold
```

Dimensions: 240 × 130 px (full), 80 × 45 px (mini).

**Arc zones (left to right, low to high HF):**

| Zone | HF range | Color token | Pattern overlay |
|---|---|---|---|
| Danger | < 1.0 | `--color-danger` (red) | Diagonal hatching |
| Critical | 1.0–1.1 | `--color-danger` (red) | None |
| High risk | 1.1–1.5 | `--color-warning` (amber) | None |
| Moderate | 1.5–2.0 | `--color-caution` (yellow) | None |
| Safe | > 2.0 | `--color-success` (green) | None |

The arc spans 180°. The needle (pointer) rotates from the left (HF = 0) to right (HF = 3.0+, clamped at max). Values above 3.0 are displayed as "> 3.0" but the needle rests at the rightmost position.

The **current HF value** is displayed in large text (32 px, bold) at the center of the gauge below the arc, with the label "Health Factor" in small text (12 px, muted).

### Mini Gauge (Portfolio Dashboard Card)

The mini gauge omits the zone labels and needle. It uses only the arc fill to indicate the zone color. The HF number is displayed as a text label beside it, e.g., `HF 2.45`. For screen reader users, the full label is `aria-label="Health Factor: 2.45, Healthy"`.

---

## Liquidation Price Display

Below the gauge, display a table showing the liquidation price for each collateral asset:

```
┌──────────────────────────────────────────────┐
│  Liquidation prices                          │
│  ──────────────────────────────────────────  │
│  ETH    Current: $2,850    Liquidation: $1,900│
│  WBTC   Current: $67,000   Liquidation: $44,500│
└──────────────────────────────────────────────┘
```

- **Current price** is fetched from the price feed and refreshed every 30 seconds.
- **Liquidation price** is the asset price at which HF would reach 1.0 given the current borrow.
- If the current price is within **15%** of the liquidation price, the liquidation price cell is highlighted with `--color-warning` background and an ⚠ icon.
- If the current price is within **5%**, the cell switches to `--color-danger` background.

---

## Color-Coded Zones

Zones are communicated through three independent signals so that no user relies solely on color:

| Zone | Color | Icon | Text label |
|---|---|---|---|
| Safe | Green | ✓ Shield | "Healthy" |
| Moderate | Yellow | ⬟ Shield | "Moderate Risk" |
| High risk | Amber | ⚠ Shield | "High Risk" |
| Critical | Red | ⚠ Shield (animated pulse) | "Critical" |
| Liquidatable | Red | ✗ Shield | "At Risk of Liquidation" |

The shield icon fills progressively as risk increases — full fill at Liquidatable. This provides a shape-based cue independent of color.

---

## Warnings and Recommended Actions

When HF drops below a threshold, a contextual action panel appears below the gauge:

### HF < 1.5 — Warning Panel

```
┌────────────────────────────────────────────────────┐
│  ⚠  Your health factor is approaching the         │
│     liquidation threshold.                        │
│                                                    │
│  To reduce risk, you can:                         │
│  • Add collateral  [Add Collateral →]             │
│  • Repay part of your loan  [Repay →]             │
│                                                    │
│  Liquidation threshold: 1.0                       │
└────────────────────────────────────────────────────┘
```

### HF < 1.1 — Critical Panel

```
┌────────────────────────────────────────────────────┐
│  🔴  Your position is at risk of liquidation.     │
│      Act now to avoid losing collateral.          │
│                                                    │
│  Add collateral or repay immediately:             │
│  [Add Collateral]  [Repay Loan]                   │
│                                                    │
│  To bring HF to 1.5, repay at least $X or         │
│  add $Y of collateral.                            │
└────────────────────────────────────────────────────┘
```

The panel calculates and displays the **minimum repayment amount** (`$X`) or **minimum collateral addition** (`$Y`) needed to reach HF 1.5. These are real-time calculations shown in both USD and the native token.

### HF < 1.0 — Liquidatable Panel

```
┌────────────────────────────────────────────────────┐
│  ✗  This position can currently be liquidated.    │
│     A liquidator may seize your collateral.       │
│                                                    │
│  Repay your loan immediately:  [Repay Loan]       │
└────────────────────────────────────────────────────┘
```

---

## Borrowing Modal Integration

When a user adjusts the borrow amount in the borrowing modal, the gauge updates live (debounced, 300 ms) to preview the resulting HF. If the new amount would push HF below 1.1, the **Confirm Borrow** button is disabled and replaced with the message: "Borrowing this amount puts your position at critical risk. Reduce the amount to continue."

The user can still proceed if HF is between 1.1 and 1.5 but must check a confirmation checkbox: "I understand my position will be at moderate/high risk."

---

## Accessibility

- The gauge is an `<svg>` with `role="img"` and `aria-label="Health Factor gauge: [value], [zone label]"`. Screen readers receive a complete description without interpreting the visual.
- The gauge does **not** rely on color as the sole indicator of any zone. Each zone has a distinct text label, icon, and (for Danger) a pattern fill.
- The critical zone warning pulses on screen but the pulse animation is suppressed under `prefers-reduced-motion: reduce`. The alert still appears statically.
- Action buttons in warning panels are reachable by keyboard Tab order and are placed before the gauge in DOM order so they are encountered early by screen-reader navigation.
- Liquidation price table uses `<table>` with column headers (`<th scope="col">`) and meaningful `<caption>`.
- Color values meet WCAG AA contrast (4.5:1) against the panel background for all zone text labels.
