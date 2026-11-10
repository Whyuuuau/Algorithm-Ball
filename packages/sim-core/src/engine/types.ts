import type { ArenaHudStat } from "../arena/types.js";
import type { BallPool } from "./BallPool.js";

export type HitKind = "floor" | "break" | "peg" | "wall" | "ring" | "ring_break" | "exit" | "arena" | "sfx";

/** Raw, musically-agnostic event. Audio-core turns these into notes. */
export interface HitEvent {
  /** seconds on the video timeline */
  t: number;
  kind: HitKind;
  /** lane index (0 for single-lane scenes) */
  lane: number;
  /** floor number (1-based) / ring index / arena kind hash */
  index: number;
  /** normalised 0..1 position of the impact */
  x: number;
  y: number;
  /** normalised impact intensity 0..1 */
  vel: number;
  /** number of raw impacts merged into this event */
  n: number;
  /** global pitch shift in semitones (rules SHIFT_PITCH) */
  shift: number;
}

export interface FloorView {
  lane: number;
  /** 1-based */
  index: number;
  /** px centre */
  y: number;
  x0: number;
  x1: number;
  hp: number;
  maxHp: number;
  broken: boolean;
  /** 0..1 flash on hit/break */
  glow: number;
}

export interface RingView {
  radius: number;
  thickness: number;
  /** current gap centre angle (rad) */
  angle: number;
  gap: number;
  broken: boolean;
  passes: number;
  durability: number;
}

export interface PegView {
  x: number;
  y: number;
  r: number;
  lane: number;
  glow: number;
}

export interface SimSnapshot {
  frame: number;
  timeSec: number;
  totalFrames: number;
  sceneType: "TOWER_BREAKER" | "MAZE_ESCAPE" | "ALGORITHM_ARENA";
  pool: BallPool;
  virtualTotal: number;
  laneVirtual: number[];
  floors: FloorView[];
  pegs: PegView[];
  rings: RingView[];
  escaped: number;
  escapeGoal: number;
  winnerLane: number;
  winnerFrame: number;
  hitStop: boolean;
  /** 0..1 extra shake requested by rules */
  shake: number;
  /** 0..1 full-screen flash requested (floor break / rule) */
  flash: number;
  /** arena: pre-rendered pixels */
  image: Uint32Array | null;
  imageW: number;
  imageH: number;
  arenaHud: ArenaHudStat[];
  progress: number;
  hash: number;
}

