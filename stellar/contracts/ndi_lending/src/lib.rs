//! NdiLending: the Ndi-Fi lending vault on Stellar.
//!
//! Soroban port of `src/NdiFiVault.sol`, built on the OpenZeppelin Stellar
//! fungible-token vault. Depositors receive vault shares for a SEP-41 asset
//! (XLM or USDC through the Stellar Asset Contract). One owner-approved
//! borrower can draw idle liquidity; its debt grows at a fixed annual rate
//! (see [`interest`]) and repaid interest raises the share price.
#![no_std]

mod contract;
mod errors;
pub mod interest;
#[cfg(test)]
mod test;

pub use contract::{
    Borrowed, BorrowerUpdated, DepositCapUpdated, EmergencyWithdrawn, InterestRateUpdated,
    NdiLending, NdiLendingClient, Repaid,
};
pub use errors::LendingError;
