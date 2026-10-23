use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use compd_accounting::Ledger;
// DEVELOPMENT ONLY: owner-authorized local test identity, not a mainnet deployment.
anchor_lang::declare_id!("69oLCEtauvko4xyBAVWg2tBHswnCJ9v6DkDfQLjQdwVT");

#[program]
pub mod compd_treasury {
    use super::*;
    pub fn initialize(
        ctx: Context<Initialize>,
        mint: Pubkey,
        executor: Pubkey,
        buyback: Pubkey,
        reserve: Pubkey,
    ) -> Result<()> {
        require!(
            mint != Pubkey::default()
                && executor != Pubkey::default()
                && buyback != Pubkey::default()
                && reserve != Pubkey::default(),
            Fault::Identity
        );
        let t = &mut ctx.accounts.treasury;
        t.authority = ctx.accounts.authority.key();
        t.mint = mint;
        t.executor = executor;
        t.buyback_recipient = buyback;
        t.reserve_recipient = reserve;
        t.bump = ctx.bumps.treasury;
        Ok(())
    }
    /// Authority attests attribution off-chain; this is NOT a DBC CPI verifier.
    /// The amount is physically deposited in the same instruction, not inferred from balance.
    pub fn receive_revenue(ctx: Context<Deposit>, nonce: u64, amount: u64) -> Result<()> {
        require!(
            amount > 0 && nonce == ctx.accounts.treasury.receipt_nonce,
            Fault::Replay
        );
        solvent(&ctx.accounts.treasury)?;
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.authority.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            amount,
        )?;
        let t = &mut ctx.accounts.treasury;
        let mut ledger = t.ledger();
        ledger
            .credit(amount, false)
            .map_err(|_| error!(Fault::Accounting))?;
        t.store(ledger);
        t.receipt_nonce = t.receipt_nonce.checked_add(1).ok_or(Fault::Accounting)?;
        emit!(Revenue { nonce, amount });
        snapshot(t, 0, nonce, amount)?;
        solvent(t)
    }
    pub fn allocate(ctx: Context<Allocate>, id: u64, amount: u64) -> Result<()> {
        let t = &mut ctx.accounts.treasury;
        solvent(t)?;
        require!(
            id == t.run_nonce && ctx.accounts.executor.key() == t.executor,
            Fault::Identity
        );
        let mut l = t.ledger();
        l.allocate(amount).map_err(|_| error!(Fault::Risk))?;
        t.store(l);
        t.run_nonce = t.run_nonce.checked_add(1).ok_or(Fault::Accounting)?;
        let run = &mut ctx.accounts.run;
        run.treasury = t.key();
        run.id = id;
        run.principal = amount;
        run.open = true;
        move_sol(
            &t.to_account_info(),
            &ctx.accounts.executor.to_account_info(),
            amount,
        )?;
        snapshot(t, 1, id, amount)?;
        solvent(t)
    }
    pub fn settle(ctx: Context<Settle>, returned: u64) -> Result<()> {
        require!(ctx.accounts.run.open, Fault::Replay);
        solvent(&ctx.accounts.treasury)?;
        if returned > 0 {
            transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.executor.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                returned,
            )?;
        }
        let t = &mut ctx.accounts.treasury;
        let mut l = t.ledger();
        l.settle(ctx.accounts.run.principal, returned)
            .map_err(|_| error!(Fault::Accounting))?;
        t.store(l);
        ctx.accounts.run.open = false;
        snapshot(t, 2, ctx.accounts.run.id, returned)?;
        solvent(t)
    }
    pub fn pause(ctx: Context<Admin>, paused: bool) -> Result<()> {
        ctx.accounts.treasury.paused = paused;
        Ok(())
    }
    /// Permissioned reserve release, not a swap, burn, or proof of buyback.
    pub fn release_reserve(ctx: Context<Release>, buyback: bool, amount: u64) -> Result<()> {
        let t = &mut ctx.accounts.treasury;
        solvent(t)?;
        require!(amount > 0, Fault::Accounting);
        let recipient = if buyback {
            t.buyback_recipient
        } else {
            t.reserve_recipient
        };
        require_keys_eq!(ctx.accounts.recipient.key(), recipient, Fault::Identity);
        let bucket = if buyback {
            &mut t.buyback
        } else {
            &mut t.reserve
        };
        *bucket = bucket.checked_sub(amount).ok_or(Fault::Accounting)?;
        move_sol(
            &t.to_account_info(),
            &ctx.accounts.recipient.to_account_info(),
            amount,
        )?;
        snapshot(t, if buyback { 3 } else { 4 }, 0, amount)?;
        solvent(t)
    }
    pub fn create_distribution(
        ctx: Context<CreateDistribution>,
        id: u64,
        root: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        let t = &mut ctx.accounts.treasury;
        solvent(t)?;
        require!(
            id == t.distribution_nonce && amount > 0 && root != [0; 32],
            Fault::Replay
        );
        t.rewards = t.rewards.checked_sub(amount).ok_or(Fault::Accounting)?;
        t.distribution_nonce = t
            .distribution_nonce
            .checked_add(1)
            .ok_or(Fault::Accounting)?;
        let d = &mut ctx.accounts.distribution;
        d.treasury = t.key();
        d.root = root;
        d.remaining = amount;
        move_sol(&t.to_account_info(), &d.to_account_info(), amount)?;
        snapshot(t, 5, id, amount)?;
        emit!(RewardFunded {
            distribution: d.key(),
            root,
            amount
        });
        solvent(t)
    }
    pub fn claim(ctx: Context<Claim>, index: u64, amount: u64, proof: Vec<[u8; 32]>) -> Result<()> {
        require!(proof.len() <= 32 && amount > 0, Fault::Proof);
        let mut h = anchor_lang::solana_program::hash::hashv(&[
            b"COMPD_HOLDER_V1",
            ctx.accounts.distribution.key().as_ref(),
            &index.to_le_bytes(),
            ctx.accounts.holder.key().as_ref(),
            &amount.to_le_bytes(),
        ])
        .to_bytes();
        for p in proof {
            h = if h <= p {
                anchor_lang::solana_program::hash::hashv(&[&h, &p])
            } else {
                anchor_lang::solana_program::hash::hashv(&[&p, &h])
            }
            .to_bytes();
        }
        require!(h == ctx.accounts.distribution.root, Fault::Proof);
        let d = &mut ctx.accounts.distribution;
        d.remaining = d.remaining.checked_sub(amount).ok_or(Fault::Accounting)?;
        move_sol(
            &d.to_account_info(),
            &ctx.accounts.holder.to_account_info(),
            amount,
        )?;
        emit!(RewardPaid {
            distribution: d.key(),
            index,
            holder: ctx.accounts.holder.key(),
            amount,
            remaining: d.remaining
        });
        Ok(())
    }
}
fn move_sol(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
    let balance = from
        .lamports()
        .checked_sub(amount)
        .ok_or(Fault::Accounting)?;
    require!(
        balance >= Rent::get()?.minimum_balance(from.data_len()),
        Fault::Accounting
    );
    let destination = to.lamports().checked_add(amount).ok_or(Fault::Accounting)?;
    **from.try_borrow_mut_lamports()? = balance;
    **to.try_borrow_mut_lamports()? = destination;
    Ok(())
}
fn solvent(t: &Account<Treasury>) -> Result<()> {
    let info = t.to_account_info();
    let needed = t
        .ledger()
        .liquid()
        .map_err(|_| error!(Fault::Accounting))?
        .checked_add(Rent::get()?.minimum_balance(info.data_len()))
        .ok_or(Fault::Accounting)?;
    require!(info.lamports() >= needed, Fault::Accounting);
    Ok(())
}
#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub executor: Pubkey,
    pub buyback_recipient: Pubkey,
    pub reserve_recipient: Pubkey,
    pub strategy: u64,
    pub buyback: u64,
    pub rewards: u64,
    pub reserve: u64,
    pub deployed: u64,
    pub event_nonce: u64,
    pub receipt_nonce: u64,
    pub run_nonce: u64,
    pub distribution_nonce: u64,
    pub runs: u8,
    pub paused: bool,
    pub bump: u8,
}
impl Treasury {
    fn ledger(&self) -> Ledger {
        Ledger {
            strategy: self.strategy,
            buyback: self.buyback,
            rewards: self.rewards,
            reserve: self.reserve,
            deployed: self.deployed,
            runs: self.runs,
            paused: self.paused,
        }
    }
    fn store(&mut self, l: Ledger) {
        self.strategy = l.strategy;
        self.buyback = l.buyback;
        self.rewards = l.rewards;
        self.reserve = l.reserve;
        self.deployed = l.deployed;
        self.runs = l.runs;
        self.paused = l.paused;
    }
}
#[account]
#[derive(InitSpace)]
pub struct Run {
    pub treasury: Pubkey,
    pub id: u64,
    pub principal: u64,
    pub open: bool,
}
#[account]
#[derive(InitSpace)]
pub struct Distribution {
    pub treasury: Pubkey,
    pub root: [u8; 32],
    pub remaining: u64,
}
#[account]
#[derive(InitSpace)]
pub struct Claimed {}
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init,payer=authority,space=8+Treasury::INIT_SPACE,seeds=[b"treasury",authority.key().as_ref()],bump)]
    pub treasury: Account<'info, Treasury>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct Admin<'info> {
    pub authority: Signer<'info>,
    #[account(mut,has_one=authority,seeds=[b"treasury",authority.key().as_ref()],bump=treasury.bump)]
    pub treasury: Account<'info, Treasury>,
}
#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut,has_one=authority,seeds=[b"treasury",authority.key().as_ref()],bump=treasury.bump)]
    pub treasury: Account<'info, Treasury>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(id:u64)]
pub struct Allocate<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut,has_one=authority,seeds=[b"treasury",authority.key().as_ref()],bump=treasury.bump)]
    pub treasury: Account<'info, Treasury>,
    #[account(mut,address=treasury.executor)]
    pub executor: SystemAccount<'info>,
    #[account(init,payer=authority,space=8+Run::INIT_SPACE,seeds=[b"run",treasury.key().as_ref(),&id.to_le_bytes()],bump)]
    pub run: Account<'info, Run>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct Settle<'info> {
    pub authority: Signer<'info>,
    #[account(mut,has_one=authority,seeds=[b"treasury",authority.key().as_ref()],bump=treasury.bump)]
    pub treasury: Account<'info, Treasury>,
    #[account(mut,address=treasury.executor)]
    pub executor: Signer<'info>,
    #[account(mut,has_one=treasury)]
    pub run: Account<'info, Run>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct Release<'info> {
    pub authority: Signer<'info>,
    #[account(mut,has_one=authority,seeds=[b"treasury",authority.key().as_ref()],bump=treasury.bump)]
    pub treasury: Account<'info, Treasury>,
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
}
#[derive(Accounts)]
#[instruction(id:u64)]
pub struct CreateDistribution<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut,has_one=authority,seeds=[b"treasury",authority.key().as_ref()],bump=treasury.bump)]
    pub treasury: Account<'info, Treasury>,
    #[account(init,payer=authority,space=8+Distribution::INIT_SPACE,seeds=[b"distribution",treasury.key().as_ref(),&id.to_le_bytes()],bump)]
    pub distribution: Account<'info, Distribution>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(index:u64)]
pub struct Claim<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,
    #[account(mut)]
    pub distribution: Account<'info, Distribution>,
    #[account(init,payer=holder,space=8+Claimed::INIT_SPACE,seeds=[b"claimed",distribution.key().as_ref(),&index.to_le_bytes()],bump)]
    pub claimed: Account<'info, Claimed>,
    pub system_program: Program<'info, System>,
}
#[event]
pub struct Revenue {
    pub nonce: u64,
    pub amount: u64,
}
#[error_code]
pub enum Fault {
    #[msg("Accounting invariant failed")]
    Accounting,
    #[msg("Unexpected identity")]
    Identity,
    #[msg("Nonce or state replay")]
    Replay,
    #[msg("Risk policy rejected")]
    Risk,
    #[msg("Invalid holder proof")]
    Proof,
}

fn snapshot(t: &mut Account<Treasury>, kind: u8, reference: u64, amount: u64) -> Result<()> {
    let sequence = t.event_nonce;
    t.event_nonce = t.event_nonce.checked_add(1).ok_or(Fault::Accounting)?;
    emit!(Custody {
        treasury: t.key(),
        sequence,
        kind,
        reference,
        amount,
        strategy: t.strategy,
        buyback: t.buyback,
        rewards: t.rewards,
        reserve: t.reserve,
        deployed: t.deployed
    });
    Ok(())
}
#[event]
pub struct Custody {
    pub treasury: Pubkey,
    pub sequence: u64,
    pub kind: u8,
    pub reference: u64,
    pub amount: u64,
    pub strategy: u64,
    pub buyback: u64,
    pub rewards: u64,
    pub reserve: u64,
    pub deployed: u64,
}
#[event]
pub struct RewardFunded {
    pub distribution: Pubkey,
    pub root: [u8; 32],
    pub amount: u64,
}
#[event]
pub struct RewardPaid {
    pub distribution: Pubkey,
    pub index: u64,
    pub holder: Pubkey,
    pub amount: u64,
    pub remaining: u64,
}

#[cfg(test)]
mod execution_tests;
