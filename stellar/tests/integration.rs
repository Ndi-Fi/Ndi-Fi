//! Deploys NdiToken, NdiLending and NdiStaking side by side and runs the main
//! user journeys end to end:
//!
//! 1. deposit -> borrower draws and accrues interest -> repay -> withdraw with yield
//! 2. stake LP -> time passes -> claim NDI -> request unstake -> cooldown -> unstake

use ndi_lending::{interest::SECONDS_PER_YEAR, NdiLending, NdiLendingClient};
use ndi_staking::{accrued_rewards, NdiStaking, NdiStakingClient};
use ndi_token::{NdiToken, NdiTokenClient, INITIAL_SUPPLY};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env, String,
};

const UNIT: i128 = 10_000_000;
const COOLDOWN: u64 = 21 * 24 * 60 * 60;

struct Protocol<'a> {
    e: Env,
    owner: Address,
    usdc: TokenClient<'a>,
    usdc_admin: StellarAssetClient<'a>,
    lp: TokenClient<'a>,
    lp_admin: StellarAssetClient<'a>,
    ndi: NdiTokenClient<'a>,
    lending: NdiLendingClient<'a>,
    staking: NdiStakingClient<'a>,
}

fn deploy<'a>() -> Protocol<'a> {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().set_timestamp(1_700_000_000);
    let owner = Address::generate(&e);

    // Stand-ins for USDC (via the Stellar Asset Contract) and a Soroswap LP token.
    let usdc_sac = e.register_stellar_asset_contract_v2(owner.clone());
    let lp_sac = e.register_stellar_asset_contract_v2(owner.clone());

    let ndi_id = e.register(NdiToken, (owner.clone(),));
    let lending_id = e.register(
        NdiLending,
        (
            owner.clone(),
            usdc_sac.address(),
            String::from_str(&e, "Ndi USDC Vault"),
            String::from_str(&e, "nUSDC"),
            1_000_000 * UNIT,
            500_000_i128, // 5% APR
        ),
    );
    let staking_id = e.register(
        NdiStaking,
        (
            owner.clone(),
            lp_sac.address(),
            ndi_id.clone(),
            2_000_000_i128, // 20% APR in NDI
            UNIT,
            1_000_000 * UNIT,
            COOLDOWN,
        ),
    );

    Protocol {
        usdc: TokenClient::new(&e, &usdc_sac.address()),
        usdc_admin: StellarAssetClient::new(&e, &usdc_sac.address()),
        lp: TokenClient::new(&e, &lp_sac.address()),
        lp_admin: StellarAssetClient::new(&e, &lp_sac.address()),
        ndi: NdiTokenClient::new(&e, &ndi_id),
        lending: NdiLendingClient::new(&e, &lending_id),
        staking: NdiStakingClient::new(&e, &staking_id),
        e,
        owner,
    }
}

fn advance(e: &Env, seconds: u64) {
    let now = e.ledger().timestamp();
    e.ledger().set_timestamp(now + seconds);
}

#[test]
fn deposit_accrue_withdraw() {
    let p = deploy();
    let alice = Address::generate(&p.e);
    let desk = Address::generate(&p.e);
    p.usdc_admin.mint(&alice, &(10_000 * UNIT));
    p.usdc_admin.mint(&desk, &(1_000 * UNIT));

    let shares = p.lending.deposit(&(10_000 * UNIT), &alice, &alice, &alice);
    assert_eq!(shares, 10_000 * UNIT);

    p.lending.set_borrower(&Some(desk.clone()));
    p.lending.borrow(&(4_000 * UNIT));
    assert_eq!(p.usdc.balance(&desk), 5_000 * UNIT);

    advance(&p.e, SECONDS_PER_YEAR);
    // 5% on 4,000 for a year.
    assert_eq!(p.lending.total_debt(), 4_200 * UNIT);
    p.lending.repay(&desk, &(4_200 * UNIT));
    assert_eq!(p.lending.total_debt(), 0);

    let assets = p.lending.redeem(&shares, &alice, &alice, &alice);
    assert!((10_200 * UNIT - 1..=10_200 * UNIT).contains(&assets));
    assert_eq!(p.usdc.balance(&alice), assets);
    assert_eq!(p.lending.total_supply(), 0);
}

#[test]
fn stake_claim_unstake_with_ndi_rewards() {
    let p = deploy();
    let bob = Address::generate(&p.e);
    p.lp_admin.mint(&bob, &(1_000 * UNIT));

    // The owner seeds the NDI reward pool from the initial supply.
    p.staking.fund_rewards(&p.owner, &(100_000 * UNIT));
    assert_eq!(p.ndi.balance(&p.owner), INITIAL_SUPPLY - 100_000 * UNIT);

    p.staking.stake(&bob, &(1_000 * UNIT));
    advance(&p.e, SECONDS_PER_YEAR / 2);

    let claimed = p.staking.claim(&bob);
    assert_eq!(claimed, 100 * UNIT); // 20% APR for half a year on 1,000
    assert_eq!(p.ndi.balance(&bob), 100 * UNIT);

    p.staking.request_unstake(&bob);
    advance(&p.e, COOLDOWN);
    let (amount, reward) = p.staking.unstake(&bob);

    let total_earned = accrued_rewards(1_000 * UNIT, 2_000_000, SECONDS_PER_YEAR / 2 + COOLDOWN)
        .expect("no overflow");
    assert_eq!(amount, 1_000 * UNIT);
    assert_eq!(reward, total_earned - claimed);
    assert_eq!(p.lp.balance(&bob), 1_000 * UNIT);
    assert_eq!(p.ndi.balance(&bob), total_earned);
    assert_eq!(p.staking.total_staked(), 0);
}

#[test]
fn ndi_pause_blocks_staking_rewards() {
    let p = deploy();
    let bob = Address::generate(&p.e);
    p.lp_admin.mint(&bob, &(1_000 * UNIT));
    p.staking.fund_rewards(&p.owner, &(1_000 * UNIT));
    p.staking.stake(&bob, &(1_000 * UNIT));
    advance(&p.e, SECONDS_PER_YEAR);

    // Pausing NDI freezes transfers, so reward payouts fail...
    p.ndi.pause(&p.owner);
    assert!(p.staking.try_claim(&bob).is_err());
    // ...but emergency withdraw only moves LP tokens and still works.
    assert_eq!(p.staking.emergency_withdraw(&bob), 1_000 * UNIT);
    assert_eq!(p.lp.balance(&bob), 1_000 * UNIT);
}
