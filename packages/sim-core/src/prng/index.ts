/**
 * FNV-1a 32-bit integer hash implementation
 */
export function hashFnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type PRNG = () => number;

/**
 * SFC32 PRNG (Simple Fast Counter, 32-bit)
 * Passes SmallCrush and PractRand tests with 2^128 state size.
 */
export function createSfc32(a: number, b: number = 0, c: number = 0, d: number = 0): PRNG {
  let sA = (a | 0) >>> 0;
  let sB = (b | 0) >>> 0;
  let sC = (c | 0) >>> 0;
  let sD = (d | 0) >>> 0;

  // Warm up generator
  for (let i = 0; i < 15; i++) {
    const t = (((sA + sB) | 0) + sD) | 0;
    sD = (sD + 1) | 0;
    sA = sB ^ (sB >>> 9);
    sB = (sC + (sC << 3)) | 0;
    sC = (sC << 21) | (sC >>> 11);
    sC = (sC + t) | 0;
  }

  return function next(): number {
    const t = (((sA + sB) | 0) + sD) | 0;
    sD = (sD + 1) | 0;
    sA = sB ^ (sB >>> 9);
    sB = (sC + (sC << 3)) | 0;
    sC = (sC << 21) | (sC >>> 11);
    sC = (sC + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/**
 * Isolated Seeded PRNG Pool to guarantee determinism separation
 * between physics, visual effects (VFX), and audio humanization.
 */
export class SeededRNGPool {
  public readonly masterSeed: number;
  public readonly physics: PRNG;
  public readonly vfx: PRNG;
  public readonly audio: PRNG;

  constructor(masterSeed: number) {
    this.masterSeed = masterSeed;
    this.physics = createSfc32(hashFnv1a(`${masterSeed}:physics`), 0x12345678, 0x9abcdef0, 0x0fedcba9);
    this.vfx = createSfc32(hashFnv1a(`${masterSeed}:vfx`), 0x23456789, 0xabcdef01, 0x1fedcba9);
    this.audio = createSfc32(hashFnv1a(`${masterSeed}:audio`), 0x3456789a, 0xbcdef012, 0x2fedcba9);
  }

  /**
   * Helper to sample uniform range [min, max]
   */
  public static range(rng: PRNG, min: number, max: number): number {
    return min + rng() * (max - min);
  }

  /**
   * Helper to sample random int [min, max]
   */
  public static rangeInt(rng: PRNG, min: number, max: number): number {
    return Math.floor(min + rng() * (max - min + 1));
  }
}
