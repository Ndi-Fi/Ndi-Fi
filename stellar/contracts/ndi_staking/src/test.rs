extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Address, Env, Event, IntoVal, Val, Vec,
};

use crate::{
    accrued_rewards, EmergencyWithdrawn, NdiStaking, NdiStakingClient, RewardClaimed, Staked,
    StakingError, Unstaked, RATE_SCALE, SECONDS_PER_YEAR,
};

const UNIT: i128 = 10_000_000;
/// 10% APR scaled by 1e7.
const RATE: i128 = 1_000_000;
const MIN: i128 = 10 * UNIT;
const MAX: i128 = 10_000 * UNIT;
const COOLDOWN: u64 = 21 * 24 * 60 * 60;

struct Setup<'a> {
    e: Env,
    owner: Address,
    user: Address,
    id: Address,
    lp: TokenClient<'a>,
    reward: TokenClient<'a>,
    staking: NdiStakingClient<'a>,
}

fn setup<'a>() -> Setup<'a> {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().set_timestamp(1_000);
    let owner = Address::generate(&e);
    let user = Address::generate(&e);

    let lp_sac = e.register_stellar_asset_contract_v2(owner.clone());
    let reward_sac = e.register_stellar_asset_contract_v2(owner.clone());
    StellarAssetClient::new(&e, &lp_sac.address()).mint(&user, &(20_000 * UNIT));
    StellarAssetClient::new(&e, &reward_sac.address()).mint(&owner, &(1_000_000 * UNIT));

    let id = e.register(
        NdiStaking,
        (
            owner.clone(),
            lp_sac.address(),
            reward_sac.address(),
            RATE,
            MIN,
            MAX,
            COOLDOWN,
        ),
    );
    let staking = NdiStakingClient::new(&e, &id);
    Setup {
        lp: TokenClient::new(&e, &lp_sac.address()),
        reward: TokenClient::new(&e, &reward_sac.address()),
        e,
        owner,
        user,
        id,
        staking,
    }
}

fn fund(s: &Setup, amount: i128) {
    s.staking.fund_rewards(&s.owner, &amount);
}

fn advance(s: &Setup, seconds: u64) {
    let now = s.e.ledger().timestamp();
    s.e.ledger().set_timestamp(now + seconds);
}

fn sign_as(s: &Setup, signer: &Address, fn_name: &str, args: Vec<Val>) {
    s.e.mock_auths(&[MockAuth {
        address: signer,
        invoke: &MockAuthInvoke {
            contract: &s.id,
            fn_name,
            args,
            sub_invokes: &[],
        },
    }]);
}

#[test]
fn reward_math() {
    assert_eq!(accrued_rewards(0, RATE, 100), Some(0));
    assert_eq!(
        accrued_rewards(1_000 * UNIT, RATE, SECONDS_PER_YEAR),
        Some(100 * UNIT)
    );
    assert_eq!(
        accrued_rewards(1_000 * UNIT, RATE, SECONDS_PER_YEAR / 2),
        Some(50 * UNIT)
    );
    // Rounds down: dust stakes earn nothing for tiny periods.
    assert_eq!(accrued_rewards(1, RATE, 1), Some(0));
    // Large stake does not overflow.
    let big = i128::MAX / 4;
    assert_eq!(
        accrued_rewards(big, RATE_SCALE, SECONDS_PER_YEAR),
        Some(big)
    );
    assert_eq!(
        accrued_rewards(i128::MAX, RATE_SCALE, SECONDS_PER_YEAR * 2),
        None
    );
    assert_eq!(accrued_rewards(-1, RATE, 1), None);
}

#[test]
fn constructor_stores_config() {
    let s = setup();
    let cfg = s.staking.config();
    assert_eq!(cfg.stake_token, s.lp.address);
    assert_eq!(cfg.reward_token, s.reward.address);
    assert_eq!(cfg.reward_rate, RATE);
    assert_eq!(cfg.min_stake, MIN);
    assert_eq!(cfg.max_stake, MAX);
    assert_eq!(cfg.cooldown, COOLDOWN);
    assert_eq!(s.staking.get_owner(), Some(s.owner.clone()));
    assert_eq!(s.staking.total_staked(), 0);
}

#[test]
#[should_panic]
fn constructor_rejects_same_stake_and_reward_token() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let token = e
        .register_stellar_asset_contract_v2(owner.clone())
        .address();
    e.register(
        NdiStaking,
        (owner, token.clone(), token, RATE, MIN, MAX, COOLDOWN),
    );
}

#[test]
fn stake_happy_path_and_event() {
    let s = setup();
    s.staking.stake(&s.user, &(1_000 * UNIT));
    let expected = Staked {
        user: s.user.clone(),
        amount: 1_000 * UNIT,
    }
    .to_xdr(&s.e, &s.id);
    assert!(s.e.events().all().events().contains(&expected));

    assert_eq!(s.staking.total_staked(), 1_000 * UNIT);
    assert_eq!(s.lp.balance(&s.id), 1_000 * UNIT);
    assert_eq!(s.lp.balance(&s.user), 19_000 * UNIT);
    let stake = s.staking.get_stake(&s.user).unwrap();
    assert_eq!(stake.amount, 1_000 * UNIT);
    assert_eq!(stake.staked_at, 1_000);
    assert_eq!(stake.unstake_requested_at, None);
}

#[test]
fn stake_validation() {
    let s = setup();
    assert_eq!(
        s.staking.try_stake(&s.user, &0),
        Err(Ok(StakingError::InvalidAmount))
    );
    assert_eq!(
        s.staking.try_stake(&s.user, &(MIN - 1)),
        Err(Ok(StakingError::StakeOutOfRange))
    );
    assert_eq!(
        s.staking.try_stake(&s.user, &(MAX + 1)),
        Err(Ok(StakingError::StakeOutOfRange))
    );
    s.staking.stake(&s.user, &MIN);
    assert_eq!(
        s.staking.try_stake(&s.user, &MIN),
        Err(Ok(StakingError::AlreadyStaked))
    );
}

#[test]
fn stake_requires_user_auth() {
    let s = setup();
    let attacker = Address::generate(&s.e);
    sign_as(&s, &attacker, "stake", (&s.user, MIN).into_val(&s.e));
    assert!(s.staking.try_stake(&s.user, &MIN).is_err());
    s.e.mock_all_auths();
    assert_eq!(s.staking.total_staked(), 0);
}

#[test]
fn stake_more_than_balance_fails() {
    let s = setup();
    let poor = Address::generate(&s.e);
    assert!(s.staking.try_stake(&poor, &MIN).is_err());
    assert_eq!(s.staking.get_stake(&poor), None);
}

#[test]
fn pending_rewards_accrue_over_time() {
    let s = setup();
    s.staking.stake(&s.user, &(1_000 * UNIT));
    assert_eq!(s.staking.pending_rewards(&s.user), 0);
    advance(&s, SECONDS_PER_YEAR / 2);
    assert_eq!(s.staking.pending_rewards(&s.user), 50 * UNIT);
    advance(&s, SECONDS_PER_YEAR / 2);
    assert_eq!(s.staking.pending_rewards(&s.user), 100 * UNIT);
    let nobody = Address::generate(&s.e);
    assert_eq!(s.staking.pending_rewards(&nobody), 0);
}

#[test]
fn claim_pays_rewards_and_tracks_claimed() {
    let s = setup();
    fund(&s, 1_000 * UNIT);
    s.staking.stake(&s.user, &(1_000 * UNIT));
    advance(&s, SECONDS_PER_YEAR);

    let paid = s.staking.claim(&s.user);
    assert_eq!(paid, 100 * UNIT);
    let expected = RewardClaimed {
        user: s.user.clone(),
        reward: 100 * UNIT,
    }
    .to_xdr(&s.e, &s.id);
    assert!(s.e.events().all().events().contains(&expected));
    assert_eq!(s.reward.balance(&s.user), 100 * UNIT);
    assert_eq!(s.staking.reward_pool(), 900 * UNIT);
    assert_eq!(s.staking.pending_rewards(&s.user), 0);
    assert_eq!(
        s.staking.try_claim(&s.user),
        Err(Ok(StakingError::NoRewards))
    );

    advance(&s, SECONDS_PER_YEAR);
    assert_eq!(s.staking.claim(&s.user), 100 * UNIT);
}

#[test]
fn claim_without_stake_fails() {
    let s = setup();
    assert_eq!(
        s.staking.try_claim(&s.user),
        Err(Ok(StakingError::NoActiveStake))
    );
}

#[test]
fn claim_fails_when_pool_is_empty() {
    let s = setup();
    s.staking.stake(&s.user, &(1_000 * UNIT));
    advance(&s, SECONDS_PER_YEAR);
    assert_eq!(
        s.staking.try_claim(&s.user),
        Err(Ok(StakingError::InsufficientRewardPool))
    );
    // Nothing was recorded as claimed.
    assert_eq!(s.staking.pending_rewards(&s.user), 100 * UNIT);
}

#[test]
fn claim_requires_user_auth() {
    let s = setup();
    fund(&s, 1_000 * UNIT);
    s.staking.stake(&s.user, &(1_000 * UNIT));
    advance(&s, SECONDS_PER_YEAR);
    let attacker = Address::generate(&s.e);
    sign_as(&s, &attacker, "claim", (&s.user,).into_val(&s.e));
    assert!(s.staking.try_claim(&s.user).is_err());
}

#[test]
fn unstake_flow_with_cooldown() {
    let s = setup();
    fund(&s, 1_000 * UNIT);
    s.staking.stake(&s.user, &(1_000 * UNIT));

    assert_eq!(
        s.staking.try_unstake(&s.user),
        Err(Ok(StakingError::UnstakeNotRequested))
    );

    advance(&s, SECONDS_PER_YEAR);
    let available_at = s.staking.request_unstake(&s.user);
    assert_eq!(available_at, s.e.ledger().timestamp() + COOLDOWN);
    assert_eq!(
        s.staking.try_request_unstake(&s.user),
        Err(Ok(StakingError::UnstakeAlreadyRequested))
    );

    advance(&s, COOLDOWN - 1);
    assert_eq!(
        s.staking.try_unstake(&s.user),
        Err(Ok(StakingError::CooldownNotElapsed))
    );

    advance(&s, 1);
    let (amount, reward) = s.staking.unstake(&s.user);
    let expected_reward = accrued_rewards(1_000 * UNIT, RATE, SECONDS_PER_YEAR + COOLDOWN).unwrap();
    assert_eq!(amount, 1_000 * UNIT);
    // Rewards keep accruing during the cooldown, as in NdiFiStaking.sol.
    assert_eq!(reward, expected_reward);
    let event = Unstaked {
        user: s.user.clone(),
        amount,
        reward,
    }
    .to_xdr(&s.e, &s.id);
    assert!(s.e.events().all().events().contains(&event));

    assert_eq!(s.lp.balance(&s.user), 20_000 * UNIT);
    assert_eq!(s.reward.balance(&s.user), expected_reward);
    assert_eq!(s.staking.total_staked(), 0);
    assert_eq!(s.staking.get_stake(&s.user), None);

    // The user can stake again after a full exit.
    s.staking.stake(&s.user, &MIN);
}

#[test]
fn request_unstake_without_stake_fails() {
    let s = setup();
    assert_eq!(
        s.staking.try_request_unstake(&s.user),
        Err(Ok(StakingError::NoActiveStake))
    );
}

#[test]
fn emergency_withdraw_returns_principal_and_forfeits_rewards() {
    let s = setup();
    fund(&s, 1_000 * UNIT);
    s.staking.stake(&s.user, &(1_000 * UNIT));
    advance(&s, SECONDS_PER_YEAR);
    s.staking.pause(&s.owner);

    let returned = s.staking.emergency_withdraw(&s.user);
    assert_eq!(returned, 1_000 * UNIT);
    let event = EmergencyWithdrawn {
        user: s.user.clone(),
        amount: 1_000 * UNIT,
        forfeited_reward: 100 * UNIT,
    }
    .to_xdr(&s.e, &s.id);
    assert!(s.e.events().all().events().contains(&event));
    assert_eq!(s.lp.balance(&s.user), 20_000 * UNIT);
    assert_eq!(s.reward.balance(&s.user), 0);
    assert_eq!(s.staking.total_staked(), 0);
    assert_eq!(s.staking.reward_pool(), 1_000 * UNIT);
    assert_eq!(
        s.staking.try_emergency_withdraw(&s.user),
        Err(Ok(StakingError::NoActiveStake))
    );
}

#[test]
fn emergency_withdraw_requires_user_auth() {
    let s = setup();
    s.staking.stake(&s.user, &MIN);
    let attacker = Address::generate(&s.e);
    sign_as(
        &s,
        &attacker,
        "emergency_withdraw",
        (&s.user,).into_val(&s.e),
    );
    assert!(s.staking.try_emergency_withdraw(&s.user).is_err());
}

#[test]
fn paused_blocks_stake_claim_and_unstake() {
    let s = setup();
    fund(&s, 1_000 * UNIT);
    s.staking.stake(&s.user, &(1_000 * UNIT));
    advance(&s, SECONDS_PER_YEAR);
    s.staking.pause(&s.owner);
    assert!(s.staking.paused());

    let other = Address::generate(&s.e);
    assert!(s.staking.try_stake(&other, &MIN).is_err());
    assert!(s.staking.try_claim(&s.user).is_err());
    assert!(s.staking.try_request_unstake(&s.user).is_err());
    assert!(s.staking.try_unstake(&s.user).is_err());

    s.staking.unpause(&s.owner);
    assert_eq!(s.staking.claim(&s.user), 100 * UNIT);
}

#[test]
fn pause_requires_owner() {
    let s = setup();
    let attacker = Address::generate(&s.e);
    sign_as(&s, &attacker, "pause", (&attacker,).into_val(&s.e));
    assert!(s.staking.try_pause(&attacker).is_err());
    s.e.mock_all_auths();
    assert!(!s.staking.paused());
}

#[test]
fn fund_rewards_validation() {
    let s = setup();
    assert_eq!(
        s.staking.try_fund_rewards(&s.owner, &0),
        Err(Ok(StakingError::InvalidAmount))
    );
    fund(&s, 5 * UNIT);
    assert_eq!(s.staking.reward_pool(), 5 * UNIT);
}

#[test]
fn stakers_earn_independently() {
    let s = setup();
    fund(&s, 10_000 * UNIT);
    let late = Address::generate(&s.e);
    StellarAssetClient::new(&s.e, &s.lp.address).mint(&late, &(2_000 * UNIT));

    s.staking.stake(&s.user, &(1_000 * UNIT));
    advance(&s, SECONDS_PER_YEAR / 2);
    s.staking.stake(&late, &(2_000 * UNIT));
    advance(&s, SECONDS_PER_YEAR / 2);

    assert_eq!(s.staking.pending_rewards(&s.user), 100 * UNIT);
    assert_eq!(s.staking.pending_rewards(&late), 100 * UNIT);
    assert_eq!(s.staking.total_staked(), 3_000 * UNIT);
}
