import { DatabaseSync } from 'node:sqlite';
import { split, u64 } from '../sdk/accounting.mjs';
export class Journal {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS receipts(signature TEXT PRIMARY KEY,pool TEXT NOT NULL,mint TEXT NOT NULL,receiver TEXT NOT NULL,slot INTEGER NOT NULL,amount TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS buckets(name TEXT PRIMARY KEY,amount TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS cycles(id INTEGER PRIMARY KEY,state TEXT NOT NULL,error TEXT);
      CREATE TABLE IF NOT EXISTS plans(hash TEXT PRIMARY KEY,envelope TEXT NOT NULL,state TEXT NOT NULL);
      INSERT OR IGNORE INTO buckets VALUES('strategy','0'),('buyback','0'),('rewards','0'),('reserve','0');`);
  }
  balances() { return Object.fromEntries(this.db.prepare('SELECT * FROM buckets').all().map(r => [r.name, BigInt(r.amount)])); }
  receipt(r) {
    u64(r.amount); if (!r.signature || r.amount === 0n || !Number.isSafeInteger(r.slot) || r.slot < 0) throw Error('Invalid receipt');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const prior = this.db.prepare('SELECT * FROM receipts WHERE signature=?').get(r.signature);
      if (prior) {
        if (['pool','mint','receiver','slot'].some(k => prior[k] !== r[k]) || prior.amount !== r.amount.toString()) throw Error('Duplicate signature has conflicting evidence');
        this.db.exec('ROLLBACK'); return false;
      }
      this.db.prepare('INSERT INTO receipts VALUES(?,?,?,?,?,?)').run(r.signature,r.pool,r.mint,r.receiver,r.slot,r.amount.toString());
      const parts=split(r.amount), balances=this.balances();
      for (const k of Object.keys(parts)) this.db.prepare('UPDATE buckets SET amount=? WHERE name=?').run(u64(balances[k]+parts[k]).toString(),k);
      u64(Object.values(this.balances()).reduce((a,b)=>a+b,0n));
      this.db.exec('COMMIT'); return true;
    } catch (e) { if (this.db.isTransaction) this.db.exec('ROLLBACK'); throw e; }
  }
  recordPlan(envelope) {
    this.db.prepare('INSERT INTO plans VALUES(?,?,?)').run(envelope.messageHash,JSON.stringify(envelope),'PREPARED');
  }
  startCycle(id) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const prior=this.db.prepare('SELECT state FROM cycles WHERE id=?').get(id);
      if(prior?.state === 'COMPLETE' || prior?.state === 'RUNNING') {this.db.exec('ROLLBACK');return false;}
      this.db.prepare('INSERT INTO cycles VALUES(?,?,NULL) ON CONFLICT(id) DO UPDATE SET state=excluded.state,error=NULL').run(id,'RUNNING');
      this.db.exec('COMMIT');return true;
    } catch(e){if(this.db.isTransaction)this.db.exec('ROLLBACK');throw e;}
  }
  finishCycle(id,error=null){this.db.prepare('UPDATE cycles SET state=?,error=? WHERE id=?').run(error?'FAILED':'COMPLETE',error,id);}
  recoverCycle(id) { // Explicit operator recovery only; never steal a live worker's cycle.
    this.db.prepare("UPDATE cycles SET state='FAILED',error='Operator marked interrupted cycle for retry' WHERE id=? AND state='RUNNING'").run(id);
  }
  reconcile(expectedUnspent) {
    u64(expectedUnspent);
    const total=Object.values(this.balances()).reduce((a,b)=>a+b,0n);
    if(total!==expectedUnspent)throw Error('Ledger/reconciled-receipt balance mismatch');return total;
  }
  close(){this.db.close();}
}
