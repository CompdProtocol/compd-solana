import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicKey} from '@solana/web3.js';
import {DatabaseSync} from 'node:sqlite';
import {qualifySnapshot,rewardTree,reconcileRewards,holderSnapshot} from '../packages/sdk/holders.mjs';
import {holderLeaf,merkleParent} from '../packages/sdk/treasury.mjs';
import {boundedSpend} from '../packages/agent/execution.mjs';
import {CustodyJournal} from '../packages/agent/custody.mjs';
import {contextHash} from '../packages/sdk/transactions.mjs';
// RFC 8032 public verification keys, not wallets or configured COMPD identities.
const owner=new PublicKey(Buffer.from('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a','hex')).toBase58();
const other=new PublicKey(Buffer.from('3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c','hex')).toBase58();
const k=n=>new PublicKey(Buffer.alloc(32,n)).toBase58();
function snapshot(){return qualifySnapshot({mint:k(1),slot:10,supply:100n,tokens:[{address:k(2),owner,amount:30n},{address:k(3),owner,amount:10n},{address:k(4),owner:other,amount:60n}],exclusions:new Set()});}
test('snapshot aggregates owners, verifies supply and excludes pool accounts',()=>{
 const s=snapshot();assert.equal(s.holders.length,2);assert.equal(s.holders.reduce((n,h)=>n+h.amount,0n),100n);
 assert.throws(()=>qualifySnapshot({mint:k(1),slot:10,supply:2n,tokens:[{address:k(2),owner,amount:1n}],exclusions:new Set()}));
 assert.throws(()=>qualifySnapshot({mint:k(1),slot:10,supply:2n,tokens:[{address:k(2),owner,amount:1n},{address:k(2),owner,amount:1n}],exclusions:new Set()}));
});
test('snapshot refuses silent partial large-holder results',async()=>{
 const connection={getProgramAccounts:async()=>({context:{slot:1},value:Array.from({length:100},()=>({pubkey:new PublicKey(k(1))}))})};
 await assert.rejects(holderSnapshot(connection,{mint:k(1),excludedAccounts:[k(2)],poolBaseVault:k(2)}),/atomic-bank/);
 await assert.rejects(holderSnapshot(connection,{mint:k(1),excludedAccounts:[],poolBaseVault:k(2)}),/explicitly excluded/);
});
test('reward proofs bind distribution and reconcile funded claims',()=>{
 const distribution=k(7),tree=rewardTree(snapshot(),distribution,101n);
 assert.equal(tree.funded+tree.remainder,101n);
 for(const r of tree.rows){let leaf=holderLeaf(distribution,r.index,r.owner,r.amount);for(const p of r.proof)leaf=merkleParent(leaf,Buffer.from(p,'hex'));assert.equal(leaf.toString('hex'),tree.root);}
 const row=tree.rows[0],paidClaims=[{index:row.index,owner:row.owner,amount:row.amount}],remaining=tree.funded-row.amount;
 const inputs={tree,distributionState:{root:Buffer.from(tree.root,'hex'),remaining},paidClaims,actualLamports:1000n+remaining,rent:1000n};
 assert.deepEqual(reconcileRewards(inputs),{paid:row.amount,remaining});
 assert.throws(()=>reconcileRewards({...inputs,paidClaims:[...paidClaims,...paidClaims]}));
 assert.throws(()=>reconcileRewards({...inputs,actualLamports:1000n+remaining-1n}));
});
test('custody history is durable, ordered and conflict/replay protected',()=>{
 const db=new DatabaseSync(':memory:'),journal=new CustodyJournal(db);
 const event={treasury:k(1),sequence:0n,reference:0n,kind:0,amount:100n,strategy:35n,buyback:15n,rewards:0n,reserve:50n,deployed:0n};
 try{assert.equal(journal.apply(event,'fixture'),true);assert.equal(journal.apply(event,'fixture'),false);
 assert.throws(()=>journal.apply({...event,strategy:36n},'fixture'));
 assert.throws(()=>journal.apply({...event,sequence:2n},'gap'));
 assert.equal(journal.latest(k(1)).strategy,'35');}finally{db.close();}
});
test('spend caps/slippage cannot be bypassed and approval commits context',()=>{
 const p={available:100n,maxSpend:10n,slippageBps:100};boundedSpend(10n,p);
 for(const [amount,policy] of [[11n,p],[1n,{...p,slippageBps:101}],[0n,p]])assert.throws(()=>boundedSpend(amount,policy));
 assert.equal(contextHash({amount:'1',owner}),contextHash({owner,amount:'1'}));
 assert.notEqual(contextHash({amount:'1',owner}),contextHash({amount:'2',owner}));
});
