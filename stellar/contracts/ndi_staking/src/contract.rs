use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, panic_with_error, token, Address, BytesN,
    Env,
};
use stellar_access::ownable::{self, Ownable};
use stellar_contract_utils::{
    pausable::{self, Pausable},
    upgradeable::{self, Upgradeable},
};
use stellar_macros::{only_owner, when_not_paused};

use crate::errors::StakingError;

/// Fixed-point scale for the reward rate: 1e7 = 100% per year.
pub const RATE_SCALE: i128 = 10_000_000;
/// 365 days, matching `365 days` in `NdiFiStaking.sol`.
pub const SECONDS_PER_YEAR: u64 = 365 * 24 * 60 * 60;

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const INSTANCE_TTL_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;
const PERSISTENT_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const PERSISTENT_TTL_EXTEND_TO: u32 = 90 * DAY_IN_LEDGERS;

/// Immutable staking configuration, set in the constructor.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    /// SEP-41 LP token users stake.
    pub stake_token: Address,
    /// SEP-41 token rewards are paid in (NdiToken).
    pub reward_token: Address,
    /// Annual reward rate, scaled by `RATE_SCALE`.
    pub reward_rate: i128,
    /// Smallest accepted stake.
    pub min_stake: i128,
    /// Largest accepted stake.
    pub max_stake: i128,
    /// Seconds between `request_unstake` and `unstake`.
    pub cooldown: u64,
}

/// One user's stake.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StakeInfo {
    /// LP tokens staked.
    pub amount: i128,
    /// Ledger timestamp when the stake was opened.
    pub staked_at: u64,
    /// Rewards already paid out for this stake.
    pub rewards_claimed: i128,
    /// Timestamp of `request_unstake`, if called.
    pub unstake_requested_at: Option<u64>,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Config,
    TotalStaked,
    Stake(Address),
}

/// Emitted when a user stakes.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Staked {
    #[topic]
    pub user: Address,
    pub amount: i128,
}

/// Emitted when a user claims rewards.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardClaimed {
    #[topic]
    pub user: Address,
    pub reward: i128,
}

/// Emitted when a user starts the unstake cooldown.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UnstakeRequested {
    #[topic]
    pub user: Address,
    pub amount: i128,
    pub available_at: u64,
}

/// Emitted when a user completes an unstake.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Unstaked {
    #[topic]
    pub user: Address,
    pub amount: i128,
    pub reward: i128,
}

/// Emitted when a user exits through `emergency_withdraw`.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmergencyWithdrawn {
    #[topic]
    pub user: Address,
    pub amount: i128,
    pub forfeited_reward: i128,
}

/// Emitted when someone adds reward tokens to the pool.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardsFunded {
    #[topic]
    pub from: Address,
    pub amount: i128,
}

/// Total rewards earned by `amount` staked at `rate` for `elapsed` seconds,
/// rounded down: `amount * rate * elapsed / (RATE_SCALE * SECONDS_PER_YEAR)`.
/// Splits `amount` by the denominator so large stakes do not overflow.
/// Returns `None` on overflow or negative inputs.
pub fn accrued_rewards(amount: i128, rate: i128, elapsed: u64) -> Option<i128> {
    if amount < 0 || rate < 0 {
        return None;
    }
    if amount == 0 || rate == 0 || elapsed == 0 {
        return Some(0);
    }
    let denominator = RATE_SCALE.checked_mul(i128::from(SECONDS_PER_YEAR))?;
    let rate_time = rate.checked_mul(i128::from(elapsed))?;
    let whole = (amount / denominator).checked_mul(rate_time)?;
    let part = (amount % denominator).checked_mul(rate_time)? / denominator;
    whole.checked_add(part)
}

/// NdiStaking contract.
#[contract]
pub struct NdiStaking;

fn extend_instance(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

fn config(e: &Env) -> Config {
    e.storage()
        .instance()
        .get(&DataKey::Config)
        .unwrap_or_else(|| panic_with_error!(e, StakingError::InvalidConfig))
}

fn read_total(e: &Env) -> i128 {
    e.storage()
        .instance()
        .get(&DataKey::TotalStaked)
        .unwrap_or(0)
}

fn write_total(e: &Env, total: i128) {
    e.storage().instance().set(&DataKey::TotalStaked, &total);
}

fn read_stake(e: &Env, user: &Address) -> Option<StakeInfo> {
    let key = DataKey::Stake(user.clone());
    let stake: Option<StakeInfo> = e.storage().persistent().get(&key);
    if stake.is_some() {
        e.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
    }
    stake
}

fn write_stake(e: &Env, user: &Address, stake: &StakeInfo) {
    let key = DataKey::Stake(user.clone());
    e.storage().persistent().set(&key, stake);
    e.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO);
}

fn remove_stake(e: &Env, user: &Address) {
    e.storage()
        .persistent()
        .remove(&DataKey::Stake(user.clone()));
}

fn pending_for(e: &Env, cfg: &Config, stake: &StakeInfo) -> Result<i128, StakingError> {
    let elapsed = e.ledger().timestamp().saturating_sub(stake.staked_at);
    let earned = accrued_rewards(stake.amount, cfg.reward_rate, elapsed)
        .ok_or(StakingError::MathOverflow)?;
    Ok(earned.saturating_sub(stake.rewards_claimed).max(0))
}

fn reward_pool(e: &Env, cfg: &Config) -> i128 {
    token::Client::new(e, &cfg.reward_token).balance(&e.current_contract_address())
}

fn pay_reward(e: &Env, cfg: &Config, to: &Address, reward: i128) -> Result<(), StakingError> {
    if reward > reward_pool(e, cfg) {
        return Err(StakingError::InsufficientRewardPool);
    }
    token::Client::new(e, &cfg.reward_token).transfer(&e.current_contract_address(), to, &reward);
    Ok(())
}

fn release_stake(e: &Env, cfg: &Config, user: &Address, amount: i128) -> Result<(), StakingError> {
    remove_stake(e, user);
    let total = read_total(e)
        .checked_sub(amount)
        .ok_or(StakingError::MathOverflow)?;
    write_total(e, total);
    token::Client::new(e, &cfg.stake_token).transfer(&e.current_contract_address(), user, &amount);
    Ok(())
}

#[contractimpl]
impl NdiStaking {
    /// Deploys the staking pool. `reward_rate` is the APR scaled by 1e7,
    /// `cooldown` is in seconds. The stake and reward tokens must differ so
    /// staked principal can never be paid out as rewards.
    #[allow(clippy::too_many_arguments)]
    pub fn __constructor(
        e: &Env,
        owner: Address,
        stake_token: Address,
        reward_token: Address,
        reward_rate: i128,
        min_stake: i128,
        max_stake: i128,
        cooldown: u64,
    ) {
        if stake_token == reward_token
            || !(0..=RATE_SCALE).contains(&reward_rate)
            || min_stake <= 0
            || max_stake < min_stake
        {
            panic_with_error!(e, StakingError::InvalidConfig);
        }
        ownable::set_owner(e, &owner);
        e.storage().instance().set(
            &DataKey::Config,
            &Config {
                stake_token,
                reward_token,
                reward_rate,
                min_stake,
                max_stake,
                cooldown,
            },
        );
        write_total(e, 0);
        extend_instance(e);
    }

    /// Stakes `amount` LP tokens from `user`. One open stake per user.
    /// Blocked while paused.
    #[when_not_paused]
    pub fn stake(e: &Env, user: Address, amount: i128) -> Result<(), StakingError> {
        user.require_auth();
        if amount <= 0 {
            return Err(StakingError::InvalidAmount);
        }
        let cfg = config(e);
        if amount < cfg.min_stake || amount > cfg.max_stake {
            return Err(StakingError::StakeOutOfRange);
        }
        if read_stake(e, &user).is_some() {
            return Err(StakingError::AlreadyStaked);
        }
        let total = read_total(e)
            .checked_add(amount)
            .ok_or(StakingError::MathOverflow)?;

        token::Client::new(e, &cfg.stake_token).transfer(
            &user,
            e.current_contract_address(),
            &amount,
        );
        write_stake(
            e,
            &user,
            &StakeInfo {
                amount,
                staked_at: e.ledger().timestamp(),
                rewards_claimed: 0,
                unstake_requested_at: None,
            },
        );
        write_total(e, total);
        Staked { user, amount }.publish(e);
        extend_instance(e);
        Ok(())
    }

    /// Pays `user` their pending rewards in the reward token. Blocked while
    /// paused. Returns the amount paid.
    #[when_not_paused]
    pub fn claim(e: &Env, user: Address) -> Result<i128, StakingError> {
        user.require_auth();
        let cfg = config(e);
        let mut stake = read_stake(e, &user).ok_or(StakingError::NoActiveStake)?;
        let reward = pending_for(e, &cfg, &stake)?;
        if reward == 0 {
            return Err(StakingError::NoRewards);
        }
        stake.rewards_claimed = stake
            .rewards_claimed
            .checked_add(reward)
            .ok_or(StakingError::MathOverflow)?;
        write_stake(e, &user, &stake);
        pay_reward(e, &cfg, &user, reward)?;
        RewardClaimed { user, reward }.publish(e);
        extend_instance(e);
        Ok(reward)
    }

    /// Starts the unstake cooldown for `user`'s stake. Rewards keep accruing
    /// until `unstake`, as in the Solidity version. Blocked while paused.
    /// Returns the timestamp when `unstake` becomes available.
    #[when_not_paused]
    pub fn request_unstake(e: &Env, user: Address) -> Result<u64, StakingError> {
        user.require_auth();
        let cfg = config(e);
        let mut stake = read_stake(e, &user).ok_or(StakingError::NoActiveStake)?;
        if stake.unstake_requested_at.is_some() {
            return Err(StakingError::UnstakeAlreadyRequested);
        }
        let now = e.ledger().timestamp();
        let available_at = now
            .checked_add(cfg.cooldown)
            .ok_or(StakingError::MathOverflow)?;
        stake.unstake_requested_at = Some(now);
        write_stake(e, &user, &stake);
        UnstakeRequested {
            user,
            amount: stake.amount,
            available_at,
        }
        .publish(e);
        extend_instance(e);
        Ok(available_at)
    }

    /// Completes an unstake after the cooldown: returns the LP tokens and pays
    /// pending rewards. Blocked while paused. Returns `(amount, reward)`.
    #[when_not_paused]
    pub fn unstake(e: &Env, user: Address) -> Result<(i128, i128), StakingError> {
        user.require_auth();
        let cfg = config(e);
        let stake = read_stake(e, &user).ok_or(StakingError::NoActiveStake)?;
        let requested_at = stake
            .unstake_requested_at
            .ok_or(StakingError::UnstakeNotRequested)?;
        let available_at = requested_at
            .checked_add(cfg.cooldown)
            .ok_or(StakingError::MathOverflow)?;
        if e.ledger().timestamp() < available_at {
            return Err(StakingError::CooldownNotElapsed);
        }
        let reward = pending_for(e, &cfg, &stake)?;
        release_stake(e, &cfg, &user, stake.amount)?;
        if reward > 0 {
            pay_reward(e, &cfg, &user, reward)?;
        }
        Unstaked {
            user,
            amount: stake.amount,
            reward,
        }
        .publish(e);
        extend_instance(e);
        Ok((stake.amount, reward))
    }

    /// Returns `user`'s LP tokens right away, even while paused, and forfeits
    /// any unclaimed rewards. Returns the amount returned.
    pub fn emergency_withdraw(e: &Env, user: Address) -> Result<i128, StakingError> {
        user.require_auth();
        let cfg = config(e);
        let stake = read_stake(e, &user).ok_or(StakingError::NoActiveStake)?;
        let forfeited_reward = pending_for(e, &cfg, &stake).unwrap_or(0);
        release_stake(e, &cfg, &user, stake.amount)?;
        EmergencyWithdrawn {
            user,
            amount: stake.amount,
            forfeited_reward,
        }
        .publish(e);
        extend_instance(e);
        Ok(stake.amount)
    }

    /// Adds `amount` reward tokens from `from` to the reward pool. Anyone can
    /// fund the pool.
    pub fn fund_rewards(e: &Env, from: Address, amount: i128) -> Result<(), StakingError> {
        from.require_auth();
        if amount <= 0 {
            return Err(StakingError::InvalidAmount);
        }
        let cfg = config(e);
        token::Client::new(e, &cfg.reward_token).transfer(
            &from,
            e.current_contract_address(),
            &amount,
        );
        RewardsFunded { from, amount }.publish(e);
        extend_instance(e);
        Ok(())
    }

    /// Returns rewards `user` could claim right now (0 if no stake).
    pub fn pending_rewards(e: &Env, user: Address) -> i128 {
        let cfg = config(e);
        match read_stake(e, &user) {
            Some(stake) => {
                pending_for(e, &cfg, &stake).unwrap_or_else(|err| panic_with_error!(e, err))
            }
            None => 0,
        }
    }

    /// Returns `user`'s stake, if any.
    pub fn get_stake(e: &Env, user: Address) -> Option<StakeInfo> {
        read_stake(e, &user)
    }

    /// Returns the total LP tokens currently staked.
    pub fn total_staked(e: &Env) -> i128 {
        read_total(e)
    }

    /// Returns the reward tokens available to pay out.
    pub fn reward_pool(e: &Env) -> i128 {
        reward_pool(e, &config(e))
    }

    /// Returns the staking configuration.
    pub fn config(e: &Env) -> Config {
        config(e)
    }
}

#[contractimpl(contracttrait)]
impl Ownable for NdiStaking {}

#[contractimpl(contracttrait)]
impl Pausable for NdiStaking {
    /// Pauses stake, claim, request_unstake and unstake. Emergency withdraw
    /// stays open. Owner only.
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
impl Upgradeable for NdiStaking {
    /// Replaces this contract's WASM with `new_wasm_hash` (already uploaded).
    /// Owner only.
    #[only_owner]
    fn upgrade(e: &Env, new_wasm_hash: BytesN<32>, _operator: Address) {
        upgradeable::upgrade(e, &new_wasm_hash);
    }
}
