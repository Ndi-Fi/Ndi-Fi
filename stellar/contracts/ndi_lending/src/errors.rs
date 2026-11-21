use soroban_sdk::contracterror;

/// Errors raised by the NdiLending contract. OpenZeppelin modules use their
/// own codes (vault 400+, pausable 1000+, ownable 2100+), so these stay below 100.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum LendingError {
    /// Amount or share count must be greater than zero.
    InvalidAmount = 1,
    /// Deposit would push total managed assets above the deposit cap.
    DepositCapExceeded = 2,
    /// Owner does not hold enough shares for this withdraw or redeem.
    InsufficientShares = 3,
    /// Not enough idle assets in the vault (the rest is lent out).
    InsufficientLiquidity = 4,
    /// The deposit is too small to mint at least one share.
    ZeroShares = 5,
    /// The redeem is too small to return at least one asset unit.
    ZeroAssets = 6,
    /// No borrower has been authorised.
    NoBorrower = 7,
    /// The borrower cannot be changed while debt is outstanding.
    DebtOutstanding = 8,
    /// There is no debt to repay.
    NoDebt = 9,
    /// Interest rate is outside 0..=MAX_RATE.
    InvalidRate = 10,
    /// Deposit cap must be greater than zero.
    InvalidCap = 11,
    /// Arithmetic overflow.
    MathOverflow = 12,
}
