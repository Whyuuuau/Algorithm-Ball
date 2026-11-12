import type { OverflowBowlSceneConfig, RuleAction } from "@asmr/schema";
import { ARENA_H, ARENA_W, type Scene, type SceneContext } from "./TowerScene.js";
import type { SimSnapshot } from "./types.js";

const TAU = Math.PI * 2;
const CELL = 24;
const GRID_W = Math.ceil(ARENA_W / CELL);
const GRID_H = Math.ceil(ARENA_H / CELL);

export class OverflowBowlScene implements Scene {
  private readonly ctx: SceneContext;
  private readonly cfg: OverflowBowlSceneConfig;
  private ppm = 20;
  private gx = 0;
  private gy = 0;
  private wedgeAngle = 0;
  private overflowCount = 0;
  private flashAmt = 0;
  private shakeAmt = 0;
  private frame = 0;
  private splitCooldown!: Float64Array;
  private readonly head = new Int32Array(GRID_W * GRID_H);
  private next!: Int32Array;

  constructor(ctx: SceneContext) {
    this.ctx = ctx;
    if (ctx.config.scene.type !== "OVERFLOW_BOWL") throw new Error("expected OVERFLOW_BOWL");
    this.cfg = ctx.config.scene;
  }

  public laneCount(): number {
    return 1;
  }

  public laneId(): string {
    return "bowl";
  }

  public done(): boolean {
    return false;
  }

  public init(): void {
    const phys = this.ctx.config.physics;
    this.ppm = phys.pixels_per_meter;
    this.gx = phys.gravity[0] * this.ppm;
    this.gy = (phys.gravity[1] === 0 ? 11 : phys.gravity[1]) * this.ppm;
    this.wedgeAngle = 0;
    this.overflowCount = 0;
    const cap = this.ctx.pool.cap;
    this.splitCooldown = new Float64Array(cap);
    this.next = new Int32Array(cap);

    const cx = ARENA_W / 2;
    const cy = ARENA_H * 0.49;
    const rng = this.ctx.rng.physics;

    this.ctx.gov.spawn(this.ctx.pool, 0, this.cfg.initial_balls, this.cfg.ball_radius, (i, out) => {
      const side = i % 2 === 0 ? -1 : 1;
      out[0] = cx + side * (this.cfg.bowl_radius * 0.35 + rng() * 35);
      out[1] = cy - this.cfg.bowl_radius * 0.15 - rng() * 60;
      out[2] = side * (40 + rng() * 80);
      out[3] = -40 + rng() * 60;
    });

    const pool = this.ctx.pool;
    for (let i = 0; i < pool.count; i++) {
      pool.hue[i] = (i * 42) % 360;
      this.splitCooldown[i] = 0.25;
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
    const cy = ARENA_H * 0.49;
    const bowlR = cfg.bowl_radius;
    const rimRad = (cfg.rim_angle_deg * Math.PI) / 180;
    const halfWedge = ((cfg.wedge_angle_deg * 0.5) * Math.PI) / 180;
    const swingAmp = (cfg.swing_amplitude_deg * Math.PI) / 180;
    const bowlThick = 22;

    const rest = Math.min(0.95, phys.restitution_default);
    const maxV = phys.max_speed * this.ppm;

    const px = pool.x;
    const py = pool.y;
    const pvx = pool.vx;
    const pvy = pool.vy;
    const pr = pool.r;
    const ph = pool.heat;
    const plvl = pool.lvl;

    for (let i = 0; i < pool.count; i++) ph[i] *= 0.9;

    const maxEvents = Math.max(8, ctx.config.sound.max_events_per_frame);
    let emitted = 0;

    for (let s = 0; s < sub; s++) {
      const subT = timeSec + (s / sub) * dt;
      this.wedgeAngle = Math.sin(subT * cfg.swing_speed) * swingAmp;
      const omegaWedge = cfg.swing_speed * swingAmp * Math.cos(subT * cfg.swing_speed);

      // 1. Spatial-hash ball-to-ball stacking separation so the bowl physically fills up & overflows
      this.head.fill(-1);
      const n = pool.count;
      for (let i = 0; i < n; i++) {
        const gx = Math.max(0, Math.min(GRID_W - 1, Math.floor(px[i] / CELL)));
        const gy = Math.max(0, Math.min(GRID_H - 1, Math.floor(py[i] / CELL)));
        const cell = gy * GRID_W + gx;
        this.next[i] = this.head[cell];
        this.head[cell] = i;
      }

      for (let i = 0; i < n; i++) {
        let xi = px[i];
        let yi = py[i];
        const ri = pr[i];
        const gx = Math.max(0, Math.min(GRID_W - 1, Math.floor(xi / CELL)));
        const gy = Math.max(0, Math.min(GRID_H - 1, Math.floor(yi / CELL)));

        for (let oy = -1; oy <= 1; oy++) {
          const ny = gy + oy;
          if (ny < 0 || ny >= GRID_H) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const nx = gx + ox;
            if (nx < 0 || nx >= GRID_W) continue;
            let j = this.head[ny * GRID_W + nx];
            while (j >= 0) {
              if (j > i) {
                const dx = px[j] - xi;
                const dy = py[j] - yi;
                const minD = ri + pr[j];
                const d2 = dx * dx + dy * dy;
                if (d2 < minD * minD && d2 > 1e-6) {
                  const d = Math.sqrt(d2);
                  const ux = dx / d;
                  const uy = dy / d;
                  const overlap = (minD - d) * 0.5;
                  xi -= ux * overlap;
                  yi -= uy * overlap;
                  px[j] += ux * overlap;
                  py[j] += uy * overlap;

                  const rvx = pvx[j] - pvx[i];
                  const rvy = pvy[j] - pvy[i];
                  const vn = rvx * ux + rvy * uy;
                  if (vn < 0) {
                    const imp = -(1 + 0.65) * vn * 0.5;
                    pvx[i] -= imp * ux;
                    pvy[i] -= imp * uy;
                    pvx[j] += imp * ux;
                    pvy[j] += imp * uy;
                  }
                }
              }
              j = this.next[j];
            }
          }
        }
        px[i] = xi;
        py[i] = yi;
      }

      // 2. Integrate balls + Bowl & Pendulum Wedge collisions
      for (let i = 0; i < n; i++) {
        let x = px[i];
        let y = py[i];
        let vx = (pvx[i] + this.gx * sdt) * 0.9992;
        let vy = (pvy[i] + this.gy * sdt) * 0.9992;
        const r = pr[i];

        const sp = Math.hypot(vx, vy);
        if (sp > maxV) {
          vx = (vx / sp) * maxV;
          vy = (vy / sp) * maxV;
        }

        x += vx * sdt;
        y += vy * sdt;

        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);

        // Angle relative to straight DOWN (+Y axis is 0 rad, right is +, left is -)
        const theta = Math.atan2(dx, dy);

        // Check if inside outer bowl arc radius zone
        const innerWallR = bowlR - bowlThick * 0.5;
        const outerWallR = bowlR + bowlThick * 0.5;
        if (Math.abs(theta) <= rimRad && dist > innerWallR - r && dist < outerWallR + r) {
          // Ball hits curved bowl shell
          const nx = dx / (dist || 1);
          const ny = dy / (dist || 1);
          const onInner = dist <= bowlR;
          if (onInner) {
            x = cx + nx * (innerWallR - r);
            y = cy + ny * (innerWallR - r);
            const vn = vx * nx + vy * ny;
            if (vn > 0) {
              vx -= (1 + rest) * vn * nx;
              vy -= (1 + rest) * vn * ny;
              ph[i] = 1;
              if (emitted < maxEvents) {
                emitted++;
                ctx.emit({ t: subT, kind: "floor", lane: 0, index: 1 + (i % 10), x: x / ARENA_W, y: y / ARENA_H, vel: Math.min(1, vn / maxV), n: 1 });
              }
              this.trySplit(i, x, y, vx, vy, subT);
            }
          } else {
            x = cx + nx * (outerWallR + r);
            y = cy + ny * (outerWallR + r);
            const vn = vx * nx + vy * ny;
            if (vn < 0) {
              vx -= (1 + rest) * vn * nx;
              vy -= (1 + rest) * vn * ny;
            }
          }
        }

        // Check central pendulum wedge (pivots around (cx, cy), spans downward toward bowl floor)
        // Wedge exists in radial band [40, bowlR - bowlThick * 0.5] and angular span [wedgeAngle - halfWedge, wedgeAngle + halfWedge]
        if (dist > 35 && dist < bowlR - bowlThick * 0.3) {
          const dTheta = theta - this.wedgeAngle;
          // Angular width converted to arc distance
          const arcDist = Math.abs(dTheta) * dist;
          const wedgeHalfArc = halfWedge * dist;
          if (arcDist < wedgeHalfArc + r) {
            const side = dTheta >= 0 ? 1 : -1;
            const pushAng = this.wedgeAngle + side * (halfWedge + r / Math.max(40, dist));
            x = cx + Math.sin(pushAng) * dist;
            y = cy + Math.cos(pushAng) * dist;
            // Tangent normal pointing outward from wedge face
            const nx = side * Math.cos(pushAng);
            const ny = side * -Math.sin(pushAng);
            // Wedge surface velocity
            const wVx = omegaWedge * dist * Math.cos(pushAng);
            const wVy = omegaWedge * dist * -Math.sin(pushAng);
            const relVn = (vx - wVx) * nx + (vy - wVy) * ny;
            if (relVn < 0) {
              vx -= (1 + rest) * relVn * nx;
              vy -= (1 + rest) * relVn * ny;
              ph[i] = 1;
              if (emitted < maxEvents) {
                emitted++;
                ctx.emit({ t: subT, kind: "peg", lane: 0, index: 1 + (i % 8), x: x / ARENA_W, y: y / ARENA_H, vel: Math.min(1, -relVn / maxV), n: 1 });
              }
              this.trySplit(i, x, y, vx, vy, subT);
            }
          }
        }

        // Track balls overflowing out of the bowl!
        if (plvl[i] === 0 && (Math.abs(theta) > rimRad + 0.08 || dist > bowlR + 60)) {
          plvl[i] = 1;
          this.overflowCount++;
          ctx.ruleEvent("ON_EXIT_ENTER", 0, this.overflowCount);
          if (emitted < maxEvents) {
            emitted++;
            ctx.emit({ t: subT, kind: "exit", lane: 0, index: 1, x: x / ARENA_W, y: y / ARENA_H, vel: 0.9, n: 1 });
          }
        }

        // Keep spilled balls bouncing cleanly against viewport outer edges or recycle from top if fallen below screen
        if (x < r) { x = r; vx = Math.abs(vx) * 0.85; }
        if (x > ARENA_W - r) { x = ARENA_W - r; vx = -Math.abs(vx) * 0.85; }
        if (y > ARENA_H + r * 3) {
          // Recycle back to top or keep count
          y = cy - bowlR * 0.6;
          x = cx + (rng() * 2 - 1) * (bowlR * 0.45);
          vx = (rng() * 2 - 1) * 120;
          vy = 40;
          plvl[i] = 0;
        }

        px[i] = x;
        py[i] = y;
        pvx[i] = vx;
        pvy[i] = vy;
      }
    }
  }

  private trySplit(parentIdx: number, x: number, y: number, vx: number, vy: number, timeSec: number): void {
    const { ctx, cfg } = this;
    if (!cfg.split_on_hit) return;
    const pool = ctx.pool;
    if (pool.count >= pool.cap - 10) return;
    if (timeSec < this.splitCooldown[parentIdx]) return;

    const cd = Math.max(0.04, cfg.split_cooldown_ms / 1000);
    // Slight adaptive slowdown as pool gets large so overflow builds up rhythmically
    const fillFactor = 1 + (pool.count / pool.cap) * 2.5;
    this.splitCooldown[parentIdx] = timeSec + cd * fillFactor;

    const rng = ctx.rng.physics;
    const childIdxBefore = pool.count;
    ctx.gov.spawn(pool, 0, 1, cfg.ball_radius, (_k, out) => {
      out[0] = x + (rng() * 2 - 1) * 8;
      out[1] = y - 6;
      out[2] = vx * (0.85 + 0.3 * rng()) + (rng() * 2 - 1) * 80;
      out[3] = vy * (0.85 + 0.3 * rng()) - 40;
    });
    if (pool.count > childIdxBefore) {
      this.splitCooldown[childIdxBefore] = timeSec + cd * fillFactor;
      pool.hue[childIdxBefore] = (pool.hue[parentIdx] + 18) % 360;
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
    snap.wedgeAngle = this.wedgeAngle;
    snap.overflowCount = this.overflowCount;
    snap.escaped = this.overflowCount;
    snap.escapeGoal = this.ctx.pool.count;
    snap.flash = this.flashAmt;
    snap.shake = this.shakeAmt;
  }
}
