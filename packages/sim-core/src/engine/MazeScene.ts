import type { MazeEscapeSceneConfig, RuleAction } from "@asmr/schema";
import type { Scene, SceneContext } from "./TowerScene.js";
import { ARENA_H, ARENA_W } from "./TowerScene.js";
import type { RingView, SimSnapshot } from "./types.js";

const TAU = Math.PI * 2;
const MAX_RAW = 4096;

function angDiff(a: number, b: number): number {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
}

export class MazeScene implements Scene {
  private readonly cfg: MazeEscapeSceneConfig;
  public readonly rings: RingView[] = [];
  private readonly speeds: number[] = [];
  private readonly ringAngle: number[] = [];
  private speedMult = 1;
  private escaped = 0;
  private winner = -1;
  private flashAmt = 0;
  private shakeAmt = 0;
  private frame = 0;
  private gx: number;
  private gy: number;
  private readonly cx = ARENA_W / 2;
  private readonly cy = ARENA_H / 2;
  private readonly ppm: number;

  private rawX = new Float32Array(MAX_RAW);
  private rawY = new Float32Array(MAX_RAW);
  private rawVel = new Float32Array(MAX_RAW);
  private rawIdx = new Uint16Array(MAX_RAW);
  private rawSub = new Uint8Array(MAX_RAW);
  private rawN = 0;

  constructor(private readonly ctx: SceneContext) {
    this.cfg = ctx.config.scene as MazeEscapeSceneConfig;
    this.ppm = ctx.config.physics.pixels_per_meter;
    this.gx = ctx.config.physics.gravity[0] * this.ppm;
    this.gy = ctx.config.physics.gravity[1] * this.ppm;
  }

  public laneCount(): number {
    return 1;
  }
  public laneId(): string {
    return "maze";
  }
  public done(): boolean {
    return this.winner >= 0;
  }

  public init(): void {
    // rings sorted from inner to outer so level logic holds
    const sorted = [...this.cfg.rings].sort((a, b) => a.radius - b.radius);
    sorted.forEach((r, i) => {
      this.rings.push({
        radius: r.radius,
        thickness: r.thickness,
        angle: (i * 2.399963) % TAU,
        gap: (r.gap_angle_deg * Math.PI) / 180,
        broken: false,
        passes: 0,
        durability: r.durability
      });
      this.speeds.push(r.angular_speed);
      this.ringAngle.push((i * 2.399963) % TAU);
    });
    this.spawn(this.cfg.initial_balls, this.cx, this.cy);
  }

  private spawn(count: number, x: number, y: number): void {
    const { ctx, cfg } = this;
    const rng = ctx.rng.physics;
    const sp = (ctx.config.physics.speed_lock > 0 ? ctx.config.physics.speed_lock : 12) * this.ppm;
    ctx.gov.spawn(ctx.pool, 0, count, cfg.ball_radius, (_i, out) => {
      const a = rng() * TAU;
      out[0] = x + Math.cos(a) * 8 * rng();
      out[1] = y + Math.sin(a) * 8 * rng();
      out[2] = Math.cos(a) * sp;
      out[3] = Math.sin(a) * sp;
    });
  }

  public step(frame: number, timeSec: number): void {
    this.frame = frame;
    const { ctx, cfg } = this;
    const pool = ctx.pool;
    const phys = ctx.config.physics;
    const dt = ctx.dt;
    const sub = phys.substeps;
    const sdt = dt / sub;

    for (let i = 0; i < this.rings.length; i++) {
      this.ringAngle[i] += this.speeds[i] * this.speedMult * dt;
      this.rings[i].angle = this.ringAngle[i];
    }
    this.flashAmt *= 0.8;
    this.shakeAmt *= 0.85;

    const calmOutroSec = ctx.config.arc.calm_outro_sec ?? 3.0;
    const remainingSec = Math.max(0, ctx.config.meta.duration_sec - timeSec);
    const inCalmOutro = calmOutroSec > 0 && remainingSec <= calmOutroSec;
    if (inCalmOutro) {
      this.shakeAmt = 0;
      this.flashAmt = 0;
    }

    const heat = pool.heat;
    for (let i = 0, n = pool.count; i < n; i++) heat[i] *= 0.9;

    this.rawN = 0;
    const osc = phys.gravity_oscillation ?? 0;
    const curGx = osc > 0 ? this.gx * Math.cos(timeSec * osc) : this.gx;
    const curGy = osc > 0 ? this.gy * (0.85 + 0.15 * Math.sin(timeSec * osc)) : this.gy;
    const gx = curGx * sdt;
    const gy = curGy * sdt;
    const drag = phys.air_drag ?? 0;
    const dragDamp = drag > 0 ? Math.max(0, 1 - drag * sdt * 60) : 1;
    const maxV = phys.max_speed * this.ppm;
    const lock = phys.speed_lock * this.ppm;
    const rest = phys.restitution_default;
    const rings = this.rings;
    const RN = rings.length;
    const px = pool.x, py = pool.y, pvx = pool.vx, pvy = pool.vy, pr = pool.r, pw = pool.w, plv = pool.lvl;
    const cx = this.cx;
    const cy = this.cy;
    const rng = ctx.rng.physics;
    const sm = this.speedMult;

    for (let s = 0; s < sub; s++) {
      const n = pool.count;
      for (let i = 0; i < n; i++) {
        let vx = (pvx[i] + gx) * dragDamp;
        let vy = (pvy[i] + gy) * dragDamp;
        const sp2 = vx * vx + vy * vy;
        if (lock > 0 && sp2 > 1e-6) {
          const k = lock / Math.sqrt(sp2);
          vx *= k;
          vy *= k;
        } else if (sp2 > maxV * maxV) {
          const k = maxV / Math.sqrt(sp2);
          vx *= k;
          vy *= k;
        }
        let x = px[i] + vx * sdt;
        let y = py[i] + vy * sdt;
        const r = pr[i];

        // outer arena box
        if (x < r) { x = r; if (vx < 0) vx = -vx * rest; }
        else if (x > ARENA_W - r) { x = ARENA_W - r; if (vx > 0) vx = -vx * rest; }
        if (y < r) { y = r; if (vy < 0) vy = -vy * rest; }
        else if (y > ARENA_H - r) { y = ARENA_H - r; if (vy > 0) vy = -vy * rest; }

        let lvl = plv[i];
        // level tracking: crossing the ring centre line changes level
        let dx = x - cx;
        let dy = y - cy;
        let d = Math.sqrt(dx * dx + dy * dy);
        while (lvl < RN && d > rings[lvl].radius) {
          // crossed ring `lvl` outward (only possible through its gap or if it is broken)
          const rg = rings[lvl];
          if (!rg.broken) {
            rg.passes += pw[i];
            if (rg.durability > 0 && rg.passes >= rg.durability) {
              rg.broken = true;
              this.flashAmt = Math.max(this.flashAmt, 0.5);
              ctx.emit({ t: timeSec + (s / sub) * dt, kind: "ring_break", lane: 0, index: lvl + 1, x: x / ARENA_W, y: y / ARENA_H, vel: 1, n: 1 });
              ctx.ruleEvent("ON_RING_BREAK", 0, lvl + 1);
            }
          }
          lvl++;
        }
        while (lvl > 0 && d < rings[lvl - 1].radius) lvl--;

        if (lvl >= RN) {
          // escaped the last ring -> counts, recycle to the centre
          this.escaped += pw[i];
          ctx.emit({ t: timeSec + (s / sub) * dt, kind: "exit", lane: 0, index: RN, x: x / ARENA_W, y: y / ARENA_H, vel: 1, n: 1 });
          ctx.ruleEvent("ON_EXIT_ENTER", 0, 0);
          if (!inCalmOutro) this.flashAmt = Math.max(this.flashAmt, 0.25);
          if (this.escaped >= cfg.balls_to_escape && this.winner < 0) {
            this.winner = 0;
            if (!inCalmOutro) {
              this.flashAmt = 1;
              this.shakeAmt = 1;
            }
          }
          const a = rng() * TAU;
          const spd = Math.max(1, Math.sqrt(vx * vx + vy * vy));
          x = cx;
          y = cy;
          vx = Math.cos(a) * spd;
          vy = Math.sin(a) * spd;
          lvl = 0;
          dx = 0;
          dy = 0;
          d = 0;
          heat[i] = 1;
          if (cfg.spawn_on_escape > 0) this.spawn(cfg.spawn_on_escape, cx, cy);
        } else if (d > 1e-6) {
          // collide with inner ring (lvl-1) and outer ring (lvl)
          for (let q = lvl - 1; q <= lvl; q++) {
            if (q < 0 || q >= RN) continue;
            const rg = rings[q];
            if (rg.broken) continue;
            const half = rg.thickness / 2 + r;
            const off = d - rg.radius;
            if (off > -half && off < half) {
              // inside the gap?
              const phi = Math.atan2(dy, dx);
              const gapEff = rg.gap - (2 * r) / rg.radius;
              if (gapEff > 0 && Math.abs(angDiff(phi, rg.angle)) < gapEff / 2) continue;
              const nx = dx / d;
              const ny = dy / d;
              // push to the side the ball belongs to (level decides the side)
              const outside = q < lvl;
              const target = outside ? rg.radius + half : rg.radius - half;
              x = cx + nx * target;
              y = cy + ny * target;
              // ring surface velocity (tangential)
              const w = this.speeds[q] * sm;
              const svx = -ny * target * w;
              const svy = nx * target * w;
              const rvx = vx - svx;
              const rvy = vy - svy;
              const vn = rvx * nx + rvy * ny;
              if ((outside && vn < 0) || (!outside && vn > 0)) {
                vx = rvx - (1 + rest) * vn * nx + svx;
                vy = rvy - (1 + rest) * vn * ny + svy;
                heat[i] = 1;
                if (this.rawN < MAX_RAW) {
                  const k = this.rawN++;
                  this.rawX[k] = x / ARENA_W;
                  this.rawY[k] = y / ARENA_H;
                  this.rawVel[k] = Math.max(0.12, Math.min(1, Math.abs(vn) / maxV));
                  this.rawIdx[k] = q + 1;
                  this.rawSub[k] = s;
                }
              }
              dx = x - cx;
              dy = y - cy;
              d = Math.sqrt(dx * dx + dy * dy);
            }
          }
        }

        plv[i] = lvl;
        px[i] = x;
        py[i] = y;
        pvx[i] = vx;
        pvy[i] = vy;
      }
    }

    // keep the K strongest ring impacts
    const K = Math.max(8, ctx.config.sound.max_events_per_frame);
    const best: number[] = [];
    for (let i = 0; i < this.rawN; i++) {
      if (best.length < K) best.push(i);
      else {
        let wi = 0;
        for (let j = 1; j < best.length; j++) if (this.rawVel[best[j]] < this.rawVel[best[wi]]) wi = j;
        if (this.rawVel[i] > this.rawVel[best[wi]]) best[wi] = i;
      }
    }
    best.sort((a, b) => a - b);
    const merged = best.length ? Math.max(1, Math.round(this.rawN / best.length)) : 1;
    for (const i of best) {
      ctx.emit({
        t: timeSec + (this.rawSub[i] / sub) * dt,
        kind: "ring",
        lane: 0,
        index: this.rawIdx[i],
        x: this.rawX[i],
        y: this.rawY[i],
        vel: this.rawVel[i],
        n: merged
      });
    }
  }

  public apply(action: RuleAction): void {
    switch (action.type) {
      case "SPAWN":
        this.spawn(action.count ?? 10, this.cx, this.cy);
        break;
      case "SCALE_BALL": {
        const pool = this.ctx.pool;
        const f = action.value ?? 1.2;
        for (let i = 0; i < pool.count; i++) {
          pool.baseR[i] = Math.max(2, Math.min(40, pool.baseR[i] * f));
          pool.setWeight(i, pool.w[i]);
        }
        break;
      }
      case "SET_GRAVITY":
        this.gy = (action.value ?? 0) * this.ppm;
        this.gx = (action.value2 ?? 0) * this.ppm;
        break;
      case "ROTATE_ARENA":
        this.speedMult = Math.max(-4, Math.min(4, this.speedMult * (action.value ?? 1.25)));
        break;
      case "SHAKE": {
        const calmOutroSec = ctx.config.arc.calm_outro_sec ?? 3.0;
        const remainingSec = Math.max(0, ctx.config.meta.duration_sec - this.frame * ctx.dt);
        if (calmOutroSec <= 0 || remainingSec > calmOutroSec) {
          this.shakeAmt = Math.max(this.shakeAmt, action.value ?? 1);
        }
        break;
      }
      case "FLASH": {
        const calmOutroSec = ctx.config.arc.calm_outro_sec ?? 3.0;
        const remainingSec = Math.max(0, ctx.config.meta.duration_sec - this.frame * ctx.dt);
        if (calmOutroSec <= 0 || remainingSec > calmOutroSec) {
          this.flashAmt = Math.max(this.flashAmt, action.value ?? 1);
        }
        break;
      }
      default:
        break;
    }
  }

  public fill(snap: SimSnapshot): void {
    snap.rings = this.rings;
    snap.escaped = this.escaped;
    snap.escapeGoal = this.cfg.balls_to_escape;
    snap.winnerLane = this.winner;
    snap.flash = this.flashAmt;
    snap.shake = this.shakeAmt;
    snap.progress = Math.min(1, this.escaped / Math.max(1, this.cfg.balls_to_escape));
  }
}

