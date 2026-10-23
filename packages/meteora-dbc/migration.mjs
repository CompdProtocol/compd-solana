import {CpAmm,CP_AMM_PROGRAM_ID} from '@meteora-ag/cp-amm-sdk';
import {PublicKey,Transaction} from '@solana/web3.js';
import {getAccount,getMint,TOKEN_PROGRAM_ID,TOKEN_2022_PROGRAM_ID,NATIVE_MINT} from '@solana/spl-token';
import {PROGRAM_ID} from './index.mjs';
import {prepareEnvelope,messageHash} from '../sdk/transactions.mjs';
import {utils} from '@coral-xyz/anchor';
import {createHash} from 'node:crypto';
const same=(a,b)=>new PublicKey(a).equals(new PublicKey(b));
export function migrationBinding({transaction,dbcProgram,expected,position,dammPool}){
 if(!transaction||transaction.meta?.err||transaction.version!=='legacy')throw Error('Finalized legacy migration evidence required');
 const message=transaction.transaction.message,keys=message.accountKeys;
 const candidates=message.instructions.filter(ix=>keys[ix.programIdIndex].equals(PROGRAM_ID)).map(ix=>({ix,decoded:dbcProgram.coder.instruction.decode(ix.data,'base58')})).filter(x=>x.decoded?.name==='migrationDammV2');
 if(candidates.length!==1)throw Error('Ambiguous DBC migration transaction');
 const {ix}=candidates[0],definition=dbcProgram.idl.instructions.find(i=>i.name==='migrationDammV2');
 const account=name=>{const index=definition.accounts.findIndex(a=>a.name===name);if(index<0)throw Error('Migration IDL does not expose required account');return keys[ix.accounts[index]];};
 if(!same(account('virtualPool'),expected.pool)||!same(account('config'),expected.config)||!same(account('pool'),dammPool)||![account('firstPosition'),account('secondPosition')].some(a=>same(a,position)))throw Error('Migration position/pool binding mismatch');
}
export async function prepareMigratedPositionFees({dbc,migrationSignature,position,dammPool,positionNftAccount,owner}){
 const c=dbc.connection,e=dbc.expected;
 if(await c.getGenesisHash()!==e.genesisHash)throw Error('Wrong cluster');
 for(const address of [e.pool,e.config]){const a=await c.getAccountInfo(new PublicKey(address),'finalized');if(!a||!a.owner.equals(PROGRAM_ID))throw Error('Invalid DBC owner');}
 const historical=await dbc.client.state.getPool(e.pool),config=await dbc.client.state.getPoolConfig(e.config);
 if(!historical||!config||historical.poolState.isMigrated!==1||!same(historical.poolState.baseMint,e.mint)||!same(historical.poolState.creator,e.creator)||!same(historical.poolState.config,e.config)||!same(config.quoteMint,NATIVE_MINT))throw Error('Migration not verified');
 const proof=await c.getTransaction(migrationSignature,{commitment:'finalized',maxSupportedTransactionVersion:0});
 migrationBinding({transaction:proof,dbcProgram:dbc.client.program,expected:e,position,dammPool});
 const sdk=new CpAmm(c);
 for(const address of [dammPool,position]){const a=await c.getAccountInfo(new PublicKey(address),'finalized');if(!a||!a.owner.equals(CP_AMM_PROGRAM_ID))throw Error('Invalid DAMM account owner');}
 const [pool,state,nft,mint]=await Promise.all([sdk.fetchPoolState(new PublicKey(dammPool)),sdk.fetchPositionState(new PublicKey(position)),getAccount(c,new PublicKey(positionNftAccount),'finalized',TOKEN_2022_PROGRAM_ID),getMint(c,new PublicKey(e.mint),'finalized',TOKEN_PROGRAM_ID)]);
 if(!same(state.pool,dammPool)||!same(nft.mint,state.nftMint)||!same(nft.owner,owner)||nft.amount!==1n||nft.delegate||nft.isFrozen||mint.mintAuthority||mint.freezeAuthority)throw Error('Position fee ownership not established');
 if(![pool.tokenAMint,pool.tokenBMint].some(m=>same(m,e.mint))||![pool.tokenAMint,pool.tokenBMint].some(m=>same(m,NATIVE_MINT)))throw Error('DAMM mint pair mismatch');
 const tx=await sdk.claimPositionFee({owner:new PublicKey(owner),pool:new PublicKey(dammPool),position:new PublicKey(position),positionNftAccount:new PublicKey(positionNftAccount),tokenAMint:pool.tokenAMint,tokenBMint:pool.tokenBMint,tokenAVault:pool.tokenAVault,tokenBVault:pool.tokenBVault,tokenAProgram:TOKEN_PROGRAM_ID,tokenBProgram:TOKEN_PROGRAM_ID,receiver:new PublicKey(e.receiver),feePayer:new PublicKey(e.payer)});
 const block=await c.getLatestBlockhash('finalized');tx.recentBlockhash=block.blockhash;tx.feePayer=new PublicKey(e.payer);
 if((await c.simulateTransaction(tx)).value.err)throw Error('Migrated fee simulation failed');
 // DAMM position fees may include both assets. They must never be booked as SOL-only DBC revenue.
 return prepareEnvelope(tx,block.lastValidBlockHeight,{kind:'damm-position-fees',migrationSignature,position:new PublicKey(position).toBase58(),dammPool:new PublicKey(dammPool).toBase58(),owner:new PublicKey(owner).toBase58(),receiver:e.receiver,mint:e.mint,tokenAMint:pool.tokenAMint.toBase58(),tokenBMint:pool.tokenBMint.toBase58(),requiresSeparateAssetReconciliation:true});
}
export async function confirmMigratedPositionFees({connection,signature,envelope}){
 const context=envelope.context;
 if(context.kind!=='damm-position-fees')throw Error('Wrong fee context');
 const tx=await connection.getTransaction(signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
 const plan=Transaction.from(Buffer.from(envelope.unsignedBase64,'base64'));
 if(!tx||tx.meta?.err||tx.version!=='legacy'||messageHash(plan)!==envelope.messageHash||!tx.transaction.message.serialize().equals(plan.serializeMessage()))throw Error('DAMM fee transaction differs from prepared message');
 const sdk=new CpAmm(connection),keys=tx.transaction.message.accountKeys,events=[];
 for(const group of tx.meta.innerInstructions??[])for(const ix of group.instructions){
  if(!keys[ix.programIdIndex].equals(CP_AMM_PROGRAM_ID))continue;
  const bytes=utils.bytes.bs58.decode(ix.data);
  if(!Buffer.from(bytes.subarray(0,8)).equals(createHash('sha256').update('anchor:event').digest().subarray(0,8)))continue;
  let event;try{event=sdk._program.coder.events.decode(Buffer.from(bytes.subarray(8)).toString('base64'));}catch{continue;}
  if(event?.name==='evtClaimPositionFee')events.push(event.data);
 }
 if(events.length!==1||!same(events[0].pool,context.dammPool)||!same(events[0].position,context.position)||!same(events[0].owner,context.owner))throw Error('Ambiguous position fee attribution');
 const event=events[0],assets=[{mint:context.tokenAMint,amount:BigInt(event.feeAClaimed.toString())},{mint:context.tokenBMint,amount:BigInt(event.feeBClaimed.toString())}];
 for(const asset of assets){
  if(asset.amount===0n)continue;
  if(same(asset.mint,NATIVE_MINT)){
   const i=keys.findIndex(k=>same(k,context.receiver));
   if(i<0||![tx.meta.preBalances[i],tx.meta.postBalances[i],tx.meta.fee].every(Number.isSafeInteger))throw Error('Unqualified SOL receipt');
   if(BigInt(tx.meta.postBalances[i])-BigInt(tx.meta.preBalances[i])+(i===0?BigInt(tx.meta.fee):0n)!==asset.amount)throw Error('SOL fee/rent mismatch');
  }else{
   const balances=side=>(side??[]).filter(b=>b.owner===context.receiver&&b.mint===asset.mint).reduce((n,b)=>n+BigInt(b.uiTokenAmount.amount),0n);
   if(balances(tx.meta.postTokenBalances)-balances(tx.meta.preTokenBalances)!==asset.amount)throw Error('Token fee receipt mismatch');
  }
 }
 return {signature,slot:tx.slot,position:context.position,pool:context.dammPool,assets,solOnly:false};
}
