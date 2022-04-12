use crate::history::History;
use crate::Pubkey;
use crate::{AnchorDeserialize, AnchorSerialize};
use anchor_lang::solana_program::clock::UnixTimestamp;

#[derive(Default, Debug, AnchorSerialize, AnchorDeserialize, Copy, Clone)]
pub struct Params {
    pub reward_mint: Pubkey,
    pub period: i64,
    pub units_per_token: u64,
    pub rewards_per_unit: u64,
}

impl Params {
    pub fn space() -> usize {
        32 + 8 + 8 + 8
    }
}
#[derive(Debug, AnchorSerialize, AnchorDeserialize, Copy, Clone)]
pub enum RewardPolicy {
    DirectSameToken = 0,
    DirectAnotherToken = 1,
    PercentUserStake = 2,
    PercentPool = 3,
}

impl From<u8> for RewardPolicy {
    fn from(input: u8) -> Self {
        let keys = [
            RewardPolicy::DirectSameToken,
            RewardPolicy::DirectAnotherToken,
            RewardPolicy::PercentUserStake,
            RewardPolicy::PercentPool,
        ];
        let values = [0u8, 1, 2, 3];
        // todo use try_from then return error in case of error
        let idx = values.binary_search(&input).unwrap();
        keys[idx]
    }
}

pub trait Claimer {
    fn claim(&self, start_at: UnixTimestamp, time: UnixTimestamp, count: u64) -> u64;
}

pub struct Direct {
    pub period: UnixTimestamp,
    pub units_per_token: u64,
    pub rewards_per_unit: u64,
}

impl From<Params> for Direct {
    fn from(p: Params) -> Self {
        Self {
            period: p.period,
            units_per_token: p.units_per_token,
            rewards_per_unit: p.rewards_per_unit,
        }
    }
}
impl Claimer for Direct {
    // count is count of tokens here
    fn claim(
        &self,
        start_at: UnixTimestamp,
        time: UnixTimestamp,
        count_of_staked_tokens: u64,
    ) -> u64 {
        let time_since = time - start_at;
        let periods_count = (time_since / self.period) as u64;
        count_of_staked_tokens * self.units_per_token * periods_count
    }
}

pub struct PercentUserStake {
    pub percent: u8,
    pub period: UnixTimestamp,
}

impl From<Params> for PercentUserStake {
    fn from(p: Params) -> Self {
        // one unit is 100% of user stake
        Self {
            percent: p.rewards_per_unit as u8,
            period: p.period,
        }
    }
}

impl Claimer for PercentUserStake {
    // count is token count at start stacking
    fn claim(
        &self,
        start_at: UnixTimestamp,
        time: UnixTimestamp,
        count_of_staked_tokens_at_start: u64,
    ) -> u64 {
        let new_count = (start_at..=time)
            .into_iter()
            .step_by(self.period as usize)
            .fold(count_of_staked_tokens_at_start, |acc, _| {
                acc + acc * self.percent as u64 / 100
            });
        new_count - count_of_staked_tokens_at_start
    }
}

pub struct PercentPool {
    period: UnixTimestamp,
    history: History,
    reward_for_period: u64,
}

impl Claimer for PercentPool {
    fn claim(&self, start_at: UnixTimestamp, time: UnixTimestamp, count: u64) -> u64 {
        (start_at..=time)
            .into_iter()
            .step_by(self.period as usize)
            .fold(count, |acc, v| {
                acc + acc * count / self.history.at_epoch(v) * self.reward_for_period
            })
    }
}

impl From<Params> for PercentPool {
    fn from(p: Params) -> Self {
        // one unit is one period
        Self {
            period: p.period,
            history: todo!(),
            reward_for_period: p.rewards_per_unit,
        }
    }
}
