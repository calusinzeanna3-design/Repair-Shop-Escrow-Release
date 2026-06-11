#![no_std]
//! Savings Goal — a tiny Soroban contract for the StellarX PUP workshop.
//!
//! It tracks a savings *target* and the running *saved* total. It is deliberately
//! simple (plain integer state, no token transfers) so it always works in a live
//! demo. See the README for how to extend it to move real XLM/USDC.

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Env};

/// Snapshot of the goal, returned to the frontend.
#[contracttype]
#[derive(Clone)]
pub struct State {
    pub saved: i128,
    pub target: i128,
}

/// Keys for the contract's instance storage.
#[contracttype]
pub enum DataKey {
    Saved,
    Target,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidAmount = 3,
}

#[contract]
pub struct SavingsGoalContract;

#[contractimpl]
impl SavingsGoalContract {
    /// Set the savings target. Can only be called once.
    pub fn init(env: Env, target: i128) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Target) {
            return Err(Error::AlreadyInitialized);
        }
        if target <= 0 {
            return Err(Error::InvalidAmount);
        }
        env.storage().instance().set(&DataKey::Target, &target);
        env.storage().instance().set(&DataKey::Saved, &0i128);
        env.storage().instance().extend_ttl(1000, 5000);
        Ok(())
    }

    /// Add `amount` to the saved total. Returns the new saved total.
    pub fn contribute(env: Env, amount: i128) -> Result<i128, Error> {
        if !env.storage().instance().has(&DataKey::Target) {
            return Err(Error::NotInitialized);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let saved: i128 = env.storage().instance().get(&DataKey::Saved).unwrap_or(0);
        let new_saved = saved + amount;
        env.storage().instance().set(&DataKey::Saved, &new_saved);
        env.storage().instance().extend_ttl(1000, 5000);
        Ok(new_saved)
    }

    /// Read the current saved + target. Returns zeros if not initialised yet.
    pub fn get_state(env: Env) -> State {
        State {
            saved: env.storage().instance().get(&DataKey::Saved).unwrap_or(0),
            target: env.storage().instance().get(&DataKey::Target).unwrap_or(0),
        }
    }
}

mod test;
