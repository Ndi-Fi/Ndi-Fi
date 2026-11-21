use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN,
    Env, MuxedAddress, String, Vec,
};
use stellar_access::ownable::{self, Ownable};
use stellar_contract_utils::{
    pausable::{self, Pausable},
    upgradeable::{self, Upgradeable},
};
use stellar_macros::{only_owner, when_not_paused};
use stellar_tokens::fungible::{
    burnable::FungibleBurnable,
    capped::{self, Capped, FungibleCapped},
    total_supply::{FungibleTotalSupply, TotalSupply},
    Base, Compose, ContractOverrides, FungibleToken,
};

/// Stellar assets conventionally use 7 decimals (the Solidity token used 18).
pub const DECIMALS: u32 = 7;
const UNIT: i128 = 10_000_000;
/// Hard cap: 1 billion tokens.
pub const MAX_SUPPLY: i128 = 1_000_000_000 * UNIT;
/// Minted to the owner at deployment: 100 million tokens.
pub const INITIAL_SUPPLY: i128 = 100_000_000 * UNIT;

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const INSTANCE_TTL_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;
const PERSISTENT_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const PERSISTENT_TTL_EXTEND_TO: u32 = 90 * DAY_IN_LEDGERS;

/// Errors raised by the NdiToken contract.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TokenError {
    /// Amount must be greater than zero.
    InvalidAmount = 1,
    /// `recipients` and `amounts` have different lengths.
    LengthMismatch = 2,
    /// A batch call was made with no recipients.
    EmptyBatch = 3,
    /// The token cannot recover its own balance.
    CannotRecoverSelf = 4,
    /// Minting would push total supply above `MAX_SUPPLY`.
    ExceedsMaxSupply = 5,
    /// Arithmetic overflow.
    MathOverflow = 6,
}

#[contracttype]
enum DataKey {
    LastRewardAt(Address),
}

/// Emitted for every reward minted through `distribute_reward(s)`.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardDistributed {
    #[topic]
    pub recipient: Address,
    pub amount: i128,
    pub reason: String,
}

/// Emitted when the owner recovers tokens sent to this contract by mistake.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokensRecovered {
    #[topic]
    pub token: Address,
    #[topic]
    pub to: Address,
    pub amount: i128,
}

/// NdiToken contract.
#[contract]
pub struct NdiToken;

fn extend_instance(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

fn check_room(e: &Env, amount: i128) -> Result<(), TokenError> {
    let new_supply = TotalSupply::total_supply(e)
        .checked_add(amount)
        .ok_or(TokenError::MathOverflow)?;
    if new_supply > MAX_SUPPLY {
        return Err(TokenError::ExceedsMaxSupply);
    }
    Ok(())
}

fn mint_reward(e: &Env, recipient: &Address, amount: i128, reason: &String) {
    Capped::mint(e, recipient, amount);
    let key = DataKey::LastRewardAt(recipient.clone());
    e.storage().persistent().set(&key, &e.ledger().timestamp());
    e.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO);
    RewardDistributed {
        recipient: recipient.clone(),
        amount,
        reason: reason.clone(),
    }
    .publish(e);
}

#[contractimpl]
impl NdiToken {
    /// Deploys the token: sets metadata ("Ndi-Point", "NDI", 7 decimals), the
    /// supply cap and the owner, and mints `INITIAL_SUPPLY` to `owner`.
    pub fn __constructor(e: &Env, owner: Address) {
        Base::set_metadata(
            e,
            DECIMALS,
            String::from_str(e, "Ndi-Point"),
            String::from_str(e, "NDI"),
        );
        capped::set_cap(e, MAX_SUPPLY);
        ownable::set_owner(e, &owner);
        Capped::mint(e, &owner, INITIAL_SUPPLY);
        extend_instance(e);
    }

    /// Mints `amount` new tokens to `to`. Owner only; blocked while paused.
    #[only_owner]
    #[when_not_paused]
    pub fn mint(e: &Env, to: Address, amount: i128) -> Result<(), TokenError> {
        if amount <= 0 {
            return Err(TokenError::InvalidAmount);
        }
        check_room(e, amount)?;
        Capped::mint(e, &to, amount);
        extend_instance(e);
        Ok(())
    }

    /// Mints a single reward to `recipient`, records the reward time and emits
    /// `RewardDistributed`. Owner only; blocked while paused.
    #[only_owner]
    #[when_not_paused]
    pub fn distribute_reward(
        e: &Env,
        recipient: Address,
        amount: i128,
        reason: String,
    ) -> Result<(), TokenError> {
        if amount <= 0 {
            return Err(TokenError::InvalidAmount);
        }
        check_room(e, amount)?;
        mint_reward(e, &recipient, amount, &reason);
        extend_instance(e);
        Ok(())
    }

    /// Mints rewards to many recipients in one call. The whole batch fails if
    /// any amount is zero or the total would exceed the supply cap. Owner only;
    /// blocked while paused.
    #[only_owner]
    #[when_not_paused]
    pub fn distribute_rewards(
        e: &Env,
        recipients: Vec<Address>,
        amounts: Vec<i128>,
        reason: String,
    ) -> Result<(), TokenError> {
        if recipients.len() != amounts.len() {
            return Err(TokenError::LengthMismatch);
        }
        if recipients.is_empty() {
            return Err(TokenError::EmptyBatch);
        }
        let mut total: i128 = 0;
        for amount in amounts.iter() {
            if amount <= 0 {
                return Err(TokenError::InvalidAmount);
            }
            total = total.checked_add(amount).ok_or(TokenError::MathOverflow)?;
        }
        check_room(e, total)?;
        for (recipient, amount) in recipients.iter().zip(amounts.iter()) {
            mint_reward(e, &recipient, amount, &reason);
        }
        extend_instance(e);
        Ok(())
    }

    /// Returns the ledger timestamp of the last reward minted to `account`, or 0.
    pub fn last_reward_at(e: &Env, account: Address) -> u64 {
        let key = DataKey::LastRewardAt(account);
        let value = e.storage().persistent().get(&key);
        if value.is_some() {
            e.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
        }
        value.unwrap_or(0)
    }

    /// Returns the maximum supply (`MAX_SUPPLY`).
    pub fn max_supply(_e: &Env) -> i128 {
        MAX_SUPPLY
    }

    /// Returns how many tokens can still be minted before hitting the cap.
    pub fn remaining_supply(e: &Env) -> i128 {
        MAX_SUPPLY - TotalSupply::total_supply(e)
    }

    /// Sends other SEP-41 tokens that were sent here by mistake to `to`.
    /// Owner only. The token's own balance cannot be recovered.
    #[only_owner]
    pub fn recover_tokens(
        e: &Env,
        token: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), TokenError> {
        if token == e.current_contract_address() {
            return Err(TokenError::CannotRecoverSelf);
        }
        if amount <= 0 {
            return Err(TokenError::InvalidAmount);
        }
        token::Client::new(e, &token).transfer(&e.current_contract_address(), &to, &amount);
        TokensRecovered { token, to, amount }.publish(e);
        Ok(())
    }
}

#[contractimpl(contracttrait)]
impl FungibleToken for NdiToken {
    type ContractType = Compose<(Capped, TotalSupply)>;

    /// Transfers `amount` from `from` to `to`. Blocked while paused.
    #[when_not_paused]
    fn transfer(e: &Env, from: Address, to: MuxedAddress, amount: i128) {
        Self::ContractType::transfer(e, &from, &to, amount);
    }

    /// Transfers `amount` from `from` to `to` using `spender`'s allowance.
    /// Blocked while paused.
    #[when_not_paused]
    fn transfer_from(e: &Env, spender: Address, from: Address, to: Address, amount: i128) {
        Self::ContractType::transfer_from(e, &spender, &from, &to, amount);
    }
}

#[contractimpl(contracttrait)]
impl FungibleTotalSupply for NdiToken {}

#[contractimpl(contracttrait)]
impl FungibleCapped for NdiToken {}

#[contractimpl(contracttrait)]
impl FungibleBurnable for NdiToken {
    /// Burns `amount` from `from`. Blocked while paused.
    #[when_not_paused]
    fn burn(e: &Env, from: Address, amount: i128) {
        Self::ContractType::burn(e, &from, amount);
    }

    /// Burns `amount` from `from` using `spender`'s allowance. Blocked while paused.
    #[when_not_paused]
    fn burn_from(e: &Env, spender: Address, from: Address, amount: i128) {
        Self::ContractType::burn_from(e, &spender, &from, amount);
    }
}

#[contractimpl(contracttrait)]
impl Ownable for NdiToken {}

#[contractimpl(contracttrait)]
impl Pausable for NdiToken {
    /// Pauses transfers, burns, mints and reward distribution. Owner only.
    #[only_owner]
    fn pause(e: &Env, _caller: Address) {
        pausable::pause(e);
    }

    /// Lifts the pause. Owner only.
    #[only_owner]
    fn unpause(e: &Env, _caller: Address) {
        pausable::unpause(e);
    }
}

#[contractimpl]
impl Upgradeable for NdiToken {
    /// Replaces this contract's WASM with `new_wasm_hash` (already uploaded).
    /// Owner only.
    #[only_owner]
    fn upgrade(e: &Env, new_wasm_hash: BytesN<32>, _operator: Address) {
        upgradeable::upgrade(e, &new_wasm_hash);
    }
}
