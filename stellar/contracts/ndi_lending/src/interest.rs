//! Fixed-rate interest model.
//!
//! Rates are annual and scaled by `RATE_SCALE` (1e7), so `RATE_SCALE` means
//! 100% APR and `500_000` means 5% APR. Interest is simple (not compounded
//! inside one accrual period); the lending contract capitalises it into the
//! debt every time the debt is touched. All math is integer and checked.

/// Fixed-point scale for rates: 1e7 = 100%.
pub const RATE_SCALE: i128 = 10_000_000;
/// Highest rate the contract accepts: 100% APR.
pub const MAX_RATE: i128 = RATE_SCALE;
/// 365 days, matching `SECONDS_PER_YEAR` in `NdiFiLending.sol`.
pub const SECONDS_PER_YEAR: u64 = 365 * 24 * 60 * 60;

/// Returns `true` if `rate` is between 0 and `MAX_RATE` inclusive.
pub fn is_valid_rate(rate: i128) -> bool {
    (0..=MAX_RATE).contains(&rate)
}

/// Interest owed on `principal` at `annual_rate` over `elapsed` seconds,
/// rounded up so the protocol never under-charges.
///
/// Computes `principal * annual_rate * elapsed / (RATE_SCALE * SECONDS_PER_YEAR)`
/// by splitting `principal` into quotient and remainder of the denominator, so
/// large principals do not overflow `i128`. Returns `None` on overflow or on
/// negative inputs.
pub fn accrued_interest(principal: i128, annual_rate: i128, elapsed: u64) -> Option<i128> {
    if principal < 0 || !is_valid_rate(annual_rate) {
        return None;
    }
    if principal == 0 || annual_rate == 0 || elapsed == 0 {
        return Some(0);
    }
    let denominator = RATE_SCALE.checked_mul(i128::from(SECONDS_PER_YEAR))?;
    let rate_time = annual_rate.checked_mul(i128::from(elapsed))?;

    let quotient = principal / denominator;
    let remainder = principal % denominator;

    let whole = quotient.checked_mul(rate_time)?;
    let part_numerator = remainder.checked_mul(rate_time)?;
    let part = part_numerator / denominator;
    let round_up = i128::from(part_numerator % denominator != 0);

    whole.checked_add(part)?.checked_add(round_up)
}

/// Utilisation scaled by `RATE_SCALE`: `debt / (debt + liquidity)`. Returns 0
/// when nothing is borrowed.
pub fn utilization(debt: i128, liquidity: i128) -> Option<i128> {
    if debt <= 0 {
        return Some(0);
    }
    let total = debt.checked_add(liquidity.max(0))?;
    debt.checked_mul(RATE_SCALE)?.checked_div(total)
}

#[cfg(test)]
mod tests {
    use super::*;

    const UNIT: i128 = 10_000_000;

    #[test]
    fn zero_inputs_give_zero_interest() {
        assert_eq!(accrued_interest(0, 500_000, 1_000), Some(0));
        assert_eq!(accrued_interest(1_000, 0, 1_000), Some(0));
        assert_eq!(accrued_interest(1_000, 500_000, 0), Some(0));
    }

    #[test]
    fn one_year_at_ten_percent() {
        let principal = 1_000 * UNIT;
        let interest = accrued_interest(principal, 1_000_000, SECONDS_PER_YEAR).unwrap();
        assert_eq!(interest, 100 * UNIT);
    }

    #[test]
    fn half_year_at_five_percent() {
        let principal = 2_000 * UNIT;
        let interest = accrued_interest(principal, 500_000, SECONDS_PER_YEAR / 2).unwrap();
        assert_eq!(interest, 50 * UNIT);
    }

    #[test]
    fn rounds_up_partial_units() {
        // 1 stroop for 1 second at 1% is far below one unit, but rounds up to 1.
        assert_eq!(accrued_interest(1, 100_000, 1), Some(1));
    }

    #[test]
    fn large_principal_does_not_overflow() {
        let principal = i128::MAX / 4;
        let interest = accrued_interest(principal, MAX_RATE, SECONDS_PER_YEAR).unwrap();
        // 100% for one year doubles the debt; interest equals principal.
        assert_eq!(interest, principal);
    }

    #[test]
    fn overflow_returns_none() {
        assert_eq!(
            accrued_interest(i128::MAX, MAX_RATE, SECONDS_PER_YEAR * 2),
            None
        );
    }

    #[test]
    fn rejects_invalid_inputs() {
        assert_eq!(accrued_interest(-1, 1, 1), None);
        assert_eq!(accrued_interest(1, -1, 1), None);
        assert_eq!(accrued_interest(1, MAX_RATE + 1, 1), None);
        assert!(!is_valid_rate(-1));
        assert!(is_valid_rate(0));
        assert!(is_valid_rate(MAX_RATE));
    }

    #[test]
    fn utilization_math() {
        assert_eq!(utilization(0, 100), Some(0));
        assert_eq!(utilization(25, 75), Some(RATE_SCALE / 4));
        assert_eq!(utilization(100, 0), Some(RATE_SCALE));
    }
}
