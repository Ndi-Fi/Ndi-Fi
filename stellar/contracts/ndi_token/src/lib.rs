//! NdiToken: the Ndi-Fi reward and governance token on Stellar.
//!
//! Soroban port of `src/NdiPoint.sol`. It is a SEP-41 fungible token built on
//! OpenZeppelin Stellar Contracts with a hard supply cap, owner-gated minting
//! and reward distribution, burning, pausing, and native WASM upgrades.
#![no_std]

mod contract;
#[cfg(test)]
mod test;

pub use contract::{
    NdiToken, NdiTokenClient, RewardDistributed, TokenError, TokensRecovered, DECIMALS,
    INITIAL_SUPPLY, MAX_SUPPLY,
};
