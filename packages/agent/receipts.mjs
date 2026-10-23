import {verifyApproval} from '../sdk/transactions.mjs';
export async function recordConfirmedClaim({dbc,journal,signature,envelope}) {
  // Gross fee accounting describes assets held at the configured receiver, not the on-chain Treasury PDA.
  // A separate authorized deposit must be confirmed before treating these as program-custodied funds.
  const receipt=await dbc.confirmedReceipt(signature,envelope);
  return {receipt,inserted:journal.receipt(receipt)};
}
export function authorizePreparation({envelope,approval,authority,height}) {
  if(!verifyApproval(envelope,approval,authority,height))throw Error('Owner approval invalid or expired');
  return {messageHash:envelope.messageHash,status:'APPROVED_FOR_EXTERNAL_WALLET',lastValidBlockHeight:envelope.lastValidBlockHeight};
}
