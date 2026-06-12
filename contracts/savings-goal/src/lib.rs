#![no_std]
//! Repair Escrow - a Soroban contract for quoted phone/appliance repair jobs.
//!
//! The contract owns only the payment state. Repair notes, photos, messages, and
//! dispute evidence should live off-chain and be referenced by `metadata_uri`.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, String,
};

pub const STATUS_CREATED: u32 = 0;
pub const STATUS_FUNDED: u32 = 1;
pub const STATUS_COMPLETED: u32 = 2;
pub const STATUS_RELEASED: u32 = 3;
pub const STATUS_DISPUTED: u32 = 4;
pub const STATUS_REFUNDED: u32 = 5;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Job {
    pub id: u32,
    pub customer: Address,
    pub technician: Address,
    pub token: Address,
    pub amount: i128,
    pub status: u32,
    pub metadata_uri: String,
    pub created_at: u64,
    pub completed_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    NextJobId,
    Job(u32),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidAmount = 3,
    JobNotFound = 4,
    InvalidStatus = 5,
    Unauthorized = 6,
}

#[contract]
pub struct RepairEscrowContract;

#[contractimpl]
impl RepairEscrowContract {
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextJobId, &1u32);
        extend_instance_ttl(&env);
        Ok(())
    }

    pub fn create_job(
        env: Env,
        customer: Address,
        technician: Address,
        token: Address,
        amount: i128,
        metadata_uri: String,
    ) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        customer.require_auth();

        let id = next_job_id(&env);
        let job = Job {
            id,
            customer: customer.clone(),
            technician: technician.clone(),
            token,
            amount,
            status: STATUS_CREATED,
            metadata_uri,
            created_at: env.ledger().timestamp(),
            completed_at: 0,
        };

        env.storage().persistent().set(&DataKey::Job(id), &job);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Job(id), 1000, 5000);
        env.events()
            .publish(("job_created", id), (customer, technician, amount));
        Ok(id)
    }

    pub fn fund_job(env: Env, job_id: u32) -> Result<Job, Error> {
        let mut job = get_existing_job(&env, job_id)?;
        if job.status != STATUS_CREATED {
            return Err(Error::InvalidStatus);
        }

        job.customer.require_auth();
        token::Client::new(&env, &job.token).transfer(
            &job.customer,
            &env.current_contract_address(),
            &job.amount,
        );

        job.status = STATUS_FUNDED;
        save_job(&env, &job);
        env.events().publish(("job_funded", job_id), job.amount);
        Ok(job)
    }

    pub fn mark_complete(env: Env, job_id: u32) -> Result<Job, Error> {
        let mut job = get_existing_job(&env, job_id)?;
        if job.status != STATUS_FUNDED {
            return Err(Error::InvalidStatus);
        }

        job.technician.require_auth();
        job.status = STATUS_COMPLETED;
        job.completed_at = env.ledger().timestamp();
        save_job(&env, &job);
        env.events()
            .publish(("job_completed", job_id), job.completed_at);
        Ok(job)
    }

    pub fn approve_release(env: Env, job_id: u32) -> Result<Job, Error> {
        let mut job = get_existing_job(&env, job_id)?;
        if job.status != STATUS_COMPLETED {
            return Err(Error::InvalidStatus);
        }

        job.customer.require_auth();
        token::Client::new(&env, &job.token).transfer(
            &env.current_contract_address(),
            &job.technician,
            &job.amount,
        );

        job.status = STATUS_RELEASED;
        save_job(&env, &job);
        env.events()
            .publish(("release_approved", job_id), job.amount);
        Ok(job)
    }

    pub fn open_dispute(env: Env, job_id: u32) -> Result<Job, Error> {
        let mut job = get_existing_job(&env, job_id)?;
        if job.status != STATUS_FUNDED && job.status != STATUS_COMPLETED {
            return Err(Error::InvalidStatus);
        }

        job.customer.require_auth();
        job.status = STATUS_DISPUTED;
        save_job(&env, &job);
        env.events().publish(("dispute_opened", job_id), job.amount);
        Ok(job)
    }

    pub fn refund(env: Env, job_id: u32) -> Result<Job, Error> {
        let admin = get_admin(&env)?;
        let mut job = get_existing_job(&env, job_id)?;
        if job.status != STATUS_DISPUTED {
            return Err(Error::InvalidStatus);
        }

        admin.require_auth();
        token::Client::new(&env, &job.token).transfer(
            &env.current_contract_address(),
            &job.customer,
            &job.amount,
        );

        job.status = STATUS_REFUNDED;
        save_job(&env, &job);
        env.events().publish(("job_refunded", job_id), job.amount);
        Ok(job)
    }

    pub fn get_job(env: Env, job_id: u32) -> Result<Job, Error> {
        get_existing_job(&env, job_id)
    }

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        get_admin(&env)
    }
}

fn ensure_initialized(env: &Env) -> Result<(), Error> {
    if !env.storage().instance().has(&DataKey::Admin) {
        return Err(Error::NotInitialized);
    }
    Ok(())
}

fn get_admin(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)
}

fn next_job_id(env: &Env) -> u32 {
    let id = env
        .storage()
        .instance()
        .get(&DataKey::NextJobId)
        .unwrap_or(1u32);
    env.storage().instance().set(&DataKey::NextJobId, &(id + 1));
    extend_instance_ttl(env);
    id
}

fn get_existing_job(env: &Env, job_id: u32) -> Result<Job, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Job(job_id))
        .ok_or(Error::JobNotFound)
}

fn save_job(env: &Env, job: &Job) {
    let key = DataKey::Job(job.id);
    env.storage().persistent().set(&key, job);
    env.storage().persistent().extend_ttl(&key, 1000, 5000);
    extend_instance_ttl(env);
}

fn extend_instance_ttl(env: &Env) {
    env.storage().instance().extend_ttl(1000, 5000);
}

mod test;
