import test from 'node:test';
import assert from 'node:assert/strict';
import {split,credit,U64_MAX,liquid} from '../packages/sdk/accounting.mjs';
test('revenue and profit use separate allocations',()=>{
 assert.deepEqual(split(100n),{strategy:35n,buyback:15n,rewards:0n,reserve:50n});
 assert.deepEqual(split(100n,true),{strategy:65n,buyback:15n,rewards:10n,reserve:10n});
});
test('rounding conserves all lamports including u64 maximum',()=>{
 for(const profit of [false,true])for(const amount of [0n,1n,2n,99n,101n,10001n,U64_MAX])assert.equal(liquid(split(amount,profit)),amount);
});
test('unsafe numeric inputs and overflows fail without mutating buckets',()=>{
 for(const bad of [-1n,U64_MAX+1n,1,NaN,'100'])assert.throws(()=>split(bad));
 const b={strategy:0n,buyback:0n,rewards:0n,reserve:U64_MAX};
 assert.throws(()=>credit(b,100n));assert.equal(b.reserve,U64_MAX);
});
