/** Small, fast, deterministic PRNG (mulberry32) so a given seed always reproduces the same
 * generated pattern/melody -- needed for "regenerate this bar" to only touch the requested
 * region and for tests to assert on exact output. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Pick a random integer seed suitable for a fresh (non-reproduced) generation. */
export function freshSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}

export function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length) % items.length]
}

export function weightedPick<T>(rand: () => number, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0)
  let r = rand() * total
  for (const [item, w] of items) {
    r -= w
    if (r <= 0) return item
  }
  return items[items.length - 1][0]
}

export function chance(rand: () => number, probability: number): boolean {
  return rand() < probability
}
