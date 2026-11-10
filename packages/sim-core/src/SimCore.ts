import type { ProjectConfig } from "@asmr/schema";
import { evaluateTensionCurve } from "@asmr/schema";
import { SeededRNGPool, hashFnv1a } from "./prng/index.js";
import { PopulationGovernor } from "./governor/PopulationGovernor.js";
import { BallPool } from "./engine/BallPool.js";
import { ArenaScene } from "./engine/ArenaScene.js";
import { MazeScene } from "./engine/MazeScene.js";
import { TowerScene, type Scene, type SceneContext } from "./engine/TowerScene.js";
import type { HitEvent, SimSnapshot } from "./engine/types.js";
import { RuleEngine, type RuleTrigger } from "./rules/RuleEngine.js";

export interface SimOptions {
  /** Arena scenes only: skip painting the pixel image (Seed Scout / headless audio pass). */
  render?: boolean;
}

/**
 * Deterministic, headless simulation. No DOM, no Web Audio, no Math.random.
 * `step()` returns the same (reused) snapshot object each call – copy what you need.
 */
export class SimCore {
  public readonly config: ProjectConfig;
  public readonly dt: number;
  public readonly totalFrames: number;
  public frame = 0;

  private rng!: SeededRNGPool;
  private pool!: BallPool;
  private gov!: PopulationGovernor;
  private rules!: RuleEngine;
  private scene!: Scene;
  private hits: HitEvent[] = [];
  private pitchShift = 0;
  private hash = 0;
  private pendingRule: { trigger: RuleTrigger; lane: number; index: number; depth: number }[] = [];
  private curDepth = 0;
  private snap!: SimSnapshot;
  private readonly renderPixels: boolean;

  constructor(config: ProjectConfig, opts: SimOptions = {}) {
    this.config = config;
    this.dt = 1 / config.meta.fps;
    this.totalFrames = Math.round(config.meta.duration_sec * config.meta.fps);
    this.renderPixels = opts.render !== false;
  }

  /** Kept async for API compatibility; the engine itself needs no WASM. */
  public async init(): Promise<void> {
    this.initSync();
  }

  public initSync(): void {
    const cfg = this.config;
    this.rng = new SeededRNGPool(cfg.seed);
    this.pool = new BallPool(cfg.physics.physical_cap);
    const lanes = cfg.scene.type === "TOWER_BREAKER" ? cfg.scene.lanes.length : 1;
    this.gov = new PopulationGovernor(cfg.physics.physical_cap, lanes);
    this.rules = new RuleEngine(cfg.rules);
    this.hits = [];
    this.pitchShift = 0;
    this.pendingRule = [];
    this.curDepth = 0;
    this.frame = 0;
    this.hash = 0;

    const ctx: SceneContext = {
      config: cfg,
      dt: this.dt,
      rng: this.rng,
      pool: this.pool,
      gov: this.gov,
      emit: (ev) => {
        this.hits.push({ ...ev, shift: this.pitchShift });
      },
      ruleEvent: (trigger, lane, index) => {
        this.pendingRule.push({ trigger, lane, index, depth: this.curDepth });
      }
    };
    switch (cfg.scene.type) {
      case "TOWER_BREAKER":
        this.scene = new TowerScene(ctx);
        break;
      case "MAZE_ESCAPE":
        this.scene = new MazeScene(ctx);
        break;
      default: {
        const a = new ArenaScene(ctx);
        a.renderEnabled = this.renderPixels;
        this.scene = a;
      }
    }
    this.scene.init();

    this.snap = {
      frame: 0,
      timeSec: 0,
      totalFrames: this.totalFrames,
      sceneType: cfg.scene.type,
      pool: this.pool,
      virtualTotal: 0,
      laneVirtual: new Array(lanes).fill(0),
      floors: [],
      pegs: [],
      rings: [],
      escaped: 0,
      escapeGoal: 0,
      winnerLane: -1,
      winnerFrame: -1,
      hitStop: false,
      shake: 0,
      flash: 0,
      image: null,
      imageW: 0,
      imageH: 0,
      arenaHud: [],
      progress: 0,
      hash: 0
    };
  }

  public laneIds(): string[] {
    const n = this.scene.laneCount();
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(this.scene.laneId(i));
    return out;
  }

  public step(): SimSnapshot {
    const cfg = this.config;
    const frame = this.frame;
    const timeSec = frame * this.dt;
    const progress = this.totalFrames > 0 ? frame / this.totalFrames : 0;
    const tension = evaluateTensionCurve(cfg.arc.tension_curve, progress);
    const ruleCtx = {
      timeSec,
      frame,
      tension,
      virtualTotal: this.gov.totalVirtual(),
      bpm: cfg.sound.quantizer.bpm
    };

    // 1. rules queued last frame
    const cmds = this.rules.drain(Math.max(1, ...cfg.rules.map((r) => r.guard.budget_per_frame)));
    for (const c of cmds) {
      this.curDepth = c.depth;
      if (c.action.type === "SHIFT_PITCH") this.pitchShift += c.action.value ?? 1;
      else if (c.action.type === "PLAY_SFX") {
        this.hits.push({ t: timeSec, kind: "sfx", lane: c.lane, index: 1, x: 0.5, y: 0.5, vel: 0.9, n: 1, shift: this.pitchShift + (c.action.value ?? 0) });
      } else this.scene.apply(c.action, c.lane);
    }
    this.curDepth = 0;

    // 2. physics / algorithm
    this.scene.step(frame, timeSec);

    // 3. events -> rules (applied next frame)
    const laneIds = this.laneIds();
    for (const e of this.pendingRule) {
      this.rules.onEvent(
        { trigger: e.trigger, lane: e.lane, laneId: laneIds[e.lane] ?? "", index: e.index, depth: e.depth },
        ruleCtx
      );
    }
    this.pendingRule.length = 0;
    this.rules.onFrame(ruleCtx);

    // 4. snapshot
    const s = this.snap;
    s.frame = frame;
    s.timeSec = timeSec;
    s.virtualTotal = this.gov.totalVirtual();
    for (let i = 0; i < s.laneVirtual.length; i++) s.laneVirtual[i] = this.gov.virtual[i] ?? 0;
    this.scene.fill(s);

    if (frame % 60 === 0) {
      this.hash = this.computeHash(frame);
    }
    s.hash = this.hash;
    this.frame++;
    return s;
  }

  private computeHash(frame: number): number {
    // FNV-1a over quantised positions
    let h = 0x811c9dc5;
    const mix = (v: number): void => {
      h ^= v & 0xff;
      h = Math.imul(h, 0x01000193);
      h ^= (v >>> 8) & 0xff;
      h = Math.imul(h, 0x01000193);
      h ^= (v >>> 16) & 0xff;
      h = Math.imul(h, 0x01000193);
      h ^= (v >>> 24) & 0xff;
      h = Math.imul(h, 0x01000193);
    };
    mix(frame);
    mix(this.pool.count);
    for (let i = 0; i < this.pool.count; i++) {
      mix((this.pool.x[i] * 64) | 0);
      mix((this.pool.y[i] * 64) | 0);
    }
    if (this.snap.image) {
      const im = this.snap.image;
      for (let i = 0; i < im.length; i += 7) mix(im[i]);
    }
    return h >>> 0;
  }

  public getHitLog(): HitEvent[] {
    return this.hits;
  }

  /** Winner lane index (tower) or -1. */
  public winner(): number {
    return this.snap.winnerLane;
  }

  /** Per-lane normalised progress (tower only) – used by Seed Scout. */
  public laneProgress(l: number): number {
    return this.scene instanceof TowerScene ? this.scene.laneProgress(l) : this.snap.progress;
  }

  /** Re-simulate silently up to `frame` (scrubbing). */
  public seek(frame: number): SimSnapshot {
    this.initSync();
    let snap = this.snap;
    for (let i = 0; i <= frame; i++) snap = this.step();
    return snap;
  }
}

export { hashFnv1a };
