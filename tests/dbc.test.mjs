import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicKey,Transaction,SystemProgram} from '@solana/web3.js';
import {NATIVE_MINT} from '@solana/spl-token';
import {validatePool,uniqueClaim,Dbc,PROGRAM_ID} from '../packages/meteora-dbc/index.mjs';
import {prepareEnvelope,verifyApproval} from '../packages/sdk/transactions.mjs';
// Deterministic public-key fixtures only: no wallets, secret material or signing.
const key=n=>new PublicKey(Buffer.alloc(32,n));
const expected={mint:key(1),creator:key(2),config:key(3)};
const pool={poolState:{baseMint:key(1),creator:key(2),config:key(3),isMigrated:0,migrationProgress:0}};
const config={quoteMint:NATIVE_MINT,creatorTradingFeePercentage:50};
test('pool is bound to mint, creator, config and SOL fee rights',()=>{
 assert.equal(validatePool(pool,config,expected),pool.poolState);
 for(const p of [{baseMint:key(4)},{creator:key(4)},{config:key(4)},{isMigrated:1},{migrationProgress:1}])assert.throws(()=>validatePool({poolState:{...pool.poolState,...p}},config,expected));
 assert.throws(()=>validatePool(pool,{...config,creatorTradingFeePercentage:0},expected));
 assert.throws(()=>validatePool(pool,{...config,quoteMint:key(4)},expected));
});
test('aggregated, multi-pool, base-token and empty events fail closed',()=>{
 const event={pool:key(5),tokenBaseAmount:0n,tokenQuoteAmount:100n};
 assert.equal(uniqueClaim([event],key(5)),event);
 for(const events of [[],[event,event],[{...event,pool:key(6)}],[{...event,tokenBaseAmount:1n}],[{...event,tokenQuoteAmount:0n}]])assert.throws(()=>uniqueClaim(events,key(5)));
});
test('official SDK/IDL match expected creator claim account and event surface',()=>{
 const dbc=new Dbc({}, {mint:key(1),creator:key(2),config:key(3),pool:key(5),payer:key(6),receiver:key(7),genesisHash:'fixture'});
 assert.equal(dbc.client.program.programId.toBase58(),PROGRAM_ID.toBase58());
 const ix=dbc.client.program.idl.instructions.find(i=>i.name==='claimCreatorTradingFee');
 assert.ok(ix.accounts.some(a=>a.name==='creator'&&a.signer));
 assert.deepEqual(ix.args.map(a=>a.name),['maxBaseAmount','maxQuoteAmount']);
 const event=dbc.client.program.idl.types.find(t=>t.name==='evtClaimCreatorTradingFee');
 assert.deepEqual(event.type.fields.map(f=>f.name),['pool','tokenBaseAmount','tokenQuoteAmount']);
});
test('unsigned envelope binds message, signers and expiry; wrong approval rejected',()=>{
 const tx=new Transaction({feePayer:key(1),recentBlockhash:key(9).toBase58()}).add(SystemProgram.transfer({fromPubkey:key(1),toPubkey:key(2),lamports:1n}));
 const e=prepareEnvelope(tx,100,{kind:'fixture'});
 assert.deepEqual(e.requiredSigners,[key(1).toBase58()]);
 assert.equal(verifyApproval(e,{messageHash:e.messageHash,expiresAtHeight:100,signatureBase64:Buffer.alloc(64).toString('base64')},key(1),101),false);
 assert.equal(verifyApproval(e,{messageHash:'wrong',expiresAtHeight:100},key(1),99),false);
 assert.throws(()=>prepareEnvelope(tx,0,{}));
});
