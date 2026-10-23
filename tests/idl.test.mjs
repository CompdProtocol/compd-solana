import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PublicKey} from '@solana/web3.js';
import {TreasuryClient,treasuryAddress} from '../packages/sdk/treasury.mjs';
import {CustodyJournal,reconcileCustody} from '../packages/agent/custody.mjs';
import {DatabaseSync} from 'node:sqlite';
import {BN} from '@coral-xyz/anchor';
import {reconcileFundedRewards} from '../packages/sdk/holders.mjs';
import {holderLeaf} from '../packages/sdk/treasury.mjs';
const idl=JSON.parse(readFileSync('packages/sdk/idl/compd_treasury.json','utf8'));
const k=n=>new PublicKey(Buffer.alloc(32,n));
test('real generated IDL binds development source, localnet config and test identity',()=>{
 const testIdentity=JSON.parse(readFileSync('tests/dev-program.json','utf8'));
 assert.equal(idl.address,testIdentity.programId);assert.equal(testIdentity.officialDeployment,false);
 assert.ok(readFileSync('programs/compd-treasury/src/lib.rs','utf8').includes(`declare_id!("${idl.address}")`));
 assert.ok(readFileSync('Anchor.toml','utf8').includes(`compd_treasury = "${idl.address}"`));
});
test('custody reconciliation decodes real IDL fields and rejects an underfunded PDA',async()=>{
 const client=new TreasuryClient(idl,{connection:{}},idl.address),address=treasuryAddress(idl.address,k(1));
 const state={authority:k(1),mint:k(2),executor:k(3),buybackRecipient:k(4),reserveRecipient:k(5),strategy:new BN(35),buyback:new BN(15),rewards:new BN(0),reserve:new BN(50),deployed:new BN(0),eventNonce:new BN(1),receiptNonce:new BN(1),runNonce:new BN(0),distributionNonce:new BN(0),runs:0,paused:false,bump:PublicKey.findProgramAddressSync([Buffer.from('treasury'),k(1).toBuffer()],new PublicKey(idl.address))[1]};
 const data=await client.program.coder.accounts.encode('treasury',state);
 const db=new DatabaseSync(':memory:'),journal=new CustodyJournal(db);
 try{
 journal.apply({treasury:address.toBase58(),sequence:0n,reference:0n,kind:0,amount:100n,strategy:35n,buyback:15n,rewards:0n,reserve:50n,deployed:0n},'fixture');
 const account={owner:new PublicKey(idl.address),data,lamports:1100};
 const connection={getAccountInfoAndContext:async()=>({context:{slot:10},value:account}),getMinimumBalanceForRentExemption:async()=>1000};
 assert.equal((await reconcileCustody({connection,idl,programId:idl.address,treasury:address,journal})).liquid,100n);
 account.lamports=1099;await assert.rejects(reconcileCustody({connection,idl,programId:idl.address,treasury:address,journal}));
 }finally{db.close();}
});
test('SDK prepares treasury and funded reward instructions with actual IDL, unsigned',async()=>{
 const client=new TreasuryClient(idl,{connection:{}},idl.address);
 const tx=await client.revenue({authority:k(1),nonce:0n,amount:100n});
 const instruction=client.program.coder.instruction.decode(tx.instructions[0].data);
 assert.equal(instruction.name,'receiveRevenue');assert.equal(instruction.data.amount.toString(),'100');
 assert.ok(tx.instructions[0].keys.some(a=>a.pubkey.equals(treasuryAddress(idl.address,k(1)))));
 const funded=await client.fundRewards({authority:k(1),id:0n,root:Buffer.alloc(32,1).toString('hex'),amount:10n});
 assert.equal(client.program.coder.instruction.decode(funded.instructions[0].data).name,'createDistribution');
 const claim=await client.claimReward({distribution:k(2),holder:k(1),index:0n,amount:10n,proof:[]});
 assert.equal(client.program.coder.instruction.decode(claim.instructions[0].data).name,'claim');
 assert.ok([tx,funded,claim].every(t=>t.signatures.every(s=>s.signature===null)));
});
test('funded reward reconciliation reads real distribution and claim PDA account data',async()=>{
 const client=new TreasuryClient(idl,{connection:{}},idl.address),distribution=k(2),treasury=k(1),root=holderLeaf(distribution,0n,k(3),10n);
 const tree={distribution:distribution.toBase58(),root:root.toString('hex'),funded:10n,rows:[{index:0n,owner:k(3).toBase58(),amount:10n}]};
 const encode=remaining=>client.program.coder.accounts.encode('distribution',{treasury,root:[...root],remaining:new BN(remaining)});
 const info={owner:client.program.programId,lamports:1010,data:await encode(10)};
 let claim=null,calls=0;
 const connection={getMultipleAccountsInfoAndContext:async addresses=>{calls++;assert.equal(addresses.length,2);return {context:{slot:9},value:[info,claim]};},getMinimumBalanceForRentExemption:async()=>1000};
 assert.equal((await reconcileFundedRewards({connection,treasuryClient:client,tree,treasury})).remaining,10n);
 claim={owner:client.program.programId,data:await client.program.coder.accounts.encode('claimed',{})};info.data=await encode(0);info.lamports=1000;
 assert.equal((await reconcileFundedRewards({connection,treasuryClient:client,tree,treasury})).paid,10n);assert.equal(calls,2);
 claim.owner=k(8);await assert.rejects(reconcileFundedRewards({connection,treasuryClient:client,tree,treasury}));
});
