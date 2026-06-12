#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env, String};

struct TestData {
    env: Env,
    client: RepairEscrowContractClient<'static>,
    escrow: Address,
    token: Address,
    token_client: token::Client<'static>,
    customer: Address,
    technician: Address,
}

fn setup() -> TestData {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let customer = Address::generate(&env);
    let technician = Address::generate(&env);

    let contract_id = env.register(RepairEscrowContract, ());
    let client = RepairEscrowContractClient::new(&env, &contract_id);

    let token_contract = env.register_stellar_asset_contract_v2(admin.clone());
    let token = token_contract.address();
    let token_admin = token::StellarAssetClient::new(&env, &token);
    let token_client = token::Client::new(&env, &token);

    client.init(&admin);
    token_admin.mint(&customer, &1_000);

    TestData {
        env,
        client,
        escrow: contract_id,
        token,
        token_client,
        customer,
        technician,
    }
}

fn create_job(data: &TestData, amount: i128) -> u32 {
    data.client.create_job(
        &data.customer,
        &data.technician,
        &data.token,
        &amount,
        &String::from_str(&data.env, "quote://repair-001"),
    )
}

#[test]
fn create_fund_complete_and_release_moves_funds_to_technician() {
    let data = setup();
    let job_id = create_job(&data, 250);

    let job = data.client.fund_job(&job_id);
    assert_eq!(job.status, STATUS_FUNDED);
    assert_eq!(data.token_client.balance(&data.customer), 750);
    assert_eq!(data.token_client.balance(&data.escrow), 250);

    let job = data.client.mark_complete(&job_id);
    assert_eq!(job.status, STATUS_COMPLETED);

    let job = data.client.approve_release(&job_id);
    assert_eq!(job.status, STATUS_RELEASED);
    assert_eq!(data.token_client.balance(&data.technician), 250);
}

#[test]
fn dispute_then_admin_refund_returns_funds_to_customer() {
    let data = setup();
    let job_id = create_job(&data, 300);

    data.client.fund_job(&job_id);
    let job = data.client.open_dispute(&job_id);
    assert_eq!(job.status, STATUS_DISPUTED);

    let job = data.client.refund(&job_id);
    assert_eq!(job.status, STATUS_REFUNDED);
    assert_eq!(data.token_client.balance(&data.customer), 1_000);
    assert_eq!(data.token_client.balance(&data.technician), 0);
}

#[test]
fn rejects_invalid_state_transitions() {
    let data = setup();
    let job_id = create_job(&data, 100);

    assert_eq!(
        data.client.try_mark_complete(&job_id),
        Err(Ok(Error::InvalidStatus))
    );

    data.client.fund_job(&job_id);
    assert_eq!(
        data.client.try_approve_release(&job_id),
        Err(Ok(Error::InvalidStatus))
    );
}

#[test]
fn create_requires_positive_amount() {
    let data = setup();

    assert_eq!(
        data.client.try_create_job(
            &data.customer,
            &data.technician,
            &data.token,
            &0,
            &String::from_str(&data.env, "quote://bad"),
        ),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn get_missing_job_fails() {
    let data = setup();
    assert_eq!(data.client.try_get_job(&404), Err(Ok(Error::JobNotFound)));
}
