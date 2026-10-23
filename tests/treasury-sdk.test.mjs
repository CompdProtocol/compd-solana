import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicKey} from '@solana/web3.js';
import {treasuryAddress,runAddress,distributionAddress,holderLeaf,merkleParent} from '../packages/sdk/treasury.mjs';
const k=n=>new PublicKey(Buffer.alloc(32,n));
test('treasury/run/distribution PDA domains and nonces are separate',()=>{
 const treasury=treasuryAddress(k(1),k(2));
 assert.ok(!runAddress(k(1),treasury,0n).equals(runAddress(k(1),treasury,1n)));
 assert.ok(!distributionAddress(k(1),treasury,0n).equals(runAddress(k(1),treasury,0n)));
 assert.throws(()=>runAddress(k(1),treasury,-1n));
});
test('holder leaf commits to distribution, index, recipient and amount',()=>{
 const leaf=holderLeaf(k(1),0n,k(2),100n);
 for(const other of [holderLeaf(k(3),0n,k(2),100n),holderLeaf(k(1),1n,k(2),100n),holderLeaf(k(1),0n,k(3),100n),holderLeaf(k(1),0n,k(2),101n)])assert.notDeepEqual(leaf,other);
 const b=holderLeaf(k(1),1n,k(2),100n);assert.deepEqual(merkleParent(leaf,b),merkleParent(b,leaf));
});
