extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _, MockAuth, MockAuthInvoke},
    token::StellarAssetClient,
    vec, Address, Env, Error, Event, IntoVal, String,
};

use crate::{
    NdiToken, NdiTokenClient, RewardDistributed, TokenError, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
};

const UNIT: i128 = 10_000_000;
const PAUSED: Error = Error::from_contract_error(1000);

struct Setup<'a> {
    e: Env,
    owner: Address,
    id: Address,
    token: NdiTokenClient<'a>,
}

fn setup<'a>() -> Setup<'a> {
    let e = Env::default();
    e.mock_all_auths();
    let owner = Address::generate(&e);
    let id = e.register(NdiToken, (owner.clone(),));
    let token = NdiTokenClient::new(&e, &id);
    Setup {
        e,
        owner,
        id,
        token,
    }
}

/// Replaces blanket auth mocking with a single signature from `signer`.
fn sign_as(s: &Setup, signer: &Address, fn_name: &str, args: soroban_sdk::Vec<soroban_sdk::Val>) {
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
fn constructor_sets_metadata_owner_and_initial_supply() {
    let s = setup();
    assert_eq!(s.token.name(), String::from_str(&s.e, "Ndi-Point"));
    assert_eq!(s.token.symbol(), String::from_str(&s.e, "NDI"));
    assert_eq!(s.token.decimals(), DECIMALS);
    assert_eq!(s.token.get_owner(), Some(s.owner.clone()));
    assert_eq!(s.token.total_supply(), INITIAL_SUPPLY);
    assert_eq!(s.token.balance(&s.owner), INITIAL_SUPPLY);
    assert_eq!(s.token.cap(), MAX_SUPPLY);
    assert_eq!(s.token.max_supply(), MAX_SUPPLY);
    assert_eq!(s.token.remaining_supply(), MAX_SUPPLY - INITIAL_SUPPLY);
}

#[test]
fn owner_can_mint() {
    let s = setup();
    let user = Address::generate(&s.e);
    s.token.mint(&user, &(1_000 * UNIT));
    assert_eq!(s.token.balance(&user), 1_000 * UNIT);
    assert_eq!(s.token.total_supply(), INITIAL_SUPPLY + 1_000 * UNIT);
}

#[test]
fn mint_requires_owner_auth() {
    let s = setup();
    let attacker = Address::generate(&s.e);
    sign_as(&s, &attacker, "mint", (&attacker, 1_i128).into_val(&s.e));
    assert!(s.token.try_mint(&attacker, &1).is_err());
    assert_eq!(s.token.balance(&attacker), 0);
}

#[test]
fn mint_rejects_zero_amount() {
    let s = setup();
    let user = Address::generate(&s.e);
    assert_eq!(
        s.token.try_mint(&user, &0),
        Err(Ok(TokenError::InvalidAmount))
    );
}

#[test]
fn mint_cannot_exceed_max_supply() {
    let s = setup();
    let user = Address::generate(&s.e);
    let room = s.token.remaining_supply();
    s.token.mint(&user, &room);
    assert_eq!(s.token.remaining_supply(), 0);
    assert_eq!(
        s.token.try_mint(&user, &1),
        Err(Ok(TokenError::ExceedsMaxSupply))
    );
}

#[test]
fn transfer_and_transfer_from() {
    let s = setup();
    let alice = Address::generate(&s.e);
    let bob = Address::generate(&s.e);
    s.token.transfer(&s.owner, &alice, &(100 * UNIT));
    assert_eq!(s.token.balance(&alice), 100 * UNIT);

    let ledger = s.e.ledger().sequence();
    s.token.approve(&alice, &bob, &(40 * UNIT), &(ledger + 100));
    s.token.transfer_from(&bob, &alice, &bob, &(40 * UNIT));
    assert_eq!(s.token.balance(&bob), 40 * UNIT);
    assert_eq!(s.token.allowance(&alice, &bob), 0);
}

#[test]
fn transfer_more_than_balance_fails() {
    let s = setup();
    let alice = Address::generate(&s.e);
    let bob = Address::generate(&s.e);
    s.token.transfer(&s.owner, &alice, &10);
    assert!(s.token.try_transfer(&alice, &bob, &11).is_err());
}

#[test]
fn burn_reduces_supply() {
    let s = setup();
    s.token.burn(&s.owner, &(1_000 * UNIT));
    assert_eq!(s.token.total_supply(), INITIAL_SUPPLY - 1_000 * UNIT);
    assert_eq!(s.token.balance(&s.owner), INITIAL_SUPPLY - 1_000 * UNIT);
}

#[test]
fn pause_blocks_transfers_burns_and_mints() {
    let s = setup();
    let user = Address::generate(&s.e);
    s.token.pause(&s.owner);
    assert!(s.token.paused());

    assert_eq!(s.token.try_transfer(&s.owner, &user, &1), Err(Ok(PAUSED)));
    assert_eq!(s.token.try_burn(&s.owner, &1), Err(Ok(PAUSED)));
    assert!(s.token.try_mint(&user, &1).is_err());
    assert!(s
        .token
        .try_distribute_reward(&user, &1, &String::from_str(&s.e, "x"))
        .is_err());

    s.token.unpause(&s.owner);
    s.token.transfer(&s.owner, &user, &1);
    assert_eq!(s.token.balance(&user), 1);
}

#[test]
fn pause_requires_owner_auth() {
    let s = setup();
    let attacker = Address::generate(&s.e);
    sign_as(&s, &attacker, "pause", (&attacker,).into_val(&s.e));
    assert!(s.token.try_pause(&attacker).is_err());
    assert!(!s.token.paused());
}

#[test]
fn distribute_reward_mints_records_time_and_emits_event() {
    let s = setup();
    let user = Address::generate(&s.e);
    s.e.ledger().set_timestamp(12_345);
    let reason = String::from_str(&s.e, "liquidity mining");

    s.token.distribute_reward(&user, &(5 * UNIT), &reason);

    let expected = RewardDistributed {
        recipient: user.clone(),
        amount: 5 * UNIT,
        reason: reason.clone(),
    }
    .to_xdr(&s.e, &s.id);
    assert!(s.e.events().all().events().contains(&expected));
    assert_eq!(s.token.balance(&user), 5 * UNIT);
    assert_eq!(s.token.last_reward_at(&user), 12_345);
}

#[test]
fn distribute_reward_rejects_zero_amount() {
    let s = setup();
    let user = Address::generate(&s.e);
    let reason = String::from_str(&s.e, "x");
    assert_eq!(
        s.token.try_distribute_reward(&user, &0, &reason),
        Err(Ok(TokenError::InvalidAmount))
    );
}

#[test]
fn distribute_rewards_batch() {
    let s = setup();
    let a = Address::generate(&s.e);
    let b = Address::generate(&s.e);
    let reason = String::from_str(&s.e, "epoch 1");
    s.token.distribute_rewards(
        &vec![&s.e, a.clone(), b.clone()],
        &vec![&s.e, 3 * UNIT, 7 * UNIT],
        &reason,
    );
    assert_eq!(s.token.balance(&a), 3 * UNIT);
    assert_eq!(s.token.balance(&b), 7 * UNIT);
}

#[test]
fn distribute_rewards_validates_input() {
    let s = setup();
    let a = Address::generate(&s.e);
    let reason = String::from_str(&s.e, "x");
    assert_eq!(
        s.token
            .try_distribute_rewards(&vec![&s.e, a.clone()], &vec![&s.e, 1, 2], &reason),
        Err(Ok(TokenError::LengthMismatch))
    );
    assert_eq!(
        s.token
            .try_distribute_rewards(&vec![&s.e], &vec![&s.e], &reason),
        Err(Ok(TokenError::EmptyBatch))
    );
    assert_eq!(
        s.token
            .try_distribute_rewards(&vec![&s.e, a.clone()], &vec![&s.e, 0], &reason),
        Err(Ok(TokenError::InvalidAmount))
    );
    let too_much = s.token.remaining_supply() + 1;
    assert_eq!(
        s.token
            .try_distribute_rewards(&vec![&s.e, a], &vec![&s.e, too_much], &reason),
        Err(Ok(TokenError::ExceedsMaxSupply))
    );
}

#[test]
fn recover_tokens_sends_foreign_tokens() {
    let s = setup();
    let sac_admin = Address::generate(&s.e);
    let foreign = s.e.register_stellar_asset_contract_v2(sac_admin);
    StellarAssetClient::new(&s.e, &foreign.address()).mint(&s.id, &500);
    let to = Address::generate(&s.e);

    s.token.recover_tokens(&foreign.address(), &to, &500);
    assert_eq!(
        soroban_sdk::token::TokenClient::new(&s.e, &foreign.address()).balance(&to),
        500
    );
}

#[test]
fn recover_tokens_rejects_own_token() {
    let s = setup();
    let to = Address::generate(&s.e);
    assert_eq!(
        s.token.try_recover_tokens(&s.id, &to, &1),
        Err(Ok(TokenError::CannotRecoverSelf))
    );
}

#[test]
fn ownership_transfer_two_step() {
    let s = setup();
    let new_owner = Address::generate(&s.e);
    let ledger = s.e.ledger().sequence();
    s.token.transfer_ownership(&new_owner, &(ledger + 100));
    s.token.accept_ownership();
    assert_eq!(s.token.get_owner(), Some(new_owner));
}
