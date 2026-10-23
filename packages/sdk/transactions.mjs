import { createHash, createPublicKey, verify } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
export function messageHash(transaction) {
  return createHash('sha256').update(transaction.serializeMessage()).digest('hex');
}
export function contextHash(context) {
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
  return createHash('sha256').update(JSON.stringify(canonical(context))).digest('hex');
}
export function prepareEnvelope(transaction, lastValidBlockHeight, context) {
  if (!Number.isSafeInteger(lastValidBlockHeight) || lastValidBlockHeight <= 0) throw Error('Missing expiry');
  if (transaction.signatures.some(s => s.signature !== null)) throw Error('Signed input rejected');
  const message = transaction.compileMessage();
  return { messageHash: messageHash(transaction), context, lastValidBlockHeight,
    requiredSigners: message.accountKeys.slice(0, message.header.numRequiredSignatures).map(k => k.toBase58()),
    unsignedBase64: transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64') };
}
// Verify an owner approval of this exact message and expiry; does not sign a transaction.
export function verifyApproval(envelope, approval, authority, height) {
  if (!Number.isSafeInteger(height) || height < 0 || !Number.isSafeInteger(envelope.lastValidBlockHeight) || envelope.lastValidBlockHeight <= 0) return false;
  if (height > envelope.lastValidBlockHeight || approval.messageHash !== envelope.messageHash || approval.expiresAtHeight !== envelope.lastValidBlockHeight) return false;
  const payload = Buffer.from(`COMPD_APPROVAL_V2:${envelope.messageHash}:${contextHash(envelope.context)}:${envelope.lastValidBlockHeight}`);
  const der = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), new PublicKey(authority).toBuffer()]);
  return verify(null, payload, createPublicKey({ key: der, format: 'der', type: 'spki' }), Buffer.from(approval.signatureBase64, 'base64'));
}
