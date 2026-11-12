import type { PendulumWaveSceneConfig, RuleAction } from "@asmr/schema";
import { ARENA_W, type Scene, type SceneContext } from "./TowerScene.js";
import type { SimSnapshot } from "./types.js";

const TAU = Math.PI * 2;

export interface PendulumLayout {
  /** oscillations per loop for each pendulum */
  cycles: number[];
  /** pivot x position (arena px) */
  pivotX: number[];
  /** string length (arena px); physically scaled so that period ~ sqrt(length) */
  len: number[];
  /** per-pendulum lateral swing (px), limited so short strings stay geometrically valid */
  amp: number[];
}

/** Pure geometry shared by the simulation and the renderer. */
export function pendulumLayout(cfg: PendulumWaveSceneConfig): PendulumLayout {
  const n = cfg.count;
  const cycles: number[] = [];
  const pivotX: number[] = [];
  const len: number[] = [];
  const amp: number[] = [];
  const c0 = cfg.base_cycles;
  for (let i = 0; i < n; i++) {
    const c = c0 + i * cfg.cycle_step;
    cycles.push(c);
    pivotX.push(ARENA_W / 2 + (n > 1 ? i / (n - 1) - 0.5 : 0) * cfg.spread_px);
    const L = cfg.string_length_px * (c0 / c) * (c0 / c);
    len.push(L);
    amp.push(Math.min(cfg.amplitude_px, L * 0.7));
  }
  return { cycles, pivotX, len, amp };
}

interface PendingEvent {
  t: number;
  i: number;
  vel: number;
}

export class PendulumWaveScene implements Scene {
  private readonly cfg: PendulumWaveSceneConfig;
  private readonly layout: PendulumLayout;
  private readonly loopSec: number;
  private timeSec = 0;
  private readonly pending: PendingEvent[] = [];

  constructor(private readonly ctx: SceneContext) {
    if (ctx.config.scene.type !== "PENDULUM_WAVE") throw new Error("expected PENDULUM_WAVE");
    this.cfg = ctx.config.scene;
    this.layout = pendulumLayout(this.cfg);
    this.loopSec = this.cfg.loop_sec > 0 ? this.cfg.loop_sec : Math.max(1, ctx.config.meta.duration_sec);
  }

  public laneCount(): number {
    return 1;
  }
  public laneId(): string {
    return "pendulums";
  }
  public done(): boolean {
    return false;
  }

  public init(): void {
    const { ctx, cfg } = this;
    this.timeSec = 0;
    ctx.gov.spawn(ctx.pool, 0, cfg.count, cfg.bob_radius, (i, out) => {
      const p = this.pose(i, 0);
      out[0] = p[0];
      out[1] = p[1];
      out[2] = 0;
      out[3] = 0;
    });
    const pool = ctx.pool;
    for (let i = 0; i < pool.count; i++) pool.hue[i] = (i / Math.max(1, cfg.count)) * 300;
    this.writePositions(0);
  }

  /** [x, y, vx, vy] of pendulum i at time t (seconds). */
  private pose(i: number, t: number): [number, number, number, number] {
    const { layout, cfg, loopSec } = this;
    const w = (TAU * layout.cycles[i]) / loopSec;
    const A = layout.amp[i];
    const L = layout.len[i];
    const d = A * Math.cos(w * t);
    const dv = -A * w * Math.sin(w * t);
    const drop = Math.sqrt(Math.max(1, L * L - d * d));
    const dropV = (-d * dv) / drop;
    return [layout.pivotX[i] + d, cfg.pivot_y + drop, dv, dropV];
  }

  private writePositions(t: number): void {
    const pool = this.ctx.pool;
    const n = Math.min(pool.count, this.cfg.count);
    for (let i = 0; i < n; i++) {
      const p = this.pose(i, t);
      pool.x[i] = p[0];
      pool.y[i] = p[1];
      pool.vx[i] = p[2];
      pool.vy[i] = p[3];
    }
  }

  public step(frame: number, timeSec: number): void {
    const { ctx, cfg, layout, loopSec } = this;
    const pool = ctx.pool;
    const dt = ctx.dt;
    this.timeSec = timeSec;
    void frame;

    for (let i = 0; i < pool.count; i++) pool.heat[i] *= 0.9;

    const tPrev = timeSec - dt;
    const n = cfg.count;
    this.pending.length = 0;
    const wantCenter = cfg.trigger === "center" || cfg.trigger === "both";
    const wantEdge = cfg.trigger === "extremes" || cfg.trigger === "both";

    for (let i = 0; i < n; i++) {
      const c = layout.cycles[i];
      const uNow = (c * timeSec) / loopSec;
      const uPrev = (c * tPrev) / loopSec;
      // lower strings (index 0) ring loudest, like the bass strings of a harp
      const bassBias = 0.62 + 0.38 * (1 - (n > 1 ? i / (n - 1) : 0));

      if (wantCenter) {
        // bob passes the vertical rest line when 2u - 0.5 is an integer
        const cNow = Math.floor(2 * uNow - 0.5);
        const cPrev = Math.floor(2 * uPrev - 0.5);
        for (let k = Math.max(0, cPrev + 1); k <= cNow; k++) {
          this.pending.push({ t: ((k + 0.5) * loopSec) / (2 * c), i, vel: bassBias });
        }
      }
      if (wantEdge) {
        // bob turns around when 2u is an integer
        const eNow = Math.floor(2 * uNow);
        const ePrev = Math.floor(2 * uPrev);
        for (let k = Math.max(0, ePrev + 1); k <= eNow; k++) {
          this.pending.push({ t: (k * loopSec) / (2 * c), i, vel: bassBias * (wantCenter ? 0.55 : 0.9) });
        }
      }
    }

    this.writePositions(timeSec);

    if (this.pending.length > 1) this.pending.sort((a, b) => a.t - b.t || a.i - b.i);
    for (const ev of this.pending) {
      const p = this.pose(ev.i, ev.t);
      pool.heat[ev.i] = 1;
      ctx.emit({
        t: Math.max(0, ev.t),
        kind: "ring",
        lane: ev.i & 7,
        index: ev.i + 1,
        x: Math.max(0, Math.min(1, p[0] / ARENA_W)),
        y: Math.max(0, Math.min(1, p[1] / 1920)),
        vel: ev.vel,
        n: 1
      });
    }
  }

  public apply(action: RuleAction): void {
    void action;
  }

  public fill(snap: SimSnapshot): void {
    snap.progress = (this.timeSec % this.loopSec) / this.loopSec;
    snap.flash = 0;
    snap.shake = 0;
  }
}

