import type { CubeArenaSceneConfig, RuleAction } from "@asmr/schema";
import { ARENA_H, ARENA_W, type Scene, type SceneContext } from "./TowerScene.js";
import type { SimSnapshot } from "./types.js";

const TAU = Math.PI * 2;

export class CubeArenaScene implements Scene {
  private readonly ctx: SceneContext;
  private readonly cfg: CubeArenaSceneConfig;
  private ppm = 20;
  private gx = 0;
  private gy = 0;
  private crossAngle = 0.785398; // 45 deg start (looks like X-cross)
  private cageAngle = 0.785398;
  private flashAmt = 0;
  private shakeAmt = 0;
  private frame = 0;
  private splitCooldown = new Float64Array(3000);

  constructor(ctx: SceneContext) {
    this.ctx = ctx;
    if (ctx.config.scene.type !== "CUBE_ARENA") throw new Error("expected CUBE_ARENA");
    this.cfg = ctx.config.scene;
  }

  public laneCount(): number {
    return 1;
  }

  public laneId(): string {
    return "arena";
  }

  public done(): boolean {
    return false;
  }

  public init(): void {
    const phys = this.ctx.config.physics;
    this.ppm = phys.pixels_per_meter;
    this.gx = phys.gravity[0] * this.ppm;
    this.gy = phys.gravity[1] * this.ppm;
    this.crossAngle = Math.PI * 0.25;
    this.cageAngle = Math.PI * 0.25;
    this.splitCooldown.fill(0);

    const cx = ARENA_W / 2;
    const cy = ARENA_H / 2;
    const rng = this.ctx.rng.physics;
    const startR = this.cfg.cage_enabled ? this.cfg.cage_size * 0.35 : this.cfg.outer_radius * 0.55;
    const spd = Math.max(8, phys.speed_lock > 0 ? phys.speed_lock : 18) * this.ppm;

    this.ctx.gov.spawn(this.ctx.pool, 0, this.cfg.initial_cubes, this.cfg.cube_size * 0.65, (i, out) => {
      const a = (i / Math.max(1, this.cfg.initial_cubes)) * TAU + rng() * 0.2;
      const dist = (0.2 + 0.7 * rng()) * startR;
      out[0] = cx + Math.cos(a) * dist;
      out[1] = cy + Math.sin(a) * dist;
      const va = a + Math.PI * 0.35 + (rng() * 2 - 1) * 0.8;
      out[2] = Math.cos(va) * spd * (0.7 + 0.5 * rng());
      out[3] = Math.sin(va) * spd * (0.7 + 0.5 * rng());
    });

    const pool = this.ctx.pool;
    for (let i = 0; i < pool.count; i++) {
      pool.rot[i] = rng() * TAU;
      pool.hue[i] = (i / Math.max(1, this.cfg.initial_cubes)) * 360;
      pool.lvl[i] = this.cfg.cage_enabled ? 0 : 1;
    }
  }

  public step(frame: number, timeSec: number): void {
    this.frame = frame;
    const { ctx, cfg } = this;
    const pool = ctx.pool;
    const phys = ctx.config.physics;
    const rng = ctx.rng.physics;
    const dt = ctx.dt;
    const sub = phys.substeps;
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
    const outerR = cfg.outer_radius;
    const maxV = phys.max_speed * this.ppm;
    const lock = phys.speed_lock * this.ppm;
    const rest = phys.restitution_default;
    const bladeCount = cfg.cross_blades;
    const halfCage = cfg.cage_size * 0.5;
    const bladeThick = 10;

    const px = pool.x;
    const py = pool.y;
    const pvx = pool.vx;
    const pvy = pool.vy;
    const pr = pool.r;
    const ph = pool.heat;
    const prot = pool.rot;
    const plvl = pool.lvl;

    for (let i = 0; i < pool.count; i++) ph[i] *= 0.9;

    const maxEvents = Math.max(8, ctx.config.sound.max_events_per_frame);
    let emitted = 0;

    for (let s = 0; s < sub; s++) {
      this.crossAngle += cfg.cross_speed * sdt;
      this.cageAngle += cfg.cage_speed * sdt;

      const cCross = Math.cos(-this.crossAngle);
      const sCross = Math.sin(-this.crossAngle);
      const cCrossInv = Math.cos(this.crossAngle);
      const sCrossInv = Math.sin(this.crossAngle);

      const cCage = Math.cos(-this.cageAngle);
      const sCage = Math.sin(-this.cageAngle);
      const cCageInv = Math.cos(this.cageAngle);
      const sCageInv = Math.sin(this.cageAngle);

      const n = pool.count;
      for (let i = 0; i < n; i++) {
        let x = px[i];
        let y = py[i];
        let vx = pvx[i] + this.gx * sdt;
        let vy = pvy[i] + this.gy * sdt;
        const r = pr[i];

        if (lock > 0) {
          const sp = Math.hypot(vx, vy) || 1;
          vx = (vx / sp) * lock;
          vy = (vy / sp) * lock;
        } else {
          const sp = Math.hypot(vx, vy);
          if (sp > maxV) {
            vx = (vx / sp) * maxV;
            vy = (vy / sp) * maxV;
          }
        }

        x += vx * sdt;
        y += vy * sdt;
        prot[i] += (vx * 0.008 + vy * 0.006) * sdt * 60;

        const rx = x - cx;
        const ry = y - cy;

        // 1. Inner Square Cage collision (for lvl 0 cubes inside cage or outer bounce)
        if (cfg.cage_enabled) {
          const lx = rx * cCage - ry * sCage;
          const ly = rx * sCage + ry * cCage;
          let lvx = vx * cCage - vy * sCage;
          let lvy = vx * sCage + vy * cCage;

          if (plvl[i] === 0) {
            // Check corner gap opening on one edge (allow escape if hits corner window)
            const cornerGap = halfCage * 0.38;
            const inCorner = Math.abs(lx) > halfCage - cornerGap && Math.abs(ly) > halfCage - cornerGap;
            if (!inCorner) {
              let hitCage = false;
              if (lx + r > halfCage && lvx > 0) {
                const clampedX = halfCage - r;
                lvx = -lvx * rest;
                x = cx + clampedX * cCageInv - ly * sCageInv;
                y = cy + clampedX * sCageInv + ly * cCageInv;
                hitCage = true;
              } else if (lx - r < -halfCage && lvx < 0) {
                const clampedX = -halfCage + r;
                lvx = -lvx * rest;
                x = cx + clampedX * cCageInv - ly * sCageInv;
                y = cy + clampedX * sCageInv + ly * cCageInv;
                hitCage = true;
              }
              if (ly + r > halfCage && lvy > 0) {
                const clampedY = halfCage - r;
                lvy = -lvy * rest;
                x = cx + lx * cCageInv - clampedY * sCageInv;
                y = cy + lx * sCageInv + clampedY * cCageInv;
                hitCage = true;
              } else if (ly - r < -halfCage && lvy < 0) {
                const clampedY = -halfCage + r;
                lvy = -lvy * rest;
                x = cx + lx * cCageInv - clampedY * sCageInv;
                y = cy + lx * sCageInv + clampedY * cCageInv;
                hitCage = true;
              }
              if (hitCage) {
                vx = lvx * cCageInv - lvy * sCageInv;
                vy = lvx * sCageInv + lvy * cCageInv;
                ph[i] = 1;
                if (emitted < maxEvents) {
                  emitted++;
                  ctx.emit({ t: timeSec + (s / sub) * dt, kind: "peg", lane: 0, index: 1 + (i % 8), x: x / ARENA_W, y: y / ARENA_H, vel: 0.7, n: 1 });
                }
              }
            } else if (Math.abs(lx) > halfCage * 0.9 || Math.abs(ly) > halfCage * 0.9) {
              // Escaped through corner opening!
              plvl[i] = 1;
              ctx.ruleEvent("ON_EXIT_ENTER", 0, 1);
              if (cfg.split_on_escape > 0 && pool.count < cfg.max_cubes && timeSec > this.splitCooldown[i]) {
                this.splitCooldown[i] = timeSec + 0.25;
                this.spawnSplit(x, y, vx, vy, cfg.split_on_escape, timeSec, 1);
              }
            }
          } else {
            // Solid exterior collision against the rotating central cage walls
            const pad = halfCage + r;
            if (Math.abs(lx) < pad && Math.abs(ly) < pad) {
              const penX = pad - Math.abs(lx);
              const penY = pad - Math.abs(ly);
              let hitExt = false;
              let clx = lx;
              let cly = ly;
              if (penX < penY) {
                const sgn = lx >= 0 ? 1 : -1;
                clx = sgn * pad;
                if (lvx * sgn < 0) {
                  lvx = -lvx * rest;
                  hitExt = true;
                }
              } else {
                const sgn = ly >= 0 ? 1 : -1;
                cly = sgn * pad;
                if (lvy * sgn < 0) {
                  lvy = -lvy * rest;
                  hitExt = true;
                }
              }
              x = cx + clx * cCageInv - cly * sCageInv;
              y = cy + clx * sCageInv + cly * cCageInv;
              if (hitExt) {
                vx = lvx * cCageInv - lvy * sCageInv;
                vy = lvx * sCageInv + lvy * cCageInv;
                ph[i] = 1;
                if (emitted < maxEvents) {
                  emitted++;
                  ctx.emit({ t: timeSec + (s / sub) * dt, kind: "peg", lane: 0, index: 2 + (i % 8), x: x / ARENA_W, y: y / ARENA_H, vel: 0.65, n: 1 });
                }
              }
            }
          }
        }

        // 2. Outer Cross Blades collision
        if (bladeCount > 0) {
          const minBladeR = cfg.cage_enabled ? halfCage * 1.15 : 8;
          for (let b = 0; b < bladeCount; b++) {
            const ba = this.crossAngle + (b / bladeCount) * TAU;
            const bx = Math.cos(ba);
            const by = Math.sin(ba);
            const nx = -by;
            const ny = bx;
            const proj = rx * bx + ry * by;
            if (proj >= minBladeR && proj <= outerR) {
              const perp = rx * nx + ry * ny;
              const minD = r + bladeThick * 0.5;
              if (Math.abs(perp) < minD) {
                const sign = perp >= 0 ? 1 : -1;
                const push = minD - Math.abs(perp);
                x += nx * sign * push;
                y += ny * sign * push;
                // Blade surface tangential velocity at radius proj: v_t = omega * proj along n
                const bladeVt = cfg.cross_speed * proj;
                const relVn = (vx - nx * bladeVt) * nx + (vy - ny * bladeVt) * ny;
                if (relVn * sign < 0) {
                  vx -= (1 + rest) * relVn * nx;
                  vy -= (1 + rest) * relVn * ny;
                  ph[i] = 1;
                  if (emitted < maxEvents) {
                    emitted++;
                    ctx.emit({ t: timeSec + (s / sub) * dt, kind: "ring", lane: 0, index: b + 1, x: x / ARENA_W, y: y / ARENA_H, vel: Math.min(1, Math.abs(relVn) / maxV), n: 1 });
                  }
                  if (cfg.split_on_blade > 0 && pool.count < cfg.max_cubes && timeSec > this.splitCooldown[i]) {
                    this.splitCooldown[i] = timeSec + 0.3;
                    this.spawnSplit(x, y, vx, vy, cfg.split_on_blade, timeSec, 1);
                  }
                }
              }
            }
          }
        }

        // 3. Outer Chamber Boundary (Circle, Hexagon, or Diamond)
        if (cfg.chamber_shape === "hexagon" || cfg.chamber_shape === "diamond") {
          const sides = cfg.chamber_shape === "hexagon" ? 6 : 4;
          const rotOffset = cfg.chamber_shape === "hexagon" ? Math.PI / 6 : 0;
          const apothem = outerR * Math.cos(Math.PI / sides) - r;
          for (let k = 0; k < sides; k++) {
            const na = rotOffset + ((k + 0.5) * TAU) / sides;
            const nx = Math.cos(na);
            const ny = Math.sin(na);
            const proj = (x - cx) * nx + (y - cy) * ny;
            if (proj > apothem) {
              const pen = proj - apothem;
              x -= nx * pen;
              y -= ny * pen;
              const vn = vx * nx + vy * ny;
              if (vn > 0) {
                vx -= (1 + rest) * vn * nx;
                vy -= (1 + rest) * vn * ny;
                ph[i] = 1;
                if (emitted < maxEvents) {
                  emitted++;
                  ctx.emit({ t: timeSec + (s / sub) * dt, kind: "wall", lane: 0, index: 1 + k, x: x / ARENA_W, y: y / ARENA_H, vel: Math.min(1, vn / maxV), n: 1 });
                }
              }
            }
          }
        } else {
          const dist = Math.hypot(x - cx, y - cy);
          if (dist + r > outerR && dist > 1e-4) {
            const nx = (x - cx) / dist;
            const ny = (y - cy) / dist;
            x = cx + nx * (outerR - r);
            y = cy + ny * (outerR - r);
            const vn = vx * nx + vy * ny;
            if (vn > 0) {
              vx -= (1 + rest) * vn * nx;
              vy -= (1 + rest) * vn * ny;
              ph[i] = 1;
              if (emitted < maxEvents) {
                emitted++;
                ctx.emit({ t: timeSec + (s / sub) * dt, kind: "wall", lane: 0, index: 1 + (i % 12), x: x / ARENA_W, y: y / ARENA_H, vel: Math.min(1, vn / maxV), n: 1 });
              }
            }
          }
        }

        px[i] = x;
        py[i] = y;
        pvx[i] = vx;
        pvy[i] = vy;
      }
      void cCross;
      void sCross;
      void cCrossInv;
      void sCrossInv;
    }
    void rng;
  }

  private spawnSplit(x: number, y: number, vx: number, vy: number, count: number, timeSec: number, lvl: number): void {
    const { ctx, cfg } = this;
    const rng = ctx.rng.physics;
    const sp = Math.hypot(vx, vy) || 300;
    const allowed = Math.min(count, cfg.max_cubes - ctx.pool.count);
    if (allowed <= 0) return;

    ctx.gov.spawn(ctx.pool, 0, allowed, cfg.cube_size * 0.65, (k, out) => {
      const spread = (rng() * 2 - 1) * 0.7;
      const baseA = Math.atan2(vy, vx) + spread;
      out[0] = x + Math.cos(baseA) * 6;
      out[1] = y + Math.sin(baseA) * 6;
      out[2] = Math.cos(baseA) * sp * (0.9 + 0.25 * rng());
      out[3] = Math.sin(baseA) * sp * (0.9 + 0.25 * rng());
      void k;
    });

    const pool = ctx.pool;
    for (let i = Math.max(0, pool.count - allowed); i < pool.count; i++) {
      pool.lvl[i] = lvl;
      pool.rot[i] = rng() * TAU;
      pool.hue[i] = (pool.hue[i] + rng() * 40) % 360;
      this.splitCooldown[i] = timeSec + 0.35;
    }
  }

  public apply(action: RuleAction): void {
    const calmOutroSec = this.ctx.config.arc.calm_outro_sec ?? 3.0;
    const remainingSec = Math.max(0, this.ctx.config.meta.duration_sec - this.frame * this.ctx.dt);
    const inCalmOutro = calmOutroSec > 0 && remainingSec <= calmOutroSec;
    if (action.type === "SHAKE" && !inCalmOutro) this.shakeAmt = Math.max(this.shakeAmt, action.value ?? 1);
    if (action.type === "FLASH" && !inCalmOutro) this.flashAmt = Math.max(this.flashAmt, action.value ?? 1);
    if (action.type === "SPAWN") {
      const cx = ARENA_W / 2;
      const cy = ARENA_H / 2;
      this.spawnSplit(cx, cy, 200, 150, action.count ?? 5, this.frame * this.ctx.dt, 0);
    }
  }

  public fill(snap: SimSnapshot): void {
    snap.crossAngle = this.crossAngle;
    snap.cageAngle = this.cageAngle;
    snap.flash = this.flashAmt;
    snap.shake = this.shakeAmt;
    snap.escaped = this.ctx.pool.count;
    snap.escapeGoal = this.cfg.max_cubes;
  }
}
