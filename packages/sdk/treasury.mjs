import { Program, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { createHash } from 'node:crypto';
import { u64 } from './accounting.mjs';
const integerBytes=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(u64(n));return b;};
export function treasuryAddress(programId,authority){return PublicKey.findProgramAddressSync([Buffer.from('treasury'),new PublicKey(authority).toBuffer()],new PublicKey(programId))[0];}
export function runAddress(programId,treasury,id){return PublicKey.findProgramAddressSync([Buffer.from('run'),new PublicKey(treasury).toBuffer(),integerBytes(id)],new PublicKey(programId))[0];}
export function distributionAddress(programId,treasury,id){return PublicKey.findProgramAddressSync([Buffer.from('distribution'),new PublicKey(treasury).toBuffer(),integerBytes(id)],new PublicKey(programId))[0];}
export function holderLeaf(distribution,index,holder,amount){return createHash('sha256').update(Buffer.concat([Buffer.from('COMPD_HOLDER_V1'),new PublicKey(distribution).toBuffer(),integerBytes(index),new PublicKey(holder).toBuffer(),integerBytes(amount)])).digest();}
export function merkleParent(a,b){return createHash('sha256').update(Buffer.concat(Buffer.compare(a,b)<=0?[a,b]:[b,a])).digest();}
// Only an IDL produced by the actual build is accepted. No hand-written instruction layout.
export class TreasuryClient {
 constructor(idl,provider,expectedProgramId){
  if(idl.address!==new PublicKey(expectedProgramId).toBase58())throw Error('IDL program mismatch');
  this.program=new Program(idl,provider);
 }
 async revenue({authority,nonce,amount}){
  const treasury=treasuryAddress(this.program.programId,authority);
  return this.program.methods.receiveRevenue(new BN(u64(nonce).toString()),new BN(u64(amount).toString())).accountsPartial({authority:new PublicKey(authority),treasury,systemProgram:SystemProgram.programId}).transaction();
 }
 async allocate({authority,executor,id,amount}){
  const treasury=treasuryAddress(this.program.programId,authority);
  return this.program.methods.allocate(new BN(u64(id).toString()),new BN(u64(amount).toString())).accountsPartial({authority:new PublicKey(authority),treasury,executor:new PublicKey(executor),run:runAddress(this.program.programId,treasury,id),systemProgram:SystemProgram.programId}).transaction();
 }
 async settle({authority,executor,id,returned}){
  const treasury=treasuryAddress(this.program.programId,authority);
  return this.program.methods.settle(new BN(u64(returned).toString())).accountsPartial({authority:new PublicKey(authority),treasury,executor:new PublicKey(executor),run:runAddress(this.program.programId,treasury,id),systemProgram:SystemProgram.programId}).transaction();
 }
 async initialize({authority,mint,executor,buybackRecipient,reserveRecipient}){
  const treasury=treasuryAddress(this.program.programId,authority);
  return this.program.methods.initialize(new PublicKey(mint),new PublicKey(executor),new PublicKey(buybackRecipient),new PublicKey(reserveRecipient)).accountsPartial({authority:new PublicKey(authority),treasury,systemProgram:SystemProgram.programId}).transaction();
 }
 async fundRewards({authority,id,root,amount}){
  const bytes=Buffer.from(root,'hex');if(bytes.length!==32)throw Error('Invalid Merkle root');
  const treasury=treasuryAddress(this.program.programId,authority),distribution=distributionAddress(this.program.programId,treasury,id);
  return this.program.methods.createDistribution(new BN(u64(id).toString()),[...bytes],new BN(u64(amount).toString())).accountsPartial({authority:new PublicKey(authority),treasury,distribution,systemProgram:SystemProgram.programId}).transaction();
 }
 async claimReward({distribution,holder,index,amount,proof}){
  if(proof.length>32)throw Error('Merkle proof too long');
  const nodes=proof.map(h=>{const b=Buffer.from(h,'hex');if(b.length!==32)throw Error('Invalid proof node');return [...b];});
  const claimed=PublicKey.findProgramAddressSync([Buffer.from('claimed'),new PublicKey(distribution).toBuffer(),integerBytes(index)],this.program.programId)[0];
  return this.program.methods.claim(new BN(u64(index).toString()),new BN(u64(amount).toString()),nodes).accountsPartial({holder:new PublicKey(holder),distribution:new PublicKey(distribution),claimed,systemProgram:SystemProgram.programId}).transaction();
 }
}
