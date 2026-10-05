/**
 * rng.ts
 * ------
 * Deterministic pseudo-randomness.
 *
 * WHY THIS MATTERS HERE: the mock dataset is generated at module scope and
 * rendered on both the server and the client. Using Math.random() would
 * produce different values on each side and trigger React hydration
 * mismatches. Every "random" value in this application is therefore a pure
 * function of a string seed — stable across renders, reloads, and the
 * server/client boundary, which also makes demos and screenshots
 * reproducible.
 */

/** FNV-1a derived hash mapped to the half-open interval [0, 1). */
export function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000000) / 1000000;
}

/** Integer in [min, max] inclusive. */
export function hashInt(seed: string, min: number, max: number): number {
  return Math.round(min + hash01(seed) * (max - min));
}

/** Float in [min, max) rounded to `decimals`. */
export function hashFloat(seed: string, min: number, max: number, decimals = 2): number {
  const value = min + hash01(seed) * (max - min);
  return Number(value.toFixed(decimals));
}

/** Deterministically picks one element of a non-empty array. */
export function hashPick<T>(seed: string, list: readonly T[]): T {
  if (list.length === 0) throw new Error('hashPick called with an empty list');
  return list[Math.floor(hash01(seed) * list.length) % list.length];
}

/** Deterministic boolean that is true with the given probability. */
export function hashBool(seed: string, probability = 0.5): boolean {
  return hash01(seed) < probability;
}
