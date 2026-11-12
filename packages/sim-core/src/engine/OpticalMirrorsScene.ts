import type { OpticalMirrorsSceneConfig, RuleAction } from "@asmr/schema";
import { ARENA_H, ARENA_W, type Scene, type SceneContext } from "./TowerScene.js";
import type { SimSnapshot } from "./types.js";

const TAU = Math.PI * 2;

export class OpticalMirrorsScene implements Scene {
  private readonly ctx: SceneContext;
  private readonly cfg: OpticalMirrorsSceneConfig;
  private ppm = 20;
  private gx = 0;
  private gy = 0;
  private flashAmt = 0;
  private shakeAmt = 0;
  private frame = 0;
  private arcR = 1000;
  private arcOffsetX = 620;

  constructor(ctx: SceneContext) {
    this.ctx = ctx;
    if (ctx.config.scene.type !== "OPTICAL_MIRRORS") throw new Error("expected OPTICAL_MIRRORS");
    this.cfg = ctx.config.scene;
  }

  public laneCount(): number {
    return 1;
  }

  public laneId(): string {
    return "mirrors";
  }

  public done(): boolean {
    return false;
  }

  public init(): void {
    const phys = this.ctx.config.physics;
    this.ppm = phys.pixels_per_meter;
    // Optical mirrors typically run in pure zero-g specular reflection unless user adds gravity
    this.gx = 0;
    this.gy = 0;

    const w = this.cfg.width_px * 0.5;
    const h = this.cfg.height_px * 0.5;
    // Vesica Piscis arc geometry: radius R whose sagitta is w over half-chord h
    this.arcR = (w * w + h * h) / Math.max(1, 2 * w);
    this.arcOffsetX = this.arcR - w;

    const cx = ARENA_W / 2;
    const cy = ARENA_H / 2 + this.cfg.origin_offset_y;
    const spd = this.cfg.ball_speed * this.ppm;
    const n = this.cfg.ball_count;
    const spreadRad = (this.cfg.spread_deg * Math.PI) / 180;
    const startA = -Math.PI * 0.5 - spreadRad * 0.5;

    this.ctx.gov.spawn(this.ctx.pool, 0, n, this.cfg.ball_radius, (i, out) => {
      const frac = n === 1 ? 0.5 : i / (spreadRad >= TAU - 0.01 ? n : Math.max(1, n - 1));
      const a = startA + frac * spreadRad;
      // Launch from exact focal origin with subtle radial offset to avoid zero-distance edge
      out[0] = cx + Math.cos(a) * 14;
      out[1] = cy + Math.sin(a) * 14;
      out[2] = Math.cos(a) * spd;
      out[3] = Math.sin(a) * spd;
    });

    const pool = this.ctx.pool;
    for (let i = 0; i < pool.count; i++) {
      pool.hue[i] = (i / Math.max(1, n)) * 360;
    }
  }

  public step(frame: number, timeSec: number): void {
    this.frame = frame;
    const { ctx, cfg } = this;
    const pool = ctx.pool;
    const phys = ctx.config.physics;
    const dt = ctx.dt;
    const sub = Math.max(4, phys.substeps);
    const sdt = dt / sub;

    this.flashAmt *= 0.8;
    this.shakeAmt *= 0.85;
    const calmOutroSec = ctx.config.arc.calm_outro_sec ?? 3.0;
    const remainingSec = Math.max(0, ctx.config.meta.duration_sec - timeSec);
    const inCalmOutro = calmOutroSec > 0 && remainingSec <= calmOutroSec;
    if (inCalmOutro) {
      this.flashAmt = 0;
      this.shakeAmt = 0;
    }

    const cx = ARENA_W / 2;
    const cy = ARENA_H / 2;
    const w = cfg.width_px * 0.5;
    const h = cfg.height_px * 0.5;
    const spdTarget = cfg.ball_speed * this.ppm;

    const px = pool.x;
    const py = pool.y;
    const pvx = pool.vx;
    const pvy = pool.vy;
    const pr = pool.r;
    const ph = pool.heat;

    for (let i = 0; i < pool.count; i++) ph[i] *= 0.9;

    const maxEvents = Math.max(12, ctx.config.sound.max_events_per_frame);
    let emitted = 0;

    for (let s = 0; s < sub; s++) {
      const subT = timeSec + (s / sub) * dt;
      const spinAng = cfg.mirror_spin * subT;
      const cosM = spinAng !== 0 ? Math.cos(-spinAng) : 1;
      const sinM = spinAng !== 0 ? Math.sin(-spinAng) : 0;
      const cosMinv = spinAng !== 0 ? Math.cos(spinAng) : 1;
      const sinMinv = spinAng !== 0 ? Math.sin(spinAng) : 0;

      for (let i = 0; i < pool.count; i++) {
        let x = px[i];
        let y = py[i];
        let vx = pvx[i] + this.gx * sdt;
        let vy = pvy[i] + this.gy * sdt;
        const r = pr[i];

        // Maintain exact constant optical speed for clean geometric convergence
        const sp = Math.hypot(vx, vy) || 1;
        vx = (vx / sp) * spdTarget;
        vy = (vy / sp) * spdTarget;

        x += vx * sdt;
        y += vy * sdt;

        // Transform into local mirror coordinates when mirror_spin != 0
        const rx = x - cx;
        const ry = y - cy;
        let lx = cx + rx * cosM - ry * sinM;
        let ly = cy + rx * sinM + ry * cosM;
        let lvx = vx * cosM - vy * sinM;
        let lvy = vx * sinM + vy * cosM;

        let hit = false;
        let nx = 0;
        let ny = 0;

        if (cfg.mirror_shape === "circle") {
          const rad = w;
          const dx = lx - cx;
          const dy = ly - cy;
          const d = Math.hypot(dx, dy);
          if (d + r > rad && d > 1e-4) {
            nx = dx / d;
            ny = dy / d;
            lx = cx + nx * (rad - r);
            ly = cy + ny * (rad - r);
            hit = true;
          }
        } else if (cfg.mirror_shape === "ellipse") {
          const ew = Math.max(20, w - r);
          const eh = Math.max(20, h - r);
          const ux = (lx - cx) / ew;
          const uy = (ly - cy) / eh;
          const q = ux * ux + uy * uy;
          if (q > 1) {
            const invQ = 1 / Math.sqrt(q);
            lx = cx + (lx - cx) * invQ;
            ly = cy + (ly - cy) * invQ;
            const gx = (lx - cx) / (ew * ew);
            const gy = (ly - cy) / (eh * eh);
            const gl = Math.hypot(gx, gy) || 1;
            nx = gx / gl;
            ny = gy / gl;
            hit = true;
          }
        } else {
          // Vesica Piscis: two intersecting circular arcs
          const rcx = cx - this.arcOffsetX;
          const dxR = lx - rcx;
          const dyR = ly - cy;
          const distR = Math.hypot(dxR, dyR);
          if (distR + r > this.arcR && distR > 1e-4) {
            nx = dxR / distR;
            ny = dyR / distR;
            lx = rcx + nx * (this.arcR - r);
            ly = cy + ny * (this.arcR - r);
            hit = true;
          }

          const lcx = cx + this.arcOffsetX;
          const dxL = lx - lcx;
          const dyL = ly - cy;
          const distL = Math.hypot(dxL, dyL);
          if (distL + r > this.arcR && distL > 1e-4) {
            nx = dxL / distL;
            ny = dyL / distL;
            lx = lcx + nx * (this.arcR - r);
            ly = cy + ny * (this.arcR - r);
            hit = true;
          }
        }

        if (hit) {
          const vn = lvx * nx + lvy * ny;
          if (vn > 0) {
            lvx -= 2 * vn * nx;
            lvy -= 2 * vn * ny;
            ph[i] = 1;
            const wx = cx + (lx - cx) * cosMinv - (ly - cy) * sinMinv;
            const wy = cy + (lx - cx) * sinMinv + (ly - cy) * cosMinv;
            x = wx;
            y = wy;
            vx = lvx * cosMinv - lvy * sinMinv;
            vy = lvx * sinMinv + lvy * cosMinv;
            if (emitted < maxEvents) {
              emitted++;
              ctx.emit({
                t: subT,
                kind: "ring",
                lane: 0,
                index: 1 + (i % 16),
                x: x / ARENA_W,
                y: y / ARENA_H,
                vel: Math.max(0.35, Math.min(1, vn / Math.max(1, spdTarget))),
                n: 1
              });
            }
          } else {
            x = cx + (lx - cx) * cosMinv - (ly - cy) * sinMinv;
            y = cy + (lx - cx) * sinMinv + (ly - cy) * cosMinv;
            vx = lvx * cosMinv - lvy * sinMinv;
            vy = lvx * sinMinv + lvy * cosMinv;
          }
        }

        px[i] = x;
        py[i] = y;
        pvx[i] = vx;
        pvy[i] = vy;
      }
    }
  }

  public apply(action: RuleAction): void {
    const calmOutroSec = this.ctx.config.arc.calm_outro_sec ?? 3.0;
    const remainingSec = Math.max(0, this.ctx.config.meta.duration_sec - this.frame * this.ctx.dt);
    const inCalmOutro = calmOutroSec > 0 && remainingSec <= calmOutroSec;
    if (action.type === "SHAKE" && !inCalmOutro) this.shakeAmt = Math.max(this.shakeAmt, action.value ?? 1);
    if (action.type === "FLASH" && !inCalmOutro) this.flashAmt = Math.max(this.flashAmt, action.value ?? 1);
  }

  public fill(snap: SimSnapshot): void {
    snap.flash = this.flashAmt;
    snap.shake = this.shakeAmt;
    snap.escaped = this.ctx.pool.count;
    snap.escapeGoal = this.cfg.ball_count;
  }
}
