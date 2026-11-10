import type { PRNG } from "../prng/index.js";

/** One sonic/visual moment emitted by an arena algorithm. All coordinates normalised 0..1. */
export interface ArenaEvent {
  /** Free-form tag, e.g. "settle", "reaction", "improve", "absorb", "reach". */
  kind: string;
  /** Musical intensity 0..1 (drives pitch/velocity mapping in SimCore). */
  magnitude: number;
  x: number;
  y: number;
}

export interface ArenaHudStat {
  label: string;
  value: string;
}

/**
 * A self-contained, deterministic, allocation-free-per-frame algorithm visualiser.
 * Must only use the injected PRNG (never Math.random / Date / performance.now).
 */
export interface ArenaAlgorithm {
  readonly width: number;
  readonly height: number;
  /** Advance by one video frame, spending at most `opsBudget` elementary operations. */
  step(frame: number, dt: number, opsBudget: number, emit: (e: ArenaEvent) => void): void;
  /** Paint the current state into `out` (length width*height, little-endian 0xAABBGGRR). */
  render(out: Uint32Array): void;
  /** 0..1 completion/tension indicator for HUD + Seed Scout. */
  progress(): number;
  /** True when the algorithm reached its natural end state. */
  done(): boolean;
  /** Short HUD lines (<= 3). */
  hud(): ArenaHudStat[];
}

export type ArenaId = "FALLING_SAND" | "TSP_2OPT" | "BFS_LIGHTNING" | "BOIDS";

export interface ArenaParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export type ArenaFactory = (
  width: number,
  height: number,
  rng: PRNG,
  params: Record<string, number>
) => ArenaAlgorithm;

