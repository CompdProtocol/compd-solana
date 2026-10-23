import {PublicKey,Transaction} from '@solana/web3.js';
import {Program,EventParser} from '@coral-xyz/anchor';
import {messageHash} from '../sdk/transactions.mjs';
import {u64} from '../sdk/accounting.mjs';
import {treasuryAddress} from '../sdk/treasury.mjs';
const serialise=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v);
export class CustodyJournal {
 constructor(db){this.db=db;db.exec('CREATE TABLE IF NOT EXISTS custody(treasury TEXT NOT NULL,sequence TEXT NOT NULL,signature TEXT NOT NULL,event TEXT NOT NULL,PRIMARY KEY(treasury,sequence));');}
 apply(event,signature){
  const sequence=u64(event.sequence),treasury=new PublicKey(event.treasury).toBase58();
  for(const name of ['strategy','buyback','rewards','reserve','deployed','amount'])u64(event[name]);
  const json=serialise(event);this.db.exec('BEGIN IMMEDIATE');
  try{
   const prior=this.db.prepare('SELECT * FROM custody WHERE treasury=? AND sequence=?').get(treasury,sequence.toString());
   if(prior){if(prior.event!==json||prior.signature!==signature)throw Error('Conflicting custody evidence');this.db.exec('ROLLBACK');return false;}
   const rows=this.db.prepare('SELECT sequence FROM custody WHERE treasury=?').all(treasury);
   const expected=rows.reduce((n,r)=>BigInt(r.sequence)>=n?BigInt(r.sequence)+1n:n,0n);
   if(sequence!==expected)throw Error('Custody sequence gap: backfill required');
   this.db.prepare('INSERT INTO custody VALUES(?,?,?,?)').run(treasury,sequence.toString(),signature,json);
   this.db.exec('COMMIT');return true;
  }catch(e){if(this.db.isTransaction)this.db.exec('ROLLBACK');throw e;}
 }
 latest(treasury){const rows=this.db.prepare('SELECT event FROM custody WHERE treasury=?').all(new PublicKey(treasury).toBase58());return rows.map(r=>JSON.parse(r.event)).sort((a,b)=>BigInt(a.sequence)<BigInt(b.sequence)?-1:1).at(-1)??null;}
}
export async function finalizedCustodyEvents({connection,signature,envelope,idl,programId,treasury}){
 const id=new PublicKey(programId),target=new PublicKey(treasury);
 if(idl.address!==id.toBase58())throw Error('Custody IDL mismatch');
 const tx=await connection.getTransaction(signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
 const plan=Transaction.from(Buffer.from(envelope.unsignedBase64,'base64'));
 if(!tx||tx.meta?.err||tx.version!=='legacy'||messageHash(plan)!==envelope.messageHash||!tx.transaction.message.serialize().equals(plan.serializeMessage()))throw Error('Custody transaction does not match plan');
 const coder=new Program(idl,{connection}).coder;
 const events=[...new EventParser(id,coder).parseLogs(tx.meta.logMessages??[])].filter(e=>e.name==='custody');
 if(!events.length)throw Error('Missing program custody events');
 return events.map(({data})=>{
  if(!data.treasury.equals(target))throw Error('Unexpected treasury event');
  const event={treasury:target.toBase58(),kind:data.kind};
  for(const key of ['sequence','reference','amount','strategy','buyback','rewards','reserve','deployed'])event[key]=u64(BigInt(data[key].toString()));
  return event;
 });
}
export async function reconcileCustody({connection,idl,programId,treasury,journal}){
 if(idl.address!==new PublicKey(programId).toBase58())throw Error('Custody IDL mismatch');
 const response=await connection.getAccountInfoAndContext(new PublicKey(treasury),'finalized'),info=response.value;
 if(!info||!info.owner.equals(new PublicKey(programId))||!Number.isSafeInteger(info.lamports))throw Error('Invalid custody account');
 const state=new Program(idl,{connection}).coder.accounts.decode('treasury',info.data),latest=journal.latest(treasury);
 if(!treasuryAddress(programId,state.authority).equals(new PublicKey(treasury)))throw Error('Treasury PDA mismatch');
 if(!latest||BigInt(state.eventNonce.toString())!==BigInt(latest.sequence)+1n)throw Error('Custody journal requires backfill');
 let liquid=0n;
 for(const name of ['strategy','buyback','rewards','reserve']){const amount=u64(BigInt(state[name].toString()));if(amount!==BigInt(latest[name]))throw Error('Ledger bucket mismatch');liquid+=amount;}
 if(BigInt(state.deployed.toString())!==BigInt(latest.deployed))throw Error('Deployed principal mismatch');
 const rent=await connection.getMinimumBalanceForRentExemption(info.data.length,'finalized');
 if(!Number.isSafeInteger(rent)||BigInt(info.lamports)<liquid+BigInt(rent))throw Error('Custody insolvency');
 return {slot:response.context.slot,liquid,unclassified:BigInt(info.lamports)-BigInt(rent)-liquid};
}
