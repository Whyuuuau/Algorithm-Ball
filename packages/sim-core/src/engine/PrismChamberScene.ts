import type { PrismChamberSceneConfig, RuleAction } from "@asmr/schema";
import { ARENA_H, ARENA_W, type Scene, type SceneContext } from "./TowerScene.js";
import type { SimSnapshot } from "./types.js";

const TAU = Math.PI * 2;
const EVENT_CAP = 32;

export const PRISM_CENTER_X = ARENA_W / 2;
export const PRISM_CENTER_Y = ARENA_H * 0.52;

export class PrismChamberScene implements Scene {
  private readonly cfg: PrismChamberSceneConfig;
  private readonly ppm: number;
  private readonly gx: number;
  private readonly gy: number;
  private readonly angle0: number;
  private angle = 0;
  private radiusNow = 0;
  private hits = 0;
  private readonly sideGlow: number[] = [];
  private readonly charge: number[] = [];
  private readonly nxs: number[] = [];
  private readonly nys: number[] = [];

  constructor(private readonly ctx: SceneContext) {
    if (ctx.config.scene.type !== "PRISM_CHAMBER") throw new Error("expected PRISM_CHAMBER");
    this.cfg = ctx.config.scene;
    this.ppm = ctx.config.physics.pixels_per_meter;
    this.gx = ctx.config.physics.gravity[0] * this.ppm;
    this.gy = ctx.config.physics.gravity[1] * this.ppm;
    // start with a flat floor: side 0's outward normal points straight down
    this.angle0 = Math.PI / 2 - Math.PI / this.cfg.sides;
    for (let k = 0; k < this.cfg.sides; k++) {
      this.sideGlow.push(0);
      this.charge.push(0);
      this.nxs.push(0);
      this.nys.push(0);
    }
    this.angle = this.angle0;
    this.radiusNow = this.cfg.radius;
  }

  public laneCount(): number {
    return 1;
  }
  public laneId(): string {
    return "chamber";
  }
  public done(): boolean {
    return false;
  }

  public init(): void {
    const { ctx, cfg } = this;
    const phys = ctx.config.physics;
    const speed = (phys.speed_lock > 0 ? phys.speed_lock : 15) * this.ppm;
    const n0 = cfg.initial_balls;
    ctx.gov.spawn(ctx.pool, 0, n0, cfg.ball_radius, (i, out) => {
      const a = (i / n0) * TAU + 0.35;
      out[0] = PRISM_CENTER_X + Math.cos(a) * 24;
      out[1] = PRISM_CENTER_Y + Math.sin(a) * 24;
      out[2] = Math.cos(a) * speed;
      out[3] = Math.sin(a) * speed;
    });
    const pool = ctx.pool;
    for (let i = 0; i < pool.count; i++) pool.hue[i] = (i / Math.max(1, n0)) * 300;
  }

  public step(frame: number, timeSec: number): void {
    const { ctx, cfg } = this;
    void frame;
    const pool = ctx.pool;
    const phys = ctx.config.physics;
    const rng = ctx.rng.physics;
    const dt = ctx.dt;
    const sub = phys.substeps;
    const sdt = dt / sub;
    const N = cfg.sides;
    const cosHalf = Math.cos(Math.PI / N);
    const lock = phys.speed_lock * this.ppm;
    const maxV = phys.max_speed * this.ppm;
    const maxV2 = maxV * maxV;
    const rest = Math.min(1, phys.restitution_default);
    const gxs = this.gx * sdt;
    const gys = this.gy * sdt;
    const spin = cfg.spin;
    const splitCap = Math.min(cfg.max_balls, pool.cap);

    for (let k = 0; k < N; k++) this.sideGlow[k] *= 0.9;
    for (let i = 0; i < pool.count; i++) pool.heat[i] *= 0.9;

    const px = pool.x;
    const py = pool.y;
    const pvx = pool.vx;
    const pvy = pool.vy;
    const pr = pool.r;
    let emitted = 0;

    for (let s = 0; s < sub; s++) {
      const tStart = timeSec + s * sdt;
      const ts = tStart + sdt;
      this.angle = this.angle0 + spin * ts;
      const breathe = Math.sin(cfg.breathe_speed * ts);
      const R = cfg.radius * (1 + cfg.breathe_amp * breathe);
      const adot = cfg.radius * cfg.breathe_amp * cfg.breathe_speed * Math.cos(cfg.breathe_speed * ts) * cosHalf;
      const a = R * cosHalf; // apothem: distance centre -> side
      this.radiusNow = R;
      for (let k = 0; k < N; k++) {
        const phi = this.angle + ((k + 0.5) * TAU) / N;
        this.nxs[k] = Math.cos(phi);
        this.nys[k] = Math.sin(phi);
      }

      const n0 = pool.count;
      for (let i = 0; i < n0; i++) {
        let vx = pvx[i] + gxs;
        let vy = pvy[i] + gys;
        const sp2 = vx * vx + vy * vy;
        if (lock > 0 && sp2 > 1e-6) {
          const kk = lock / Math.sqrt(sp2);
          vx *= kk;
          vy *= kk;
        } else if (sp2 > maxV2) {
          const kk = maxV / Math.sqrt(sp2);
          vx *= kk;
          vy *= kk;
        }
        let rx = px[i] + vx * sdt - PRISM_CENTER_X;
        let ry = py[i] + vy * sdt - PRISM_CENTER_Y;
        const r = pr[i];

        for (let k = 0; k < N; k++) {
          const nx = this.nxs[k];
          const ny = this.nys[k];
          const pen = rx * nx + ry * ny + r - a;
          if (pen <= 0) continue;
          rx -= nx * pen;
          ry -= ny * pen;
          // the wall moves: rotation (spin x p) plus breathing along its normal
          const wvx = -spin * ry + adot * nx;
          const wvy = spin * rx + adot * ny;
          const vn = (vx - wvx) * nx + (vy - wvy) * ny;
          if (vn <= 0) continue;
          vx -= (1 + rest) * vn * nx;
          vy -= (1 + rest) * vn * ny;

          pool.heat[i] = 1;
          this.sideGlow[k] = 1;
          this.hits++;
          if (cfg.inherit_color) pool.hue[i] = (k / N) * 300;
          if (emitted < EVENT_CAP) {
            emitted++;
            ctx.emit({
              t: tStart + sdt,
              kind: "wall",
              lane: k & 7,
              index: k + 1,
              x: Math.max(0, Math.min(1, (PRISM_CENTER_X + rx) / ARENA_W)),
              y: Math.max(0, Math.min(1, (PRISM_CENTER_Y + ry) / ARENA_H)),
              vel: Math.max(0.3, Math.min(1, vn / Math.max(1, maxV * 0.6))),
              n: 1
            });
          }

          // refraction: a well-struck side births a new ball that leaves at a fresh angle
          if (++this.charge[k] >= cfg.hits_per_split && pool.count < splitCap) {
            this.charge[k] = 0;
            const sx = PRISM_CENTER_X + rx - nx * r * 2.2;
            const sy = PRISM_CENTER_Y + ry - ny * r * 2.2;
            const turn = (rng() < 0.5 ? -1 : 1) * (0.45 + rng() * 0.5);
            const c = Math.cos(turn);
            const sn = Math.sin(turn);
            const cvx = vx * c - vy * sn;
            const cvy = vx * sn + vy * c;
            const hue = pool.hue[i];
            const made = ctx.gov.spawn(pool, 0, 1, cfg.ball_radius, (_j, out) => {
              out[0] = sx;
              out[1] = sy;
              out[2] = cvx;
              out[3] = cvy;
            });
            if (made > 0) pool.hue[pool.count - 1] = hue;
          }
        }

        px[i] = PRISM_CENTER_X + rx;
        py[i] = PRISM_CENTER_Y + ry;
        pvx[i] = vx;
        pvy[i] = vy;
      }
    }
  }

  public apply(action: RuleAction): void {
    void action;
  }

  public fill(snap: SimSnapshot): void {
    snap.polyAngle = this.angle;
    snap.polyRadius = this.radiusNow;
    snap.sideGlow = this.sideGlow;
    snap.escaped = this.hits;
    snap.escapeGoal = this.cfg.max_balls;
    snap.flash = 0;
    snap.shake = 0;
  }
}

