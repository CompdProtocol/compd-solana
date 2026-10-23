export const U64_MAX = (1n << 64n) - 1n;
export function u64(value) {
  if (typeof value !== 'bigint' || value < 0n || value > U64_MAX) throw Error('Expected u64 bigint');
  return value;
}
export function split(amount, profit = false) {
  u64(amount);
  const [s, b, h] = profit ? [65n, 15n, 10n] : [35n, 15n, 0n];
  const strategy = amount * s / 100n, buyback = amount * b / 100n, rewards = amount * h / 100n;
  return { strategy, buyback, rewards, reserve: amount - strategy - buyback - rewards };
}
export function liquid(buckets) { return u64(Object.values(buckets).reduce((a, b) => a + u64(b), 0n)); }
export function credit(buckets, amount, profit = false) {
  const allocation = split(amount, profit);
  const next = Object.fromEntries(Object.keys(allocation).map(k => [k, u64(buckets[k] + allocation[k])]));
  liquid(next); return next;
}
