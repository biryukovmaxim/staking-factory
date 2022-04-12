use crate::Pubkey;
use anchor_lang::solana_program::clock::UnixTimestamp;

pub struct History(Pubkey);

impl History {
    // returns total count of tokens in general stake
    pub fn at_epoch(&self, ts: UnixTimestamp) -> u64 {
        unimplemented!()
    }
}
