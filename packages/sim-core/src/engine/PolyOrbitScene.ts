import type { PolyOrbitSceneConfig, RuleAction } from "@asmr/schema";
import { ARENA_H, ARENA_W, type Scene, type SceneContext } from "./TowerScene.js";
import type { SimSnapshot } from "./types.js";

const TAU = Math.PI * 2;

export const ORBIT_CENTER_X = ARENA_W / 2;
export const ORBIT_CENTER_Y = ARENA_H * 0.52;

export interface OrbitLayout {
  radius: number[];
  /** revolutions per loop */
  revs: number[];
  /** +1 / -1 spin direction */
  dir: number[];
}

/** Pure geometry shared by the simulation and the renderer. */
export function orbitLayout(cfg: PolyOrbitSceneConfig): OrbitLayout {
  const radius: number[] = [];
  const revs: number[] = [];
  const dir: number[] = [];
  const n = cfg.orbits;
  for (let i = 0; i < n; i++) {
    radius.push(cfg.inner_radius + (n > 1 ? i / (n - 1) : 0) * (cfg.outer_radius - cfg.inner_radius));
    revs.push(cfg.first_ratio + i * cfg.ratio_step);
    dir.push(cfg.direction_mode === "alternate" && i % 2 === 1 ? -1 : 1);
  }
  return { radius, revs, dir };
}

interface PendingEvent {
  t: number;
  i: number;
  vel: number;
}

export class PolyOrbitScene implements Scene {
  private readonly cfg: PolyOrbitSceneConfig;
  private readonly layout: OrbitLayout;
  private readonly loopSec: number;
  private readonly gateRad: number;
  private timeSec = 0;
  private readonly pending: PendingEvent[] = [];

  constructor(private readonly ctx: SceneContext) {
    if (ctx.config.scene.type !== "POLY_ORBIT") throw new Error("expected POLY_ORBIT");
    this.cfg = ctx.config.scene;
    this.layout = orbitLayout(this.cfg);
    this.loopSec = this.cfg.loop_sec > 0 ? this.cfg.loop_sec : Math.max(1, ctx.config.meta.duration_sec);
    this.gateRad = (this.cfg.gate_angle_deg * Math.PI) / 180;
  }

  public laneCount(): number {
    return 1;
  }
  public laneId(): string {
    return "orbits";
  }
  public done(): boolean {
    return false;
  }

  public init(): void {
    const { ctx, cfg } = this;
    this.timeSec = 0;
    ctx.gov.spawn(ctx.pool, 0, cfg.orbits, cfg.planet_radius, (i, out) => {
      const p = this.pose(i, 0);
      out[0] = p[0];
      out[1] = p[1];
      out[2] = p[2];
      out[3] = p[3];
    });
    const pool = ctx.pool;
    for (let i = 0; i < pool.count; i++) pool.hue[i] = (i / Math.max(1, cfg.orbits)) * 300;
    this.writePositions(0);
  }

  /** [x, y, vx, vy] of planet i at time t. */
  private pose(i: number, t: number): [number, number, number, number] {
    const { layout, loopSec } = this;
    const w = (TAU * layout.revs[i] * layout.dir[i]) / loopSec;
    const a = this.gateRad + w * t;
    const r = layout.radius[i];
    return [
      ORBIT_CENTER_X + Math.cos(a) * r,
      ORBIT_CENTER_Y + Math.sin(a) * r,
      -Math.sin(a) * r * w,
      Math.cos(a) * r * w
    ];
  }

  private writePositions(t: number): void {
    const pool = this.ctx.pool;
    const n = Math.min(pool.count, this.cfg.orbits);
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
    const n = cfg.orbits;
    this.pending.length = 0;
    for (let i = 0; i < n; i++) {
      // gate crossings per loop = revolutions * gates
      const rate = (layout.revs[i] * cfg.gates) / loopSec;
      const qNow = Math.floor(rate * timeSec);
      const qPrev = Math.floor(rate * tPrev);
      // inner (slow, low) rings are struck harder
      const bassBias = 0.6 + 0.4 * (1 - (n > 1 ? i / (n - 1) : 0));
      for (let k = Math.max(0, qPrev + 1); k <= qNow; k++) {
        this.pending.push({ t: k / rate, i, vel: bassBias });
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
        y: Math.max(0, Math.min(1, p[1] / ARENA_H)),
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

