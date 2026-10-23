//! Integer-only SOL accounting. Reserve remainder conserves every lamport.
#[derive(Debug, PartialEq, Eq)]
pub enum Error {
    Overflow,
    Insufficient,
    RiskLimit,
    Paused,
}
#[derive(Default, Clone, Copy, Debug, PartialEq, Eq)]
pub struct Ledger {
    pub strategy: u64,
    pub buyback: u64,
    pub rewards: u64,
    pub reserve: u64,
    pub deployed: u64,
    pub runs: u8,
    pub paused: bool,
}
pub fn split(amount: u64, profit: bool) -> [u64; 4] {
    let pct = if profit {
        [65u128, 15, 10]
    } else {
        [35, 15, 0]
    };
    let a = (u128::from(amount) * pct[0] / 100) as u64;
    let b = (u128::from(amount) * pct[1] / 100) as u64;
    let c = (u128::from(amount) * pct[2] / 100) as u64;
    [a, b, c, amount - a - b - c]
}
impl Ledger {
    pub fn liquid(&self) -> Result<u64, Error> {
        [self.strategy, self.buyback, self.rewards, self.reserve]
            .into_iter()
            .try_fold(0u64, |a, b| a.checked_add(b).ok_or(Error::Overflow))
    }
    pub fn credit(&mut self, amount: u64, profit: bool) -> Result<(), Error> {
        let [s, b, h, r] = split(amount, profit);
        let next = Self {
            strategy: self.strategy.checked_add(s).ok_or(Error::Overflow)?,
            buyback: self.buyback.checked_add(b).ok_or(Error::Overflow)?,
            rewards: self.rewards.checked_add(h).ok_or(Error::Overflow)?,
            reserve: self.reserve.checked_add(r).ok_or(Error::Overflow)?,
            ..*self
        };
        next.liquid()?;
        *self = next;
        Ok(())
    }
    pub fn allocate(&mut self, amount: u64) -> Result<(), Error> {
        if self.paused {
            return Err(Error::Paused);
        }
        let capital = self
            .strategy
            .checked_add(self.deployed)
            .ok_or(Error::Overflow)?;
        let deployed = self.deployed.checked_add(amount).ok_or(Error::Overflow)?;
        if amount == 0
            || u128::from(amount) * 100 > u128::from(capital) * 10
            || u128::from(deployed) * 100 > u128::from(capital) * 30
            || self.runs >= 3
        {
            return Err(Error::RiskLimit);
        }
        self.strategy = self
            .strategy
            .checked_sub(amount)
            .ok_or(Error::Insufficient)?;
        self.deployed = deployed;
        self.runs += 1;
        Ok(())
    }
    pub fn settle(&mut self, principal: u64, returned: u64) -> Result<(), Error> {
        let mut next = *self;
        next.deployed = next
            .deployed
            .checked_sub(principal)
            .ok_or(Error::Insufficient)?;
        next.runs = next.runs.checked_sub(1).ok_or(Error::Insufficient)?;
        next.strategy = next
            .strategy
            .checked_add(returned.min(principal))
            .ok_or(Error::Overflow)?;
        if returned > principal {
            next.credit(returned - principal, true)?;
        }
        if returned < principal {
            next.paused = true;
        }
        next.liquid()?;
        *self = next;
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn all_rounding_conserves() {
        for n in 0..10_000 {
            for profit in [false, true] {
                assert_eq!(split(n, profit).into_iter().sum::<u64>(), n);
            }
        }
        assert_eq!(
            split(u64::MAX, true)
                .into_iter()
                .map(u128::from)
                .sum::<u128>(),
            u128::from(u64::MAX)
        );
    }
    #[test]
    fn settlement_and_loss() {
        let mut l = Ledger::default();
        l.credit(100_000, false).unwrap();
        l.allocate(3500).unwrap();
        l.settle(3500, 4500).unwrap();
        assert_eq!(l.strategy, 35650);
        assert_eq!(l.rewards, 100);
        assert_eq!(l.liquid(), Ok(101000));
        l.allocate(100).unwrap();
        l.settle(100, 0).unwrap();
        assert!(l.paused);
    }
    #[test]
    fn errors_are_atomic() {
        let mut l = Ledger::default();
        l.reserve = u64::MAX;
        let old = l;
        assert!(l.credit(100, false).is_err());
        assert_eq!(l, old);
        assert_eq!(l.allocate(1), Err(Error::RiskLimit));
        assert_eq!(l, old);
    }
    #[test]
    fn concurrent_limits() {
        let mut l = Ledger::default();
        l.credit(100000, false).unwrap();
        for _ in 0..3 {
            l.allocate(3500).unwrap();
        }
        assert_eq!(l.allocate(1), Err(Error::RiskLimit));
    }
}
