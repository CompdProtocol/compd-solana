import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Journal} from '../packages/agent/journal.mjs';
import {cycleAt,CYCLE_MS,riskPolicy,cycle,qualifyMarket} from '../packages/agent/lifecycle.mjs';
import {U64_MAX} from '../packages/sdk/accounting.mjs';
const receipt={signature:'fixture-signature-not-chain-evidence',pool:'fixture-pool',mint:'fixture-mint',receiver:'fixture-receiver',slot:1,amount:100n};
test('receipt replay is idempotent; conflicting evidence is rejected',()=>{
 const j=new Journal(':memory:');try{
  assert.equal(j.receipt(receipt),true);assert.equal(j.receipt(receipt),false);
  assert.throws(()=>j.receipt({...receipt,amount:101n}));assert.equal(j.reconcile(100n),100n);
  assert.throws(()=>j.reconcile(101n));
 }finally{j.close();}
});
test('failed credits roll back receipt and buckets atomically',()=>{
 const j=new Journal(':memory:');try{
  j.receipt({...receipt,amount:U64_MAX});
  assert.throws(()=>j.receipt({...receipt,signature:'overflow-fixture',amount:100n}));
  assert.equal(j.db.prepare('SELECT count(*) AS n FROM receipts').get().n,1);
  assert.equal(j.reconcile(U64_MAX),U64_MAX);
 }finally{j.close();}
});
test('restart preserves receipt replay protection',()=>{
 const dir=mkdtempSync(join(tmpdir(),'compd-test-')),file=join(dir,'ledger.sqlite');
 try{let j=new Journal(file);j.receipt(receipt);j.close();j=new Journal(file);assert.equal(j.receipt(receipt),false);j.close();}finally{rmSync(dir,{recursive:true});}
});
test('8-hour UTC boundary and completed-cycle deduplication',async()=>{
 assert.equal(cycleAt(CYCLE_MS-1),0);assert.equal(cycleAt(CYCLE_MS),1);
 const j=new Journal(':memory:');const dbc={verify:async()=>({state:{baseReserve:1n,quoteReserve:2n}})};
 try{assert.equal((await cycle({journal:j,dbc,now:CYCLE_MS})).state,'OBSERVED');assert.equal((await cycle({journal:j,dbc,now:CYCLE_MS+1})).state,'SKIPPED');}finally{j.close();}
});
test('failures are retryable and interrupted cycles require explicit recovery',async()=>{
 const j=new Journal(':memory:');try{
  await assert.rejects(cycle({journal:j,dbc:{verify:async()=>{throw Error('RPC down');}},now:0}));
  assert.equal(j.startCycle(0),true);assert.equal(j.startCycle(0),false);
  j.recoverCycle(0);assert.equal(j.startCycle(0),true);
 }finally{j.close();}
});
test('risk policies reject stale, future, unverified, excessive and paused proposals',()=>{
 const now=CYCLE_MS,market={observedAt:now,priceQuoteAtoms:1n,verified:true};
 const p={amount:10n,capital:100n,deployed:0n,activeRuns:0,paused:false,market,now,maxSlippageBps:50};
 assert.equal(riskPolicy(p).requiresOwnerApproval,true);
 for(const bad of [{amount:11n},{deployed:21n},{activeRuns:3},{paused:true},{maxSlippageBps:101},{market:{...market,verified:false}},{market:{...market,observedAt:now-60001}}])assert.throws(()=>riskPolicy({...p,...bad}));
 assert.throws(()=>qualifyMarket({...market,observedAt:now+1},now));
});
