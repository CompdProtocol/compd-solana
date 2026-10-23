import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicKey,Connection,Transaction,TransactionInstruction} from '@solana/web3.js';
import {decodeBurnCheckedInstruction} from '@solana/spl-token';
import {BN} from '@coral-xyz/anchor';
import {CpAmm,CP_AMM_PROGRAM_ID} from '@meteora-ag/cp-amm-sdk';
import {Dbc,PROGRAM_ID} from '../packages/meteora-dbc/index.mjs';
import {migrationBinding} from '../packages/meteora-dbc/migration.mjs';
import {prepareDbcExecution,confirmExecution} from '../packages/agent/execution.mjs';
const k=n=>new PublicKey(Buffer.alloc(32,n));
function stub(){
 const expected={payer:k(1).toBase58(),mint:k(2).toBase58(),pool:k(3).toBase58()};
 const dbc={expected,connection:{getSlot:async()=>10,getLatestBlockhash:async()=>({blockhash:k(9).toBase58(),lastValidBlockHeight:100}),getFeeForMessage:async()=>({value:5000}),simulateTransaction:async()=>({value:{err:null}})},
  verify:async()=>({pool:{},config:{activationType:0},mint:{decimals:6}}),client:{pool:{swapQuote2:()=>({minimumAmountOut:new BN(90)}),swap2:async()=>new Transaction().add(new TransactionInstruction({programId:PROGRAM_ID,data:Buffer.from('wrapper-only-fixture'),keys:[{pubkey:k(1),isSigner:true,isWritable:true}]}))}}};
 return dbc;
}
test('buyback envelope atomically appends a checked burn at protected minimum',async()=>{
 const dbc=stub();const envelope=await prepareDbcExecution({dbc,owner:k(1),amount:100n,swapBaseForQuote:false,policy:{available:100n,maxSpend:100n,slippageBps:50},kind:'buyback',now:1000});
 const tx=Transaction.from(Buffer.from(envelope.unsignedBase64,'base64'));
 const burn=decodeBurnCheckedInstruction(tx.instructions.at(-1));
 assert.equal(burn.data.amount,90n);assert.equal(burn.data.decimals,6);assert.ok(burn.keys.mint.pubkey.equals(k(2)));assert.ok(burn.keys.owner.pubkey.equals(k(1)));
 assert.ok(tx.signatures.every(s=>s.signature===null));
 dbc.connection.getTransaction=async()=>({version:'legacy',slot:11,meta:{err:null},transaction:{message:tx.compileMessage()}});
 assert.equal((await confirmExecution({connection:dbc.connection,signature:'synthetic-fixture',envelope})).status,'FINALIZED');
 dbc.connection.getTransaction=async()=>({version:'legacy',slot:11,meta:{err:'fixture failure'},transaction:{message:tx.compileMessage()}});
 await assert.rejects(confirmExecution({connection:dbc.connection,signature:'synthetic-fixture',envelope}));
});
test('buyback rejects wrong direction and zero protected output',async()=>{
 const dbc=stub(),args={dbc,owner:k(1),amount:100n,swapBaseForQuote:false,policy:{available:100n,maxSpend:100n,slippageBps:50},kind:'buyback'};
 await assert.rejects(prepareDbcExecution({...args,swapBaseForQuote:true}));
 dbc.client.pool.swapQuote2=()=>({minimumAmountOut:new BN(0)});await assert.rejects(prepareDbcExecution(args));
});
test('official migration IDL binds original pool to DAMM pool and position',()=>{
 const expected={pool:k(1),config:k(2)},position=k(3),dammPool=k(4);
 const dbc=new Dbc({}, {mint:k(5),creator:k(6),config:k(2),pool:k(1),payer:k(7),receiver:k(8),genesisHash:'fixture'});
 const definition=dbc.client.program.idl.instructions.find(i=>i.name==='migrationDammV2');
 const mapping={virtualPool:k(1),config:k(2),pool:k(4),firstPosition:k(3)};
 const tx=new Transaction({feePayer:k(7),recentBlockhash:k(9).toBase58()}).add(new TransactionInstruction({programId:PROGRAM_ID,data:dbc.client.program.coder.instruction.encode(definition.name,{}),keys:definition.accounts.map((a,i)=>({pubkey:mapping[a.name]??k(20+i),isSigner:!!a.signer,isWritable:!!a.writable}))}));
 const transaction={version:'legacy',meta:{err:null},transaction:{message:tx.compileMessage()}};
 migrationBinding({transaction,dbcProgram:dbc.client.program,expected,position,dammPool});
 assert.throws(()=>migrationBinding({transaction,dbcProgram:dbc.client.program,expected,position:k(70),dammPool}));
 const sdk=new CpAmm(new Connection('http://127.0.0.1:8899'));
 assert.ok(sdk._program.programId.equals(CP_AMM_PROGRAM_ID));
 assert.ok(sdk._program.idl.instructions.find(i=>i.name==='claimPositionFee').accounts.some(a=>a.name==='signer'&&a.signer));
});
