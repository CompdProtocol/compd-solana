import {PublicKey,Transaction} from '@solana/web3.js';
import {getAssociatedTokenAddressSync,createBurnCheckedInstruction,TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {SwapMode,getCurrentPoint} from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';
import {u64} from '../sdk/accounting.mjs';
import {prepareEnvelope,messageHash,verifyApproval} from '../sdk/transactions.mjs';
import {riskPolicy} from './lifecycle.mjs';
import {treasuryAddress} from '../sdk/treasury.mjs';
export function boundedSpend(amount,{available,maxSpend,slippageBps}) {
 [amount,available,maxSpend].forEach(u64);
 if(amount===0n||amount>available||amount>maxSpend||!Number.isInteger(slippageBps)||slippageBps<0||slippageBps>100)throw Error('Spend/slippage policy rejected');
}
export async function quoteMarket(dbc,{amount,swapBaseForQuote,slippageBps,now=Date.now()}){
 u64(amount);if(amount===0n||!Number.isInteger(slippageBps)||slippageBps<0||slippageBps>100)throw Error('Invalid quote request');
 const {pool,config,mint}=await dbc.verify();
 const currentPoint=await getCurrentPoint(dbc.connection,config.activationType);
 const quote=dbc.client.pool.swapQuote2({virtualPool:pool,config,swapBaseForQuote,amountIn:new BN(amount.toString()),slippageBps,hasReferral:false,currentPoint,swapMode:SwapMode.ExactIn});
 const minimum=BigInt(quote.minimumAmountOut?.toString()??'0');
 if(minimum<=0n)throw Error('A positive protected output is required');
 const priceQuoteAtoms=swapBaseForQuote?minimum*10n**BigInt(mint.decimals)/amount:amount*10n**BigInt(mint.decimals)/minimum;
 if(priceQuoteAtoms<=0n)throw Error('Quote precision is insufficient');
 return {mint,minimum,market:{observedAt:now,priceQuoteAtoms,verified:true,pool:dbc.expected.pool,mint:dbc.expected.mint,source:'official-dbc-exact-input-quote'}};
}
async function envelopeFor(dbc,tx,context){
 const c=dbc.connection,latest=await c.getLatestBlockhash('finalized');
 tx.feePayer=new PublicKey(dbc.expected.payer);tx.recentBlockhash=latest.blockhash;
 const fee=await c.getFeeForMessage(tx.compileMessage(),'finalized');
 if(fee.value===null)throw Error('Network fee unavailable');
 const simulation=await c.simulateTransaction(tx);
 if(simulation.value.err)throw Error('Unsigned execution simulation failed');
 return prepareEnvelope(tx,latest.lastValidBlockHeight,{...context,networkFee:fee.value});
}
export async function prepareDbcExecution({dbc,owner,amount,swapBaseForQuote,policy,kind,now=Date.now()}){
 if(!['strategy','buyback'].includes(kind))throw Error('Unsupported execution kind');
 boundedSpend(amount,policy);
 const {mint,minimum,market}=await quoteMarket(dbc,{amount,swapBaseForQuote,slippageBps:policy.slippageBps,now});
 if(kind==='strategy'){
  if(!policy.allowedPools?.includes(dbc.expected.pool)||!policy.allowedMints?.includes(dbc.expected.mint))throw Error('Strategy venue/asset not admitted');
  riskPolicy({...policy,market,amount,now,maxSlippageBps:policy.slippageBps});
 }else if(swapBaseForQuote)throw Error('Buyback must exchange SOL for configured COMPD mint');
 const tx=await dbc.client.pool.swap2({owner:new PublicKey(owner),payer:new PublicKey(dbc.expected.payer),pool:new PublicKey(dbc.expected.pool),swapBaseForQuote,referralTokenAccount:null,amountIn:new BN(amount.toString()),minimumAmountOut:new BN(minimum.toString()),swapMode:SwapMode.ExactIn});
 if(kind==='buyback'){
  const ata=getAssociatedTokenAddressSync(new PublicKey(dbc.expected.mint),new PublicKey(owner));
  tx.add(createBurnCheckedInstruction(ata,new PublicKey(dbc.expected.mint),new PublicKey(owner),minimum,mint.decimals,[],TOKEN_PROGRAM_ID));
 }
 return envelopeFor(dbc,tx,{kind,owner:new PublicKey(owner).toBase58(),mint:dbc.expected.mint,pool:dbc.expected.pool,amount:amount.toString(),minimumOutput:minimum.toString(),burnAmount:kind==='buyback'?minimum.toString():'0',swapBaseForQuote,observedAt:now,slippageBps:policy.slippageBps});
}
// Build strategy policy from the actual program account rather than caller-entered balances.
export async function prepareTreasuryStrategy({treasuryClient,authority,dbc,owner,amount,swapBaseForQuote,limits,now=Date.now()}){
 const program=treasuryClient.program,address=treasuryAddress(program.programId,authority);
 const state=await program.account.treasury.fetch(address,'finalized');
 if(!state.authority.equals(new PublicKey(authority))||!state.executor.equals(new PublicKey(owner)))throw Error('Treasury execution identity mismatch');
 return prepareDbcExecution({dbc,owner,amount,swapBaseForQuote,kind:'strategy',now,policy:{...limits,available:BigInt(state.strategy.toString()),capital:BigInt(state.strategy.toString())+BigInt(state.deployed.toString()),deployed:BigInt(state.deployed.toString()),activeRuns:state.runs,paused:state.paused}});
}
export function authorizeExecution({envelope,approval,authority,height,allowedOwner,maxSpend,now=Date.now()}){
 const c=envelope.context;
 if(c.owner!==new PublicKey(allowedOwner).toBase58()||BigInt(c.amount)>u64(maxSpend)||!Number.isSafeInteger(c.observedAt)||now<c.observedAt||now-c.observedAt>60000)throw Error('Execution authorization policy rejected');
 const tx=Transaction.from(Buffer.from(envelope.unsignedBase64,'base64'));
 if(messageHash(tx)!==envelope.messageHash||!verifyApproval(envelope,approval,authority,height))throw Error('Exact owner approval required');
 return {status:'AUTHORIZED_FOR_EXTERNAL_WALLET',messageHash:envelope.messageHash};
}
export async function confirmExecution({connection,signature,envelope}){
 const tx=await connection.getTransaction(signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
 const plan=Transaction.from(Buffer.from(envelope.unsignedBase64,'base64'));
 if(!tx||tx.meta?.err||tx.version!=='legacy'||messageHash(plan)!==envelope.messageHash||!tx.transaction.message.serialize().equals(plan.serializeMessage()))throw Error('Execution is not the finalized approved message');
 // This confirms the exact swap/burn message succeeded, not realized profit.
 return {signature,slot:tx.slot,messageHash:envelope.messageHash,kind:envelope.context.kind,status:'FINALIZED'};
}
