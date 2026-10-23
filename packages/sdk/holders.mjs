import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID,unpackAccount,unpackMint} from '@solana/spl-token';
import {holderLeaf,merkleParent} from './treasury.mjs';
import {u64} from './accounting.mjs';
export async function snapshotFromVerifiedPool(dbc,excludedAccounts){
 const {state}=await dbc.verify();
 return holderSnapshot(dbc.connection,{mint:dbc.expected.mint,poolBaseVault:state.baseVault,excludedAccounts});
}
export async function holderSnapshot(connection,{mint,excludedAccounts,poolBaseVault}) {
 const mintKey=new PublicKey(mint),vault=new PublicKey(poolBaseVault).toBase58();
 const exclusions=new Set(excludedAccounts.map(a=>new PublicKey(a).toBase58()));
 if(!exclusions.has(vault))throw Error('Pool inventory must be explicitly excluded');
 const discovery=await connection.getProgramAccounts(TOKEN_PROGRAM_ID,{commitment:'finalized',withContext:true,filters:[{dataSize:165},{memcmp:{offset:0,bytes:mintKey.toBase58()}}]});
 if(discovery.value.length>99)throw Error('More than 99 token accounts: atomic-bank snapshot backend required');
 const addresses=discovery.value.map(a=>a.pubkey);
 const bank=await connection.getMultipleAccountsInfoAndContext([mintKey,...addresses],{commitment:'finalized',minContextSlot:discovery.context.slot});
 if(bank.context.slot<discovery.context.slot||bank.value.some(a=>!a))throw Error('Incomplete snapshot');
 const mintState=unpackMint(mintKey,bank.value[0],TOKEN_PROGRAM_ID);
 if(!mintState.isInitialized||mintState.mintAuthority||mintState.freezeAuthority)throw Error('Unqualified mint');
 const tokens=addresses.map((address,i)=>{
  const account=unpackAccount(address,bank.value[i+1],TOKEN_PROGRAM_ID);
  if(!account.mint.equals(mintKey)||!account.isInitialized)throw Error('Token identity changed during snapshot');
  return {address:address.toBase58(),owner:account.owner.toBase58(),amount:account.amount,frozen:account.isFrozen};
 });
 return qualifySnapshot({mint:mintKey.toBase58(),slot:bank.context.slot,supply:mintState.supply,tokens,exclusions});
}
export function qualifySnapshot({mint,slot,supply,tokens,exclusions}) {
 u64(supply);if(!Number.isSafeInteger(slot)||slot<0)throw Error('Invalid finalized slot');
 const seen=new Set(),balances=new Map();let total=0n;
 const excluded=[];
 for(const t of tokens){
  if(seen.has(t.address))throw Error('Duplicate token account');seen.add(t.address);u64(t.amount);total+=t.amount;
  const owner=new PublicKey(t.owner);
  if(exclusions.has(t.address)||t.frozen||!PublicKey.isOnCurve(owner.toBytes())){excluded.push(t);continue;}
  balances.set(t.owner,u64((balances.get(t.owner)??0n)+t.amount));
 }
 if(total!==supply)throw Error('Snapshot accounts do not reconcile to mint supply');
 return {mint,slot,supply,holders:[...balances].filter(([,amount])=>amount>0n).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([owner,amount])=>({owner,amount})),excluded};
}
export function rewardTree(snapshot,distribution,budget) {
 u64(budget);new PublicKey(distribution);
 const total=snapshot.holders.reduce((n,h)=>n+u64(h.amount),0n);
 if(total===0n||budget===0n)throw Error('No eligible reward allocation');
 const rows=snapshot.holders.map(h=>({owner:h.owner,amount:budget*h.amount/total})).filter(h=>h.amount>0n).map((h,i)=>({...h,index:BigInt(i)}));
 if(!rows.length)throw Error('Budget rounds entirely to zero');
 const layers=[rows.map(r=>holderLeaf(distribution,r.index,r.owner,r.amount))];
 while(layers.at(-1).length>1){const last=layers.at(-1),next=[];for(let i=0;i<last.length;i+=2)next.push(i+1<last.length?merkleParent(last[i],last[i+1]):last[i]);layers.push(next);}
 for(let i=0;i<rows.length;i++){let index=i;rows[i].proof=[];for(const layer of layers.slice(0,-1)){const sibling=index^1;if(sibling<layer.length)rows[i].proof.push(layer[sibling].toString('hex'));index=Math.floor(index/2);}}
 const funded=rows.reduce((n,r)=>n+r.amount,0n);
 return {distribution:new PublicKey(distribution).toBase58(),root:layers.at(-1)[0].toString('hex'),funded,remainder:budget-funded,slot:snapshot.slot,mint:snapshot.mint,rows,
  snapshotHash:createHash('sha256').update(JSON.stringify(snapshot,(_,v)=>typeof v==='bigint'?v.toString():v)).digest('hex')};
}
export function reconcileRewards({tree,distributionState,paidClaims,actualLamports,rent}) {
 if(Buffer.from(distributionState.root).toString('hex')!==tree.root)throw Error('Funded root mismatch');
 const seen=new Set();let paid=0n;
 for(const claim of paidClaims){const key=claim.index.toString();if(seen.has(key))throw Error('Duplicate claim evidence');seen.add(key);
  const row=tree.rows.find(r=>r.index===claim.index);if(!row||row.owner!==claim.owner||row.amount!==claim.amount)throw Error('Claim differs from funded allocation');paid+=u64(claim.amount);}
 const remaining=tree.funded-paid;
 if(remaining<0n||u64(distributionState.remaining)!==remaining||u64(actualLamports)!==u64(rent)+remaining)throw Error('Distribution funding reconciliation failed');
 return {paid,remaining};
}
// Read distribution and all claim PDAs in one finalized bank; no caller-invented payment evidence.
export async function reconcileFundedRewards({connection,treasuryClient,tree,treasury}){
 if(tree.rows.length>99)throw Error('Reward reconciliation exceeds atomic RPC batch limit');
 const program=treasuryClient.program,distribution=new PublicKey(tree.distribution);
 const claimed=tree.rows.map(row=>{const index=Buffer.alloc(8);index.writeBigUInt64LE(u64(row.index));return PublicKey.findProgramAddressSync([Buffer.from('claimed'),distribution.toBuffer(),index],program.programId)[0];});
 const bank=await connection.getMultipleAccountsInfoAndContext([distribution,...claimed],{commitment:'finalized'});
 const info=bank.value[0];
 if(!info||!info.owner.equals(program.programId)||!Number.isSafeInteger(info.lamports))throw Error('Funded distribution account missing or invalid');
 const state=program.coder.accounts.decode('distribution',info.data);
 if(!state.treasury.equals(new PublicKey(treasury)))throw Error('Distribution treasury mismatch');
 const paidClaims=[];
 for(let i=0;i<tree.rows.length;i++)if(bank.value[i+1]){
  const claim=bank.value[i+1];if(!claim.owner.equals(program.programId))throw Error('Claim PDA owner mismatch');
  program.coder.accounts.decode('claimed',claim.data);
  const row=tree.rows[i];paidClaims.push({index:row.index,owner:row.owner,amount:row.amount});
 }
 const rent=await connection.getMinimumBalanceForRentExemption(info.data.length,'finalized');
 if(!Number.isSafeInteger(rent))throw Error('Unsafe rent precision');
 return {slot:bank.context.slot,...reconcileRewards({tree,distributionState:{root:state.root,remaining:BigInt(state.remaining.toString())},paidClaims,actualLamports:BigInt(info.lamports),rent:BigInt(rent)})};
}
