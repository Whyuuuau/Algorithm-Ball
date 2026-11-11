import type { AlgorithmArenaConfig, RuleAction } from "@asmr/schema";
import { arenaDefaults, createArena } from "../arena/index.js";
import type { ArenaAlgorithm, ArenaEvent } from "../arena/types.js";
import type { Scene, SceneContext } from "./TowerScene.js";
import type { SimSnapshot } from "./types.js";

export class ArenaScene implements Scene {
  private readonly cfg: AlgorithmArenaConfig;
  private algo!: ArenaAlgorithm;
  private image!: Uint32Array;
  private frame = 0;
  private timeSec = 0;
  private flashAmt = 0;
  private shakeAmt = 0;
  private evBuf: ArenaEvent[] = [];
  public renderEnabled = true;
  private static readonly KINDS: Record<string, number> = {};

  constructor(private readonly ctx: SceneContext) {
    this.cfg = ctx.config.scene as AlgorithmArenaConfig;
  }

  public laneCount(): number {
    return 1;
  }
  public laneId(): string {
    return "arena";
  }
  public done(): boolean {
    return this.algo ? this.algo.done() : false;
  }

  public init(): void {
    const w = this.cfg.grid_width;
    const h = Math.round((w * 16) / 9);
    const params = { ...arenaDefaults(this.cfg.algorithm), ...this.cfg.params };
    this.algo = createArena(this.cfg.algorithm, w, h, this.ctx.rng.physics, params);
    this.image = new Uint32Array(w * h);
  }

  private static kindIndex(k: string): number {
    let v = ArenaScene.KINDS[k];
    if (v === undefined) {
      v = Object.keys(ArenaScene.KINDS).length;
      ArenaScene.KINDS[k] = v;
    }
    return v;
  }

  public step(frame: number, timeSec: number): void {
    this.frame = frame;
    this.timeSec = timeSec;
    this.flashAmt *= 0.8;
    this.shakeAmt *= 0.85;
    const calmOutroSec = this.ctx.config.arc.calm_outro_sec ?? 3.0;
    const remainingSec = Math.max(0, this.ctx.config.meta.duration_sec - timeSec);
    if (calmOutroSec > 0 && remainingSec <= calmOutroSec) {
      this.shakeAmt = 0;
      this.flashAmt = 0;
    }
    const buf = this.evBuf;
    buf.length = 0;
    this.algo.step(frame, this.ctx.dt, this.cfg.ops_per_frame, (e) => {
      buf.push(e);
    });
    // keep the K strongest events of the frame
    const K = this.ctx.config.sound.max_events_per_frame;
    if (buf.length > K) buf.sort((a, b) => b.magnitude - a.magnitude);
    const n = Math.min(K, buf.length);
    const merged = n > 0 ? Math.max(1, Math.round(buf.length / n)) : 1;
    for (let i = 0; i < n; i++) {
      const e = buf[i];
      this.ctx.emit({
        t: timeSec,
        kind: "arena",
        lane: 0,
        index: ArenaScene.kindIndex(e.kind),
        x: Math.max(0, Math.min(1, e.x)),
        y: Math.max(0, Math.min(1, e.y)),
        vel: Math.max(0.1, Math.min(1, e.magnitude)),
        n: merged
      });
    }
  }

  public apply(action: RuleAction): void {
    const calmOutroSec = this.ctx.config.arc.calm_outro_sec ?? 3.0;
    const remainingSec = Math.max(0, this.ctx.config.meta.duration_sec - this.timeSec);
    const inCalmOutro = calmOutroSec > 0 && remainingSec <= calmOutroSec;
    if (action.type === "SHAKE" && !inCalmOutro) this.shakeAmt = Math.max(this.shakeAmt, action.value ?? 1);
    if (action.type === "FLASH" && !inCalmOutro) this.flashAmt = Math.max(this.flashAmt, action.value ?? 1);
  }

  public fill(snap: SimSnapshot): void {
    if (this.renderEnabled) {
      this.algo.render(this.image);
      snap.image = this.image;
    } else {
      snap.image = null;
    }
    snap.imageW = this.algo.width;
    snap.imageH = this.algo.height;
    snap.arenaHud = this.algo.hud();
    snap.progress = this.algo.progress();
    snap.flash = this.flashAmt;
    snap.shake = this.shakeAmt;
  }
}

