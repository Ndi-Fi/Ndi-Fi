//! NdiStaking: LP-token staking with NdiToken rewards on Stellar.
//!
//! Soroban adaptation of `src/NdiFiStaking.sol`. Users stake a SEP-41 LP token
//! (for example a Soroswap pair token) and earn a fixed annual reward in
//! NdiToken, paid from a pre-funded reward pool. Unstaking is a two-step
//! request/execute flow with a cooldown (21 days by default in the Solidity
//! version). Emergency withdraw returns principal at any time and forfeits
//! unclaimed rewards.
#![no_std]

mod contract;
mod errors;
#[cfg(test)]
mod test;

pub use contract::{
    accrued_rewards, Config, EmergencyWithdrawn, NdiStaking, NdiStakingClient, RewardClaimed,
    RewardsFunded, StakeInfo, Staked, UnstakeRequested, Unstaked, RATE_SCALE, SECONDS_PER_YEAR,
};
pub use errors::StakingError;
