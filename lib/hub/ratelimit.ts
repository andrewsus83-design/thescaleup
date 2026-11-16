// A small per-instance rate limit (same idea as the sign-in limiter in actions.ts). Good enough to stop a stuck button or
// a runaway script from running up an AI bill; not a substitute for a real usage cap, which comes with the usage ledger.
const hits = new Map<string, { n: number; reset: number }>();

export function allow(key: string, max: number, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  const e = hits.get(key);
  if (!e || now > e.reset) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (e.n >= max) return false;
  e.n++;
  return true;
}
