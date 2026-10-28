use soroban_sdk::contracterror;

/// Errors raised by the NdiStaking contract. OpenZeppelin modules use their
/// own codes (pausable 1000+, ownable 2100+), so these stay below 100.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum StakingError {
    /// Amount must be greater than zero.
    InvalidAmount = 1,
    /// Stake amount is outside `min_stake..=max_stake`.
    StakeOutOfRange = 2,
    /// The user already has an active stake.
    AlreadyStaked = 3,
    /// The user has no active stake.
    NoActiveStake = 4,
    /// No rewards are pending.
    NoRewards = 5,
    /// The reward pool cannot cover this payout.
    InsufficientRewardPool = 6,
    /// An unstake request is already open.
    UnstakeAlreadyRequested = 7,
    /// `unstake` called without a prior `request_unstake`.
    UnstakeNotRequested = 8,
    /// The cooldown since `request_unstake` has not passed yet.
    CooldownNotElapsed = 9,
    /// Constructor arguments are inconsistent.
    InvalidConfig = 10,
    /// Arithmetic overflow.
    MathOverflow = 11,
}
