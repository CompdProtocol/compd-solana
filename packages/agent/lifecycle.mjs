import { u64 } from '../sdk/accounting.mjs';
export const CYCLE_MS = 8 * 60 * 60 * 1000;
export function cycleAt(time) {if(!Number.isSafeInteger(time)||time<0)throw Error('Invalid clock');return Math.floor(time/CYCLE_MS);}
export function qualifyMarket(sample, now, maxAgeMs=60_000) {
  if(!sample || !Number.isSafeInteger(sample.observedAt) || sample.observedAt>now || now-sample.observedAt>maxAgeMs || typeof sample.priceQuoteAtoms!=='bigint' || sample.priceQuoteAtoms<=0n || sample.verified!==true)throw Error('Unqualified/stale market data');
  return sample;
}
export function riskPolicy({amount,capital,deployed,activeRuns,paused,market,now,maxSlippageBps}) {
  [amount,capital,deployed].forEach(u64);qualifyMarket(market,now);
  if(paused||amount===0n||!Number.isInteger(activeRuns)||activeRuns<0||activeRuns>=3||amount*100n>capital*10n||(deployed+amount)*100n>capital*30n||!Number.isInteger(maxSlippageBps)||maxSlippageBps<0||maxSlippageBps>100)throw Error('Risk policy rejected');
  return {allowed:true,requiresOwnerApproval:true};
}
export async function cycle({journal,dbc,now=Date.now()}) {
  const id=cycleAt(now);if(!journal.startCycle(id))return {id,state:'SKIPPED'};
  try {
    const verified=await dbc.verify();
    // A reserve ratio is not a qualified execution quote. No automatic trade follows monitoring.
    const market={observedAt:now,source:'DBC finalized reserves',baseReserve:verified.state.baseReserve.toString(),quoteReserve:verified.state.quoteReserve.toString(),verified:false};
    journal.finishCycle(id);return {id,state:'OBSERVED',market};
  }catch(e){journal.finishCycle(id,e.message);throw e;}
}
