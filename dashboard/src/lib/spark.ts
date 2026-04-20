/**
 * Deterministic synthetic curve generator. Until per-strategy historical
 * equity is available from the API, we synthesize a visually plausible walk
 * from `id` (seed) + `target` (final value) + `n` (length).
 */
export function synthSpark(id: string, target: number, n = 18): number[] {
  if (n < 2) return [];
  let seed = 0;
  for (let i = 0; i < id.length; i++) {
    seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  }
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed & 0xffff) / 0xffff;
  };
  const out: number[] = [];
  let v = 0;
  const drift = target / n;
  const noiseAmp = Math.max(0.4, Math.abs(target) / 6);
  for (let i = 0; i < n; i++) {
    const noise = (rand() - 0.5) * noiseAmp;
    v += drift + noise;
    out.push(v);
  }
  return out;
}
