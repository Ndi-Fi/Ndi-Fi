extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Address, Env, Error, Event, IntoVal, String, Val, Vec,
};

use crate::{
    interest::SECONDS_PER_YEAR, Borrowed, LendingError, NdiLending, NdiLendingClient, Repaid,
};

const UNIT: i128 = 10_000_000;
const CAP: i128 = 100_000 * UNIT;
/// 10% APR scaled by 1e7.
const RATE: i128 = 1_000_000;
const PAUSED: Error = Error::from_contract_error(1000);

fn err(code: LendingError) -> Error {
    Error::from_contract_error(code as u32)
}

struct Setup<'a> {
    e: Env,
    owner: Address,
    user: Address,
    borrower: Address,
    id: Address,
    asset: TokenClient<'a>,
    asset_admin: StellarAssetClient<'a>,
    vault: NdiLendingClient<'a>,
}

fn setup<'a>() -> Setup<'a> {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().set_timestamp(1_000);
    let owner = Address::generate(&e);
    let user = Address::generate(&e);
    let borrower = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(owner.clone());
    let asset = TokenClient::new(&e, &sac.address());
    let asset_admin = StellarAssetClient::new(&e, &sac.address());
    asset_admin.mint(&user, &(10_000 * UNIT));
    asset_admin.mint(&borrower, &(10_000 * UNIT));

    let id = e.register(
        NdiLending,
        (
            owner.clone(),
            sac.address(),
            String::from_str(&e, "Ndi Lending Share"),
            String::from_str(&e, "nLEND"),
            CAP,
            RATE,
        ),
    );
    let vault = NdiLendingClient::new(&e, &id);
    Setup {
        e,
        owner,
        user,
        borrower,
        id,
        asset,
        asset_admin,
        vault,
    }
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

fn deposit(s: &Setup, amount: i128) -> i128 {
    s.vault.deposit(&amount, &s.user, &s.user, &s.user)
}

fn advance(s: &Setup, seconds: u64) {
    let now = s.e.ledger().timestamp();
    s.e.ledger().set_timestamp(now + seconds);
}

#[test]
fn constructor_sets_config() {
    let s = setup();
    assert_eq!(s.vault.query_asset(), s.asset.address);
    assert_eq!(s.vault.decimals(), 7);
    assert_eq!(s.vault.deposit_cap(), CAP);
    assert_eq!(s.vault.interest_rate(), RATE);
    assert_eq!(s.vault.get_owner(), Some(s.owner.clone()));
    assert_eq!(s.vault.borrower(), None);
    assert_eq!(s.vault.total_assets(), 0);
    assert_eq!(s.vault.symbol(), String::from_str(&s.e, "nLEND"));
}

#[test]
fn deposit_then_withdraw() {
    let s = setup();
    let shares = deposit(&s, 1_000 * UNIT);
    assert_eq!(shares, 1_000 * UNIT);
    assert_eq!(s.vault.balance(&s.user), 1_000 * UNIT);
    assert_eq!(s.vault.total_assets(), 1_000 * UNIT);
    assert_eq!(s.asset.balance(&s.id), 1_000 * UNIT);

    let burned = s.vault.withdraw(&(400 * UNIT), &s.user, &s.user, &s.user);
    assert_eq!(burned, 400 * UNIT);
    assert_eq!(s.vault.balance(&s.user), 600 * UNIT);
    assert_eq!(s.asset.balance(&s.user), 9_400 * UNIT);
}

#[test]
fn mint_then_redeem() {
    let s = setup();
    let paid = s.vault.mint(&(500 * UNIT), &s.user, &s.user, &s.user);
    assert_eq!(paid, 500 * UNIT);
    let assets = s.vault.redeem(&(500 * UNIT), &s.user, &s.user, &s.user);
    assert_eq!(assets, 500 * UNIT);
    assert_eq!(s.vault.balance(&s.user), 0);
    assert_eq!(s.asset.balance(&s.user), 10_000 * UNIT);
}

#[test]
fn deposit_emits_vault_event() {
    let s = setup();
    deposit(&s, 10 * UNIT);
    let expected = stellar_tokens::vault::Deposit {
        operator: s.user.clone(),
        from: s.user.clone(),
        receiver: s.user.clone(),
        assets: 10 * UNIT,
        shares: 10 * UNIT,
    }
    .to_xdr(&s.e, &s.id);
    assert!(s.e.events().all().events().contains(&expected));
}

#[test]
fn zero_amounts_are_rejected() {
    let s = setup();
    let u = &s.user;
    assert_eq!(
        s.vault.try_deposit(&0, u, u, u),
        Err(Ok(err(LendingError::InvalidAmount)))
    );
    assert_eq!(
        s.vault.try_mint(&0, u, u, u),
        Err(Ok(err(LendingError::InvalidAmount)))
    );
    assert_eq!(
        s.vault.try_withdraw(&0, u, u, u),
        Err(Ok(err(LendingError::InvalidAmount)))
    );
    assert_eq!(
        s.vault.try_redeem(&0, u, u, u),
        Err(Ok(err(LendingError::InvalidAmount)))
    );
    assert_eq!(s.vault.try_borrow(&0), Err(Ok(LendingError::NoBorrower)));
    s.vault.set_borrower(&Some(s.borrower.clone()));
    assert_eq!(s.vault.try_borrow(&0), Err(Ok(LendingError::InvalidAmount)));
    assert_eq!(
        s.vault.try_repay(&s.borrower, &0),
        Err(Ok(LendingError::InvalidAmount))
    );
}

#[test]
fn deposit_over_cap_fails() {
    let s = setup();
    s.vault.set_deposit_cap(&(1_000 * UNIT));
    deposit(&s, 900 * UNIT);
    assert_eq!(s.vault.max_deposit(&s.user), 100 * UNIT);
    let u = &s.user;
    assert_eq!(
        s.vault.try_deposit(&(101 * UNIT), u, u, u),
        Err(Ok(err(LendingError::DepositCapExceeded)))
    );
}

#[test]
fn withdraw_or_redeem_more_than_balance_fails() {
    let s = setup();
    deposit(&s, 100 * UNIT);
    let u = &s.user;
    assert_eq!(
        s.vault.try_withdraw(&(101 * UNIT), u, u, u),
        Err(Ok(err(LendingError::InsufficientShares)))
    );
    assert_eq!(
        s.vault.try_redeem(&(101 * UNIT), u, u, u),
        Err(Ok(err(LendingError::InsufficientShares)))
    );
}

#[test]
fn deposit_requires_operator_auth() {
    let s = setup();
    let attacker = Address::generate(&s.e);
    let args = (100_i128, &attacker, &s.user, &s.user).into_val(&s.e);
    sign_as(&s, &attacker, "deposit", args);
    assert!(s
        .vault
        .try_deposit(&100, &attacker, &s.user, &s.user)
        .is_err());
    assert_eq!(s.vault.balance(&attacker), 0);
}

#[test]
fn withdraw_by_other_operator_needs_share_allowance() {
    let s = setup();
    deposit(&s, 100 * UNIT);
    let spender = Address::generate(&s.e);
    assert!(s
        .vault
        .try_withdraw(&(10 * UNIT), &spender, &s.user, &spender)
        .is_err());

    let ledger = s.e.ledger().sequence();
    s.vault
        .approve(&s.user, &spender, &(10 * UNIT), &(ledger + 100));
    s.vault.withdraw(&(10 * UNIT), &spender, &s.user, &spender);
    assert_eq!(s.asset.balance(&spender), 10 * UNIT);
}

#[test]
fn admin_functions_require_owner() {
    let s = setup();
    let attacker = Address::generate(&s.e);

    sign_as(&s, &attacker, "set_deposit_cap", (1_i128,).into_val(&s.e));
    assert!(s.vault.try_set_deposit_cap(&1).is_err());

    let some_attacker = Some(attacker.clone());
    sign_as(
        &s,
        &attacker,
        "set_borrower",
        (&some_attacker,).into_val(&s.e),
    );
    assert!(s.vault.try_set_borrower(&some_attacker).is_err());

    sign_as(&s, &attacker, "set_interest_rate", (0_i128,).into_val(&s.e));
    assert!(s.vault.try_set_interest_rate(&0).is_err());

    sign_as(&s, &attacker, "pause", (&attacker,).into_val(&s.e));
    assert!(s.vault.try_pause(&attacker).is_err());

    s.e.mock_all_auths();
    assert_eq!(s.vault.deposit_cap(), CAP);
    assert_eq!(s.vault.borrower(), None);
    assert_eq!(s.vault.interest_rate(), RATE);
    assert!(!s.vault.paused());
}

#[test]
fn borrow_requires_borrower_auth() {
    let s = setup();
    deposit(&s, 1_000 * UNIT);
    s.vault.set_borrower(&Some(s.borrower.clone()));
    let attacker = Address::generate(&s.e);
    sign_as(&s, &attacker, "borrow", (100_i128,).into_val(&s.e));
    assert!(s.vault.try_borrow(&100).is_err());
    s.e.mock_all_auths();
    assert_eq!(s.vault.total_debt(), 0);
}

#[test]
fn paused_vault_blocks_user_flows_but_allows_repay() {
    let s = setup();
    deposit(&s, 1_000 * UNIT);
    s.vault.set_borrower(&Some(s.borrower.clone()));
    s.vault.borrow(&(100 * UNIT));

    s.vault.pause(&s.owner);
    let u = &s.user;
    assert_eq!(s.vault.try_deposit(&1, u, u, u), Err(Ok(PAUSED)));
    assert_eq!(s.vault.try_mint(&1, u, u, u), Err(Ok(PAUSED)));
    assert_eq!(s.vault.try_withdraw(&1, u, u, u), Err(Ok(PAUSED)));
    assert_eq!(s.vault.try_redeem(&1, u, u, u), Err(Ok(PAUSED)));
    assert!(s.vault.try_borrow(&1).is_err());
    assert_eq!(s.vault.max_deposit(u), 0);
    assert_eq!(s.vault.max_withdraw(u), 0);
    assert_eq!(s.vault.max_redeem(u), 0);

    // Repaying while paused is allowed: it only reduces risk.
    s.vault.repay(&s.borrower, &(100 * UNIT));
    assert_eq!(s.vault.total_debt(), 0);

    s.vault.unpause(&s.owner);
    deposit(&s, 1);
}

#[test]
fn interest_accrues_and_raises_share_price() {
    let s = setup();
    deposit(&s, 1_000 * UNIT);
    s.vault.set_borrower(&Some(s.borrower.clone()));
    s.vault.borrow(&(500 * UNIT));
    assert_eq!(s.vault.available_liquidity(), 500 * UNIT);
    // Lent-out funds still count toward the share price.
    assert_eq!(s.vault.total_assets(), 1_000 * UNIT);

    advance(&s, SECONDS_PER_YEAR);
    // 10% of 500 over one year.
    assert_eq!(s.vault.total_debt(), 550 * UNIT);
    assert_eq!(s.vault.total_assets(), 1_050 * UNIT);

    let remaining = s.vault.repay(&s.borrower, &(1_000 * UNIT));
    assert_eq!(remaining, 0);
    // Only the debt is taken, not the full 1,000 offered.
    assert_eq!(s.asset.balance(&s.borrower), 10_000 * UNIT - 50 * UNIT);
    assert_eq!(s.vault.available_liquidity(), 1_050 * UNIT);

    let shares = s.vault.balance(&s.user);
    let assets = s.vault.redeem(&shares, &s.user, &s.user, &s.user);
    // Virtual share/asset rounding may keep at most one stroop in the vault.
    assert!((1_050 * UNIT - 1..=1_050 * UNIT).contains(&assets));
}

#[test]
fn interest_compounds_on_each_accrual() {
    let s = setup();
    deposit(&s, 1_000 * UNIT);
    s.vault.set_borrower(&Some(s.borrower.clone()));
    s.vault.borrow(&(100 * UNIT));

    advance(&s, SECONDS_PER_YEAR / 2);
    // Touching the debt capitalises 5 units of interest.
    s.vault.repay(&s.borrower, &1);
    advance(&s, SECONDS_PER_YEAR / 2);
    let debt = s.vault.total_debt();
    // (105 - tiny) * 1.05 ≈ 110.25, above simple interest (110).
    assert!(debt > 110 * UNIT && debt < 111 * UNIT);
}

#[test]
fn rate_change_accrues_at_old_rate_first() {
    let s = setup();
    deposit(&s, 1_000 * UNIT);
    s.vault.set_borrower(&Some(s.borrower.clone()));
    s.vault.borrow(&(100 * UNIT));
    advance(&s, SECONDS_PER_YEAR);
    s.vault.set_interest_rate(&0);
    advance(&s, SECONDS_PER_YEAR);
    assert_eq!(s.vault.total_debt(), 110 * UNIT);
    assert_eq!(s.vault.interest_rate(), 0);
}

#[test]
fn invalid_admin_values_are_rejected() {
    let s = setup();
    assert_eq!(
        s.vault.try_set_interest_rate(&-1),
        Err(Ok(LendingError::InvalidRate))
    );
    assert_eq!(
        s.vault.try_set_interest_rate(&(10_000_000 + 1)),
        Err(Ok(LendingError::InvalidRate))
    );
    assert_eq!(
        s.vault.try_set_deposit_cap(&0),
        Err(Ok(LendingError::InvalidCap))
    );
}

#[test]
fn borrow_more_than_liquidity_fails() {
    let s = setup();
    deposit(&s, 100 * UNIT);
    s.vault.set_borrower(&Some(s.borrower.clone()));
    assert_eq!(
        s.vault.try_borrow(&(101 * UNIT)),
        Err(Ok(LendingError::InsufficientLiquidity))
    );
}

#[test]
fn withdraw_limited_by_idle_liquidity() {
    let s = setup();
    deposit(&s, 100 * UNIT);
    s.vault.set_borrower(&Some(s.borrower.clone()));
    s.vault.borrow(&(80 * UNIT));
    assert_eq!(s.vault.max_withdraw(&s.user), 20 * UNIT);
    let u = &s.user;
    assert_eq!(
        s.vault.try_withdraw(&(21 * UNIT), u, u, u),
        Err(Ok(err(LendingError::InsufficientLiquidity)))
    );
    s.vault.withdraw(&(20 * UNIT), u, u, u);
}

#[test]
fn borrow_and_repay_emit_events() {
    let s = setup();
    deposit(&s, 100 * UNIT);
    s.vault.set_borrower(&Some(s.borrower.clone()));

    s.vault.borrow(&(10 * UNIT));
    let borrowed = Borrowed {
        borrower: s.borrower.clone(),
        amount: 10 * UNIT,
        total_debt: 10 * UNIT,
    }
    .to_xdr(&s.e, &s.id);
    assert!(s.e.events().all().events().contains(&borrowed));

    s.vault.repay(&s.borrower, &(10 * UNIT));
    let repaid = Repaid {
        from: s.borrower.clone(),
        amount: 10 * UNIT,
        remaining_debt: 0,
    }
    .to_xdr(&s.e, &s.id);
    assert!(s.e.events().all().events().contains(&repaid));
}

#[test]
fn repay_without_debt_fails() {
    let s = setup();
    assert_eq!(
        s.vault.try_repay(&s.borrower, &1),
        Err(Ok(LendingError::NoDebt))
    );
}

#[test]
fn borrower_cannot_change_with_outstanding_debt() {
    let s = setup();
    deposit(&s, 100 * UNIT);
    s.vault.set_borrower(&Some(s.borrower.clone()));
    s.vault.borrow(&UNIT);
    assert_eq!(
        s.vault.try_set_borrower(&None),
        Err(Ok(LendingError::DebtOutstanding))
    );
    s.vault.repay(&s.borrower, &UNIT);
    s.vault.set_borrower(&None);
    assert_eq!(s.vault.borrower(), None);
}

#[test]
fn emergency_withdraw_only_when_paused() {
    let s = setup();
    deposit(&s, 300 * UNIT);
    let safe = Address::generate(&s.e);
    assert!(s.vault.try_emergency_withdraw(&safe).is_err());

    s.vault.pause(&s.owner);
    let swept = s.vault.emergency_withdraw(&safe);
    assert_eq!(swept, 300 * UNIT);
    assert_eq!(s.asset.balance(&safe), 300 * UNIT);
    assert_eq!(s.vault.available_liquidity(), 0);
}

#[test]
fn emergency_withdraw_requires_owner() {
    let s = setup();
    deposit(&s, 10 * UNIT);
    s.vault.pause(&s.owner);
    let attacker = Address::generate(&s.e);
    sign_as(
        &s,
        &attacker,
        "emergency_withdraw",
        (&attacker,).into_val(&s.e),
    );
    assert!(s.vault.try_emergency_withdraw(&attacker).is_err());
}

#[test]
fn utilization_view() {
    let s = setup();
    deposit(&s, 100 * UNIT);
    assert_eq!(s.vault.utilization(), 0);
    s.vault.set_borrower(&Some(s.borrower.clone()));
    s.vault.borrow(&(25 * UNIT));
    assert_eq!(s.vault.utilization(), 2_500_000);
}

#[test]
fn second_depositor_gets_fair_shares_after_interest() {
    let s = setup();
    deposit(&s, 1_000 * UNIT);
    s.vault.set_borrower(&Some(s.borrower.clone()));
    s.vault.borrow(&(1_000 * UNIT));
    advance(&s, SECONDS_PER_YEAR);
    // Share price is now ~1.1; a new 110-unit deposit gets ~100 shares.
    let late = Address::generate(&s.e);
    s.asset_admin.mint(&late, &(110 * UNIT));
    let shares = s.vault.deposit(&(110 * UNIT), &late, &late, &late);
    assert!(shares > 99 * UNIT && shares <= 100 * UNIT);
}
