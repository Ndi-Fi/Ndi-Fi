use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, panic_with_error, token, Address, BytesN,
    Env, MuxedAddress, String,
};
use stellar_access::ownable::{self, Ownable};
use stellar_contract_utils::{
    math::{i128_fixed_point::checked_mul_div_with_rounding, Rounding},
    pausable::{self, Pausable},
    upgradeable::{self, Upgradeable},
};
use stellar_macros::{only_owner, when_not_paused, when_paused};
use stellar_tokens::{
    fungible::{
        total_supply::{total_supply, FungibleTotalSupply, TotalSupply},
        Base, Compose, FungibleToken,
    },
    vault::{emit_deposit, emit_withdraw, FungibleVault, Vault},
};

use crate::{errors::LendingError, interest};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const INSTANCE_TTL_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;

/// Virtual-share offset passed to the OpenZeppelin vault. 0 keeps share
/// decimals equal to the asset's decimals; the vault still adds one virtual
/// share and one virtual asset, which makes donation attacks unprofitable.
const DECIMALS_OFFSET: u32 = 0;

#[contracttype]
#[derive(Clone)]
enum DataKey {
    DepositCap,
    InterestRate,
    Borrower,
    Debt,
}

/// Outstanding borrower debt. `amount` already includes interest capitalised
/// up to `last_accrual` (ledger timestamp, seconds).
#[contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct DebtState {
    pub amount: i128,
    pub last_accrual: u64,
}

/// Emitted when the borrower draws liquidity from the vault.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Borrowed {
    #[topic]
    pub borrower: Address,
    pub amount: i128,
    pub total_debt: i128,
}

/// Emitted when debt is repaid.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Repaid {
    #[topic]
    pub from: Address,
    pub amount: i128,
    pub remaining_debt: i128,
}

/// Emitted when the owner changes the authorised borrower.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BorrowerUpdated {
    pub old_borrower: Option<Address>,
    pub new_borrower: Option<Address>,
}

/// Emitted when the owner changes the deposit cap.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DepositCapUpdated {
    pub old_cap: i128,
    pub new_cap: i128,
}

/// Emitted when the owner changes the annual interest rate.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InterestRateUpdated {
    pub old_rate: i128,
    pub new_rate: i128,
}

/// Emitted when the owner sweeps idle assets during a pause.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmergencyWithdrawn {
    #[topic]
    pub to: Address,
    pub amount: i128,
}

/// NdiLending vault contract.
#[contract]
pub struct NdiLending;

// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------

fn extend_instance(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

fn fail(e: &Env, err: LendingError) -> ! {
    panic_with_error!(e, err)
}

fn read_debt(e: &Env) -> DebtState {
    e.storage()
        .instance()
        .get(&DataKey::Debt)
        .unwrap_or_default()
}

fn read_rate(e: &Env) -> i128 {
    e.storage()
        .instance()
        .get(&DataKey::InterestRate)
        .unwrap_or(0)
}

fn read_cap(e: &Env) -> i128 {
    e.storage()
        .instance()
        .get(&DataKey::DepositCap)
        .unwrap_or(0)
}

fn read_borrower(e: &Env) -> Option<Address> {
    e.storage().instance().get(&DataKey::Borrower)
}

/// Debt including interest accrued since the last write. Read-only.
fn debt_with_interest(e: &Env) -> Result<DebtState, LendingError> {
    let debt = read_debt(e);
    let now = e.ledger().timestamp();
    let elapsed = now.saturating_sub(debt.last_accrual);
    let interest = interest::accrued_interest(debt.amount, read_rate(e), elapsed)
        .ok_or(LendingError::MathOverflow)?;
    Ok(DebtState {
        amount: debt
            .amount
            .checked_add(interest)
            .ok_or(LendingError::MathOverflow)?,
        last_accrual: now,
    })
}

/// Capitalises pending interest into stored debt and returns it.
fn accrue(e: &Env) -> Result<DebtState, LendingError> {
    let debt = debt_with_interest(e)?;
    e.storage().instance().set(&DataKey::Debt, &debt);
    Ok(debt)
}

/// Asset tokens currently held by the vault (not lent out).
fn idle_assets(e: &Env) -> i128 {
    Vault::total_assets(e)
}

/// Idle assets plus outstanding debt (with interest). This is what backs the shares.
fn managed_assets(e: &Env) -> i128 {
    let debt = debt_with_interest(e).unwrap_or_else(|err| fail(e, err));
    idle_assets(e)
        .checked_add(debt.amount)
        .unwrap_or_else(|| fail(e, LendingError::MathOverflow))
}

fn virtual_shares(e: &Env) -> i128 {
    10_i128
        .checked_pow(Vault::get_decimals_offset(e))
        .unwrap_or_else(|| fail(e, LendingError::MathOverflow))
}

/// Same formula as the OpenZeppelin vault, but over `managed_assets`.
fn to_shares(e: &Env, assets: i128, rounding: Rounding) -> i128 {
    if assets <= 0 {
        return 0;
    }
    let supply = total_supply(e)
        .checked_add(virtual_shares(e))
        .unwrap_or_else(|| fail(e, LendingError::MathOverflow));
    let backing = managed_assets(e)
        .checked_add(1)
        .unwrap_or_else(|| fail(e, LendingError::MathOverflow));
    checked_mul_div_with_rounding(e, assets, supply, backing, rounding)
        .unwrap_or_else(|| fail(e, LendingError::MathOverflow))
}

fn to_assets(e: &Env, shares: i128, rounding: Rounding) -> i128 {
    if shares <= 0 {
        return 0;
    }
    let backing = managed_assets(e)
        .checked_add(1)
        .unwrap_or_else(|| fail(e, LendingError::MathOverflow));
    let supply = total_supply(e)
        .checked_add(virtual_shares(e))
        .unwrap_or_else(|| fail(e, LendingError::MathOverflow));
    checked_mul_div_with_rounding(e, shares, backing, supply, rounding)
        .unwrap_or_else(|| fail(e, LendingError::MathOverflow))
}

fn remaining_cap(e: &Env) -> i128 {
    read_cap(e).saturating_sub(managed_assets(e)).max(0)
}

fn do_deposit(
    e: &Env,
    assets: i128,
    shares: i128,
    receiver: &Address,
    from: &Address,
    operator: &Address,
) {
    Vault::deposit_internal(e, receiver, assets, shares, from, operator);
    emit_deposit(e, operator, from, receiver, assets, shares);
    extend_instance(e);
}

fn do_withdraw(
    e: &Env,
    assets: i128,
    shares: i128,
    receiver: &Address,
    owner: &Address,
    operator: &Address,
) {
    Vault::withdraw_internal(e, receiver, owner, assets, shares, operator);
    emit_withdraw(e, operator, receiver, owner, assets, shares);
    extend_instance(e);
}

// ---------------------------------------------------------------------------
// Contract-specific entry points
// ---------------------------------------------------------------------------

#[contractimpl]
impl NdiLending {
    /// Deploys the vault for the SEP-41 `asset`. Share metadata is `name` /
    /// `symbol` with the asset's decimals. `deposit_cap` limits total managed
    /// assets; `interest_rate` is the borrower APR scaled by 1e7.
    pub fn __constructor(
        e: &Env,
        owner: Address,
        asset: Address,
        name: String,
        symbol: String,
        deposit_cap: i128,
        interest_rate: i128,
    ) {
        if deposit_cap <= 0 {
            fail(e, LendingError::InvalidCap);
        }
        if !interest::is_valid_rate(interest_rate) {
            fail(e, LendingError::InvalidRate);
        }
        Vault::set_asset(e, asset);
        Vault::set_decimals_offset(e, DECIMALS_OFFSET);
        Base::set_metadata(e, Vault::decimals(e), name, symbol);
        ownable::set_owner(e, &owner);
        let storage = e.storage().instance();
        storage.set(&DataKey::DepositCap, &deposit_cap);
        storage.set(&DataKey::InterestRate, &interest_rate);
        storage.set(
            &DataKey::Debt,
            &DebtState {
                amount: 0,
                last_accrual: e.ledger().timestamp(),
            },
        );
        extend_instance(e);
    }

    /// Draws `amount` of idle liquidity to the authorised borrower. The
    /// borrower must sign. Blocked while paused.
    #[when_not_paused]
    pub fn borrow(e: &Env, amount: i128) -> Result<i128, LendingError> {
        let borrower = read_borrower(e).ok_or(LendingError::NoBorrower)?;
        borrower.require_auth();
        if amount <= 0 {
            return Err(LendingError::InvalidAmount);
        }
        let mut debt = accrue(e)?;
        if amount > idle_assets(e) {
            return Err(LendingError::InsufficientLiquidity);
        }
        debt.amount = debt
            .amount
            .checked_add(amount)
            .ok_or(LendingError::MathOverflow)?;
        e.storage().instance().set(&DataKey::Debt, &debt);

        token::Client::new(e, &Vault::query_asset(e)).transfer(
            &e.current_contract_address(),
            &borrower,
            &amount,
        );
        Borrowed {
            borrower,
            amount,
            total_debt: debt.amount,
        }
        .publish(e);
        extend_instance(e);
        Ok(debt.amount)
    }

    /// Repays up to `amount` of debt from `from` (anyone may repay). Any
    /// excess over the outstanding debt is not taken. Allowed while paused.
    /// Returns the debt still outstanding.
    pub fn repay(e: &Env, from: Address, amount: i128) -> Result<i128, LendingError> {
        from.require_auth();
        if amount <= 0 {
            return Err(LendingError::InvalidAmount);
        }
        let mut debt = accrue(e)?;
        if debt.amount == 0 {
            return Err(LendingError::NoDebt);
        }
        let paid = amount.min(debt.amount);
        debt.amount -= paid;
        e.storage().instance().set(&DataKey::Debt, &debt);

        token::Client::new(e, &Vault::query_asset(e)).transfer(
            &from,
            e.current_contract_address(),
            &paid,
        );
        Repaid {
            from,
            amount: paid,
            remaining_debt: debt.amount,
        }
        .publish(e);
        extend_instance(e);
        Ok(debt.amount)
    }

    /// Sets (or clears, with `None`) the single borrower allowed to call
    /// `borrow`. Owner only. Fails while debt is outstanding.
    #[only_owner]
    pub fn set_borrower(e: &Env, borrower: Option<Address>) -> Result<(), LendingError> {
        if debt_with_interest(e)?.amount > 0 {
            return Err(LendingError::DebtOutstanding);
        }
        let old_borrower = read_borrower(e);
        match &borrower {
            Some(addr) => e.storage().instance().set(&DataKey::Borrower, addr),
            None => e.storage().instance().remove(&DataKey::Borrower),
        }
        BorrowerUpdated {
            old_borrower,
            new_borrower: borrower,
        }
        .publish(e);
        extend_instance(e);
        Ok(())
    }

    /// Sets the borrower APR (scaled by 1e7, max 100%). Interest up to now is
    /// accrued at the old rate first. Owner only.
    #[only_owner]
    pub fn set_interest_rate(e: &Env, rate: i128) -> Result<(), LendingError> {
        if !interest::is_valid_rate(rate) {
            return Err(LendingError::InvalidRate);
        }
        accrue(e)?;
        let old_rate = read_rate(e);
        e.storage().instance().set(&DataKey::InterestRate, &rate);
        InterestRateUpdated {
            old_rate,
            new_rate: rate,
        }
        .publish(e);
        extend_instance(e);
        Ok(())
    }

    /// Sets the cap on total managed assets. Owner only. Must be > 0.
    #[only_owner]
    pub fn set_deposit_cap(e: &Env, cap: i128) -> Result<(), LendingError> {
        if cap <= 0 {
            return Err(LendingError::InvalidCap);
        }
        let old_cap = read_cap(e);
        e.storage().instance().set(&DataKey::DepositCap, &cap);
        DepositCapUpdated {
            old_cap,
            new_cap: cap,
        }
        .publish(e);
        extend_instance(e);
        Ok(())
    }

    /// Sends every idle asset to `to`. Owner only, and only while paused.
    /// Returns the amount sent.
    #[only_owner]
    #[when_paused]
    pub fn emergency_withdraw(e: &Env, to: Address) -> i128 {
        let amount = idle_assets(e);
        if amount > 0 {
            token::Client::new(e, &Vault::query_asset(e)).transfer(
                &e.current_contract_address(),
                &to,
                &amount,
            );
        }
        EmergencyWithdrawn { to, amount }.publish(e);
        amount
    }

    /// Returns the current deposit cap.
    pub fn deposit_cap(e: &Env) -> i128 {
        read_cap(e)
    }

    /// Returns the borrower APR, scaled by 1e7.
    pub fn interest_rate(e: &Env) -> i128 {
        read_rate(e)
    }

    /// Returns the authorised borrower, if any.
    pub fn borrower(e: &Env) -> Option<Address> {
        read_borrower(e)
    }

    /// Returns the outstanding debt including interest accrued up to now.
    pub fn total_debt(e: &Env) -> i128 {
        debt_with_interest(e)
            .unwrap_or_else(|err| fail(e, err))
            .amount
    }

    /// Returns the asset balance the vault holds right now (not lent out).
    pub fn available_liquidity(e: &Env) -> i128 {
        idle_assets(e)
    }

    /// Returns `debt / (debt + liquidity)`, scaled by 1e7.
    pub fn utilization(e: &Env) -> i128 {
        interest::utilization(Self::total_debt(e), idle_assets(e))
            .unwrap_or_else(|| fail(e, LendingError::MathOverflow))
    }
}

// ---------------------------------------------------------------------------
// SEP-41 share token
// ---------------------------------------------------------------------------

#[contractimpl(contracttrait)]
impl FungibleToken for NdiLending {
    type ContractType = Compose<(Vault, TotalSupply)>;

    /// Share decimals: the asset's decimals plus the virtual offset.
    fn decimals(e: &Env) -> u32 {
        Vault::decimals(e)
    }
}

#[contractimpl(contracttrait)]
impl FungibleTotalSupply for NdiLending {}

// ---------------------------------------------------------------------------
// Vault (ERC-4626-style) interface, with debt counted in total assets
// ---------------------------------------------------------------------------

#[contractimpl(contracttrait)]
impl FungibleVault for NdiLending {
    /// Idle assets plus outstanding borrower debt with interest.
    fn total_assets(e: &Env) -> i128 {
        managed_assets(e)
    }

    /// Shares minted for `assets` (rounded down).
    fn convert_to_shares(e: &Env, assets: i128) -> i128 {
        to_shares(e, assets, Rounding::Floor)
    }

    /// Assets returned for `shares` (rounded down).
    fn convert_to_assets(e: &Env, shares: i128) -> i128 {
        to_assets(e, shares, Rounding::Floor)
    }

    /// Room left under the deposit cap; 0 while paused.
    fn max_deposit(e: &Env, _receiver: Address) -> i128 {
        if pausable::paused(e) {
            return 0;
        }
        remaining_cap(e)
    }

    /// Shares a deposit of `assets` would mint now.
    fn preview_deposit(e: &Env, assets: i128) -> i128 {
        to_shares(e, assets, Rounding::Floor)
    }

    /// Deposits `assets` from `from` and mints shares to `receiver`.
    /// `operator` must sign (it is `from`, or a spender with an allowance).
    /// Blocked while paused.
    #[when_not_paused]
    fn deposit(e: &Env, assets: i128, receiver: Address, from: Address, operator: Address) -> i128 {
        operator.require_auth();
        if assets <= 0 {
            fail(e, LendingError::InvalidAmount);
        }
        if assets > remaining_cap(e) {
            fail(e, LendingError::DepositCapExceeded);
        }
        let shares = to_shares(e, assets, Rounding::Floor);
        if shares == 0 {
            fail(e, LendingError::ZeroShares);
        }
        do_deposit(e, assets, shares, &receiver, &from, &operator);
        shares
    }

    /// Largest share amount `mint` accepts right now; 0 while paused.
    fn max_mint(e: &Env, receiver: Address) -> i128 {
        to_shares(e, Self::max_deposit(e, receiver), Rounding::Floor)
    }

    /// Assets needed to mint `shares` now (rounded up).
    fn preview_mint(e: &Env, shares: i128) -> i128 {
        to_assets(e, shares, Rounding::Ceil)
    }

    /// Mints exactly `shares` to `receiver`, pulling the needed assets from
    /// `from`. `operator` must sign. Blocked while paused.
    #[when_not_paused]
    fn mint(e: &Env, shares: i128, receiver: Address, from: Address, operator: Address) -> i128 {
        operator.require_auth();
        if shares <= 0 {
            fail(e, LendingError::InvalidAmount);
        }
        let assets = to_assets(e, shares, Rounding::Ceil);
        if assets > remaining_cap(e) {
            fail(e, LendingError::DepositCapExceeded);
        }
        do_deposit(e, assets, shares, &receiver, &from, &operator);
        assets
    }

    /// Assets `owner` can withdraw now, limited by idle liquidity; 0 while paused.
    fn max_withdraw(e: &Env, owner: Address) -> i128 {
        if pausable::paused(e) {
            return 0;
        }
        to_assets(e, Base::balance(e, &owner), Rounding::Floor).min(idle_assets(e))
    }

    /// Shares burned to withdraw `assets` now (rounded up).
    fn preview_withdraw(e: &Env, assets: i128) -> i128 {
        to_shares(e, assets, Rounding::Ceil)
    }

    /// Burns `owner`'s shares and sends exactly `assets` to `receiver`.
    /// `operator` must sign and needs a share allowance if it is not `owner`.
    /// Blocked while paused.
    #[when_not_paused]
    fn withdraw(
        e: &Env,
        assets: i128,
        receiver: Address,
        owner: Address,
        operator: Address,
    ) -> i128 {
        operator.require_auth();
        if assets <= 0 {
            fail(e, LendingError::InvalidAmount);
        }
        if assets > to_assets(e, Base::balance(e, &owner), Rounding::Floor) {
            fail(e, LendingError::InsufficientShares);
        }
        if assets > idle_assets(e) {
            fail(e, LendingError::InsufficientLiquidity);
        }
        let shares = to_shares(e, assets, Rounding::Ceil);
        do_withdraw(e, assets, shares, &receiver, &owner, &operator);
        shares
    }

    /// Shares `owner` can redeem now, limited by idle liquidity; 0 while paused.
    fn max_redeem(e: &Env, owner: Address) -> i128 {
        if pausable::paused(e) {
            return 0;
        }
        Base::balance(e, &owner).min(to_shares(e, idle_assets(e), Rounding::Floor))
    }

    /// Assets returned for redeeming `shares` now (rounded down).
    fn preview_redeem(e: &Env, shares: i128) -> i128 {
        to_assets(e, shares, Rounding::Floor)
    }

    /// Burns exactly `shares` from `owner` and sends the assets to `receiver`.
    /// `operator` must sign and needs a share allowance if it is not `owner`.
    /// Blocked while paused.
    #[when_not_paused]
    fn redeem(e: &Env, shares: i128, receiver: Address, owner: Address, operator: Address) -> i128 {
        operator.require_auth();
        if shares <= 0 {
            fail(e, LendingError::InvalidAmount);
        }
        if shares > Base::balance(e, &owner) {
            fail(e, LendingError::InsufficientShares);
        }
        let assets = to_assets(e, shares, Rounding::Floor);
        if assets == 0 {
            fail(e, LendingError::ZeroAssets);
        }
        if assets > idle_assets(e) {
            fail(e, LendingError::InsufficientLiquidity);
        }
        do_withdraw(e, assets, shares, &receiver, &owner, &operator);
        assets
    }
}

// ---------------------------------------------------------------------------
// Access control, pausing and upgrades
// ---------------------------------------------------------------------------

#[contractimpl(contracttrait)]
impl Ownable for NdiLending {}

#[contractimpl(contracttrait)]
impl Pausable for NdiLending {
    /// Pauses deposits, mints, withdrawals, redemptions and borrowing. Owner only.
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
impl Upgradeable for NdiLending {
    /// Replaces this contract's WASM with `new_wasm_hash` (already uploaded).
    /// Owner only.
    #[only_owner]
    fn upgrade(e: &Env, new_wasm_hash: BytesN<32>, _operator: Address) {
        upgradeable::upgrade(e, &new_wasm_hash);
    }
}
