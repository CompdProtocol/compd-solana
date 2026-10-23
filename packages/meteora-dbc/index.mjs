import { DynamicBondingCurveClient, DYNAMIC_BONDING_CURVE_PROGRAM_ID } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { PublicKey, Connection, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, NATIVE_MINT, getMint, getAssociatedTokenAddressSync, getAccount } from '@solana/spl-token';
import { utils } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { createHash } from 'node:crypto';
import { prepareEnvelope, messageHash } from '../sdk/transactions.mjs';
const same = (a, b) => new PublicKey(a).equals(new PublicKey(b));
export const PROGRAM_ID = DYNAMIC_BONDING_CURVE_PROGRAM_ID;
export function validatePool(pool, config, expected) {
  const p = pool.poolState;
  if (!same(p.baseMint, expected.mint) || !same(p.creator, expected.creator) || !same(p.config, expected.config)) throw Error('Pool binding mismatch');
  if (!same(config.quoteMint, NATIVE_MINT) || config.creatorTradingFeePercentage <= 0) throw Error('No SOL creator-fee entitlement');
  if (p.isMigrated !== 0 || p.migrationProgress !== 0) throw Error('Migration: DBC claims suspended; DAMM integration required');
  return p;
}
export class Dbc {
  constructor(connection, expected) {
    for (const name of ['mint', 'creator', 'pool', 'config', 'receiver', 'payer']) new PublicKey(expected[name]);
    if (!expected.genesisHash) throw Error('An independently verified cluster genesis hash is required');
    if (new PublicKey(expected.mint).equals(NATIVE_MINT)) throw Error('COMPD base mint must differ from SOL quote mint');
    this.connection = connection; this.expected = {...expected,...Object.fromEntries(['mint','creator','pool','config','receiver','payer'].map(name=>[name,new PublicKey(expected[name]).toBase58()]))};
    this.client = new DynamicBondingCurveClient(connection, 'finalized');
  }
  static connect(rpcUrl, expected) {
    if (new URL(rpcUrl).protocol !== 'https:') throw Error('HTTPS RPC required');
    return new Dbc(new Connection(rpcUrl, 'finalized'), expected);
  }
  async verify() {
    const c = this.connection, e = this.expected;
    if (await c.getGenesisHash() !== e.genesisHash) throw Error('Wrong cluster');
    for (const address of [e.pool, e.config]) {
      const account = await c.getAccountInfo(new PublicKey(address), 'finalized');
      if (!account || !account.owner.equals(PROGRAM_ID)) throw Error('Invalid DBC account owner');
    }
    if (await this.client.state.isTransferHookPool(e.pool)) throw Error('Transfer-hook pools are not qualified');
    const [pool, config, mint] = await Promise.all([
      this.client.state.getPool(e.pool), this.client.state.getPoolConfig(e.config),
      getMint(c, new PublicKey(e.mint), 'finalized', TOKEN_PROGRAM_ID),
    ]);
    if (!pool || !config || mint.freezeAuthority || mint.mintAuthority) throw Error('Mint/pool not qualified');
    const p = validatePool(pool, config, e);
    return { pool, config, mint, state: p };
  }
  async discover() {
    const pools = await this.client.state.getPoolsByCreator(new PublicKey(this.expected.creator));
    return pools.filter(p => same(p.account.poolState.baseMint, this.expected.mint)).map(p => p.publicKey.toBase58());
  }
  async tokenAccount(owner) {
    const ata = getAssociatedTokenAddressSync(new PublicKey(this.expected.mint), new PublicKey(owner));
    const info = await getAccount(this.connection, ata, 'finalized', TOKEN_PROGRAM_ID);
    if (!same(info.owner, owner) || !same(info.mint, this.expected.mint)) throw Error('Invalid SPL account');
    return { address: ata.toBase58(), amount: info.amount };
  }
  async prepareClaim() {
    const { state } = await this.verify(), e = this.expected;
    if (state.creatorQuoteFee.isZero()) throw Error('No creator SOL fees available');
    const tx = await this.client.creator.claimCreatorTradingFeeToReceiver({
      creator: new PublicKey(e.creator), payer: new PublicKey(e.payer), pool: new PublicKey(e.pool),
      receiver: new PublicKey(e.receiver), maxBaseAmount: new BN(0), maxQuoteAmount: state.creatorQuoteFee,
    });
    const latest = await this.connection.getLatestBlockhash('finalized');
    tx.feePayer = new PublicKey(e.payer); tx.recentBlockhash = latest.blockhash;
    const fee = await this.connection.getFeeForMessage(tx.compileMessage(), 'finalized');
    if (fee.value === null || await this.connection.getBalance(tx.feePayer, 'finalized') < fee.value) throw Error('Fee payer cannot fund transaction');
    // Rent requirements are additionally validated by unsigned RPC simulation, not by fee alone.
    const simulation = await this.connection.simulateTransaction(tx);
    if (simulation.value.err) throw Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    return prepareEnvelope(tx, latest.lastValidBlockHeight, { kind: 'dbc-creator-claim', ...e, estimatedNetworkFee: fee.value });
  }
  async confirmedReceipt(signature, envelope) {
    const e = this.expected;
    if (envelope.context.kind !== 'dbc-creator-claim' || ['mint','creator','pool','config','receiver','payer','genesisHash'].some(k => envelope.context[k] !== e[k])) throw Error('Plan binding mismatch');
    // Revalidate program account identities; migration transitions fail closed.
    await this.verify();
    const tx = await this.connection.getTransaction(signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
    if (!tx || tx.meta?.err || !tx.meta?.innerInstructions) throw Error('Finalized successful transaction required');
    if (tx.version !== 'legacy') throw Error('Only prepared legacy claims are supported');
    const planned = Transaction.from(Buffer.from(envelope.unsignedBase64, 'base64'));
    if (messageHash(planned) !== envelope.messageHash || !tx.transaction.message.serialize().equals(planned.serializeMessage())) throw Error('Confirmed message differs from plan');
    this.validateClaimInstruction(planned);
    const keys = tx.transaction.message.accountKeys;
    const events = [];
    for (const group of tx.meta.innerInstructions) for (const ix of group.instructions) {
      if (!keys[ix.programIdIndex].equals(PROGRAM_ID)) continue;
      const raw = utils.bytes.bs58.decode(ix.data);
      if (!Buffer.from(raw.subarray(0,8)).equals(createHash('sha256').update('anchor:event').digest().subarray(0,8))) continue;
      // Anchor's documented event-CPI encoding: eight-byte prefix, then IDL-coded event.
      let event; try { event = this.client.program.coder.events.decode(Buffer.from(raw.subarray(8)).toString('base64')); } catch { continue; }
      if (event?.name === 'evtClaimCreatorTradingFee') events.push(event.data);
    }
    const event = uniqueClaim(events, e.pool);
    const receiverIndex = keys.findIndex(k => same(k, e.receiver));
    if (receiverIndex < 0) throw Error('Missing receiver');
    const pre = tx.meta.preBalances[receiverIndex], post = tx.meta.postBalances[receiverIndex];
    if (![pre,post,tx.meta.fee].every(Number.isSafeInteger)) throw Error('RPC lamport precision is unsafe');
    const delta = BigInt(post) - BigInt(pre) + (receiverIndex === 0 ? BigInt(tx.meta.fee) : 0n);
    const amount = BigInt(event.tokenQuoteAmount.toString());
    if (delta !== amount) throw Error('Physical SOL receipt does not equal attributed claim (rent or other balance effects require review)');
    return { signature, pool: e.pool, mint: e.mint, receiver: e.receiver, slot: tx.slot, amount };
  }
  validateClaimInstruction(transaction) {
    const instructions=transaction.instructions.filter(ix=>ix.programId.equals(PROGRAM_ID));
    if(instructions.length!==1)throw Error('Exactly one DBC claim instruction required');
    const ix=instructions[0], decoded=this.client.program.coder.instruction.decode(ix.data);
    if(decoded?.name!=='claimCreatorTradingFee'||!decoded.data.maxBaseAmount.isZero())throw Error('Only quote-only standard creator claims qualified');
    const definition=this.client.program.idl.instructions.find(i=>i.name===decoded.name);
    for(const [name,expected] of [['pool',this.expected.pool],['creator',this.expected.creator],['baseMint',this.expected.mint],['quoteMint',NATIVE_MINT]]){
      const index=definition.accounts.findIndex(a=>a.name===name);
      if(index<0||!ix.keys[index]||!same(ix.keys[index].pubkey,expected))throw Error('Claim instruction account binding mismatch');
    }
  }
}
export function uniqueClaim(events, pool) {
  if (events.length !== 1 || !same(events[0].pool, pool) || BigInt(events[0].tokenBaseAmount.toString()) !== 0n || BigInt(events[0].tokenQuoteAmount.toString()) <= 0n) throw Error('Ambiguous creator fee attribution');
  return events[0];
}
