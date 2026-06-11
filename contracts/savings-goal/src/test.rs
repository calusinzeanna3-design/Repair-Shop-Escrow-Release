#![cfg(test)]
use super::*;
use soroban_sdk::Env;

fn setup(env: &Env) -> SavingsGoalContractClient {
    let contract_id = env.register(SavingsGoalContract, ());
    SavingsGoalContractClient::new(env, &contract_id)
}

#[test]
fn init_then_contribute_tracks_total() {
    let env = Env::default();
    let client = setup(&env);

    client.init(&1000);
    let state = client.get_state();
    assert_eq!(state.target, 1000);
    assert_eq!(state.saved, 0);

    assert_eq!(client.contribute(&250), 250);
    assert_eq!(client.contribute(&750), 1000);

    let state = client.get_state();
    assert_eq!(state.saved, 1000);
    assert_eq!(state.target, 1000);
}

#[test]
fn get_state_before_init_is_zero() {
    let env = Env::default();
    let client = setup(&env);
    let state = client.get_state();
    assert_eq!(state.saved, 0);
    assert_eq!(state.target, 0);
}

#[test]
fn double_init_fails() {
    let env = Env::default();
    let client = setup(&env);
    client.init(&1000);
    assert_eq!(client.try_init(&500), Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn contribute_before_init_fails() {
    let env = Env::default();
    let client = setup(&env);
    assert_eq!(client.try_contribute(&100), Err(Ok(Error::NotInitialized)));
}

#[test]
fn rejects_non_positive_amounts() {
    let env = Env::default();
    let client = setup(&env);
    client.init(&1000);
    assert_eq!(client.try_contribute(&0), Err(Ok(Error::InvalidAmount)));
    assert_eq!(client.try_contribute(&-5), Err(Ok(Error::InvalidAmount)));
}
