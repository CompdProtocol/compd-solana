import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {PublicKey,Transaction,TransactionInstruction} from '@solana/web3.js';
import {utils,BN} from '@coral-xyz/anchor';
import {NATIVE_MINT} from '@solana/spl-token';
import {Dbc,PROGRAM_ID} from '../packages/meteora-dbc/index.mjs';
import {prepareEnvelope} from '../packages/sdk/transactions.mjs';
const key=n=>new PublicKey(Buffer.alloc(32,n));
function fixture(){
 const e=Object.fromEntries(['mint','creator','config','pool','payer','receiver'].map((n,i)=>[n,key(i+1).toBase58()]));e.genesisHash='fixture';
 const dbc=new Dbc({},e);dbc.verify=async()=>({});
 const def=dbc.client.program.idl.instructions.find(i=>i.name==='claimCreatorTradingFee');
 const values={pool:e.pool,creator:e.creator,baseMint:e.mint,quoteMint:NATIVE_MINT};
 const instruction=new TransactionInstruction({programId:PROGRAM_ID,keys:def.accounts.map((a,i)=>({pubkey:new PublicKey(values[a.name]??key(20+i)),isSigner:a.signer===true,isWritable:a.writable===true})),data:dbc.client.program.coder.instruction.encode(def.name,{maxBaseAmount:new BN(0),maxQuoteAmount:new BN(100)})});
 const tx=new Transaction({feePayer:new PublicKey(e.payer),recentBlockhash:key(99).toBase58()}).add(instruction);
 const envelope=prepareEnvelope(tx,100,{kind:'dbc-creator-claim',...e});
 const message=tx.compileMessage(),keys=message.accountKeys,receiverIndex=keys.findIndex(k=>k.equals(new PublicKey(e.receiver)));
 // The SDK claim receiver is routed by token setup/close instructions; this fixture includes
 // the receiver explicitly for a minimal transaction binding test, without executing it.
 if(receiverIndex<0){instruction.keys.push({pubkey:new PublicKey(e.receiver),isSigner:false,isWritable:true});}
 const finalMessage=tx.compileMessage();const plan=prepareEnvelope(tx,100,{kind:'dbc-creator-claim',...e});
 const layout=dbc.client.program.coder.events.layouts.get('evtClaimCreatorTradingFee');
 const buffer=Buffer.alloc(200),len=layout.layout.encode({pool:new PublicKey(e.pool),tokenBaseAmount:new BN(0),tokenQuoteAmount:new BN(100)},buffer);
 const event=Buffer.concat([createHash('sha256').update('anchor:event').digest().subarray(0,8),Buffer.from(layout.discriminator),buffer.subarray(0,len)]);
 const pre=finalMessage.accountKeys.map(()=>100000),post=[...pre];post[finalMessage.accountKeys.findIndex(k=>k.equals(new PublicKey(e.receiver)))]+=100;
 const confirmed={version:'legacy',slot:10,transaction:{message:finalMessage},meta:{err:null,fee:5000,preBalances:pre,postBalances:post,innerInstructions:[{index:0,instructions:[{programIdIndex:finalMessage.accountKeys.findIndex(k=>k.equals(PROGRAM_ID)),data:utils.bytes.bs58.encode(event)}]}]}};
 dbc.connection={getTransaction:async()=>confirmed};
 return {dbc,plan,confirmed,e};
}
test('IDL-decoded single-pool claim reconciles exact physical SOL receipt',async()=>{
 const {dbc,plan}=fixture();const receipt=await dbc.confirmedReceipt('synthetic-not-mainnet',plan);assert.equal(receipt.amount,100n);
});
test('receipt rejects changed message, missing event, wrong context and rent mismatch',async()=>{
 {const {dbc,plan}=fixture();await assert.rejects(dbc.confirmedReceipt('fixture',{...plan,messageHash:'changed'}));}
 {const {dbc,plan,confirmed}=fixture();confirmed.meta.innerInstructions=[];await assert.rejects(dbc.confirmedReceipt('fixture',plan));}
 {const {dbc,plan}=fixture();await assert.rejects(dbc.confirmedReceipt('fixture',{...plan,context:{...plan.context,mint:key(80).toBase58()}}));}
 {const {dbc,plan,confirmed,e}=fixture();const i=confirmed.transaction.message.accountKeys.findIndex(k=>k.equals(new PublicKey(e.receiver)));confirmed.meta.postBalances[i]+=1;await assert.rejects(dbc.confirmedReceipt('fixture',plan));}
});
