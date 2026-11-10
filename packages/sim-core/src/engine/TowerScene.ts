import type { ProjectConfig, RuleAction, TowerBreakerSceneConfig } from "@asmr/schema";
import { resolveFloorHp } from "@asmr/schema";
import type { SeededRNGPool } from "../prng/index.js";
import type { PopulationGovernor } from "../governor/PopulationGovernor.js";
import type { BallPool } from "./BallPool.js";
import type { FloorView, HitEvent, HitKind, PegView, SimSnapshot } from "./types.js";

export const ARENA_W = 1080;
export const ARENA_H = 1920;

export interface SceneContext {
  config: ProjectConfig;
  dt: number;
  rng: SeededRNGPool;
  pool: BallPool;
  gov: PopulationGovernor;
  emit(ev: Omit<HitEvent, "shift">): void;
  ruleEvent(trigger: "ON_FLOOR_BREAK" | "ON_EXIT_ENTER" | "ON_RING_BREAK", lane: number, index: number): void;
}

export interface Scene {
  init(): void;
  step(frame: number, timeSec: number): void;
  apply(action: RuleAction, laneIdx: number): void;
  fill(snap: SimSnapshot): void;
  done(): boolean;
  laneCount(): number;
  laneId(i: number): string;
}

const MAX_RAW = 8192;

export class TowerScene implements Scene {
  private readonly cfg: TowerBreakerSceneConfig;
  private readonly L: number;
  private readonly ppm: number;
  private readonly laneX0: number[] = [];
  private readonly laneX1: number[] = [];
  public readonly floors: FloorView[] = [];
  public readonly pegs: PegView[] = [];
  private readonly laneFloorStart: number[] = [];
  private readonly laneFloorCount: number[] = [];
  private readonly laneCur: number[] = [];
  private readonly laneRadiusScale: number[] = [];
  private pegRows = 0;
  private pegPer = 0;
  private pegTop = 0;
  private pegDy = 0;
  private pegCount = 0;
  private pegBase: number[] = [];

  private gx: number;
  private gy: number;
  private stalemate = 0;
  private stopFrames = 0;
  private winner = -1;
  private winnerFrame = -1;
  private flashAmt = 0;
  private shakeAmt = 0;
  private frame = 0;

  // raw hit buffer (struct of arrays)
  private rawKind = new Uint8Array(MAX_RAW);
  private rawLane = new Uint8Array(MAX_RAW);
  private rawIdx = new Uint16Array(MAX_RAW);
  private rawX = new Float32Array(MAX_RAW);
  private rawY = new Float32Array(MAX_RAW);
  private rawVel = new Float32Array(MAX_RAW);
  private rawSub = new Uint8Array(MAX_RAW);
  private rawN = 0;
  private rawDropped = 0;
  private static readonly KINDS: HitKind[] = ["floor", "peg", "wall"];

  constructor(private readonly ctx: SceneContext) {
    this.cfg = ctx.config.scene as TowerBreakerSceneConfig;
    this.L = this.cfg.lanes.length;
    this.ppm = ctx.config.physics.pixels_per_meter;
    this.gx = ctx.config.physics.gravity[0] * this.ppm;
    this.gy = ctx.config.physics.gravity[1] * this.ppm;
  }

  public laneCount(): number {
    return this.L;
  }
  public laneId(i: number): string {
    return this.cfg.lanes[i]?.id ?? "";
  }
  public done(): boolean {
    return this.winner >= 0;
  }

  public init(): void {
    const { cfg, L } = this;
    const laneW = ARENA_W / L;
    const floorTop = ARENA_H * 0.4;
    const floorBottom = ARENA_H * 0.9;

    let maxFloors = 1;
    const hpLists: number[][] = [];
    for (let l = 0; l < L; l++) {
      this.laneX0.push(l * laneW);
      this.laneX1.push((l + 1) * laneW);
      this.laneRadiusScale.push(1);
      const hp = resolveFloorHp(cfg, cfg.lanes[l]);
      hpLists.push(hp);
      if (hp.length > maxFloors) maxFloors = hp.length;
    }
    const spacing = maxFloors > 1 ? (floorBottom - floorTop) / (maxFloors - 1) : 0;
    for (let l = 0; l < L; l++) {
      this.laneFloorStart.push(this.floors.length);
      this.laneFloorCount.push(hpLists[l].length);
      this.laneCur.push(0);
      for (let k = 0; k < hpLists[l].length; k++) {
        this.floors.push({
          lane: l,
          index: k + 1,
          y: floorTop + k * spacing,
          x0: this.laneX0[l],
          x1: this.laneX1[l],
          hp: hpLists[l][k],
          maxHp: hpLists[l][k],
          broken: false,
          glow: 0
        });
      }
    }

    // pegs
    const pg = cfg.pegs;
    if (pg.enabled) {
      this.pegRows = pg.rows;
      this.pegPer = pg.per_row;
      this.pegTop = pg.top * ARENA_H;
      const bottom = Math.min(pg.bottom * ARENA_H, floorTop - 70);
      this.pegDy = pg.rows > 1 ? Math.max(20, (bottom - this.pegTop) / (pg.rows - 1)) : 0;
      const sx = laneW / pg.per_row;
      for (let l = 0; l < L; l++) {
        this.pegBase.push(this.pegs.length);
        for (let r = 0; r < pg.rows; r++) {
          for (let k = 0; k < pg.per_row; k++) {
            const odd = r % 2 === 1;
            if (odd && k === pg.per_row - 1) {
              // dummy slot to keep fixed stride; hidden (radius 0)
              this.pegs.push({ x: -1000, y: -1000, r: 0, lane: l, glow: 0 });
              continue;
            }
            const x = this.laneX0[l] + (odd ? (k + 1) * sx : (k + 0.5) * sx);
            this.pegs.push({ x, y: this.pegTop + r * this.pegDy, r: pg.radius, lane: l, glow: 0 });
          }
        }
      }
      this.pegCount = this.pegs.length;
    }

    // initial population
    for (let l = 0; l < L; l++) this.spawnLane(l, cfg.lanes[l].initial_balls, -1);
  }

  private spawnLane(l: number, count: number, atY: number): void {
    const { ctx, cfg } = this;
    const lane = cfg.lanes[l];
    const rng = ctx.rng.physics;
    const cx = (this.laneX0[l] + this.laneX1[l]) / 2;
    const span = (this.laneX1[l] - this.laneX0[l]) * 0.3;
    const sp = cfg.spawn_speed * this.ppm;
    const y0 = atY >= 0 ? atY : ARENA_H * 0.05;
    const baseR = lane.ball_radius * this.laneRadiusScale[l];
    ctx.gov.spawn(ctx.pool, l, count, baseR, (i, out) => {
      out[0] = cx + (rng() * 2 - 1) * span;
      out[1] = y0 + rng() * 30;
      out[2] = (rng() * 2 - 1) * sp;
      out[3] = rng() * sp * 0.5;
    });
  }

  private pushRaw(kind: number, lane: number, idx: number, x: number, y: number, vel: number, sub: number): void {
    if (this.rawN >= MAX_RAW) {
      this.rawDropped++;
      return;
    }
    const n = this.rawN++;
    this.rawKind[n] = kind;
    this.rawLane[n] = lane;
    this.rawIdx[n] = idx;
    this.rawX[n] = x;
    this.rawY[n] = y;
    this.rawVel[n] = vel;
    this.rawSub[n] = sub;
  }

  public step(frame: number, timeSec: number): void {
    this.frame = frame;
    const { ctx, cfg } = this;
    const pool = ctx.pool;
    const phys = ctx.config.physics;
    const dt = ctx.dt;

    // decays
    for (let i = 0; i < this.floors.length; i++) this.floors[i].glow *= 0.88;
    for (let i = 0; i < this.pegCount; i++) this.pegs[i].glow *= 0.86;
    const heat = pool.heat;
    for (let i = 0, n = pool.count; i < n; i++) heat[i] *= 0.9;
    this.flashAmt *= 0.8;
    this.shakeAmt *= 0.85;

    this.rawN = 0;

    if (this.stopFrames > 0) {
      this.stopFrames--;
      return;
    }

    this.stalemate += dt;
    const dmgMult = this.stalemate > cfg.anti_stalemate_sec ? 1 + (this.stalemate - cfg.anti_stalemate_sec) * 0.5 : 1;

    const sub = phys.substeps;
    const sdt = dt / sub;
    const gx = this.gx * sdt;
    const gy = this.gy * sdt;
    const maxV = phys.max_speed * this.ppm;
    const maxV2 = maxV * maxV;
    const lock = phys.speed_lock * this.ppm;
    const rest = phys.restitution_default;
    const minBounce = phys.bounce_min_speed * this.ppm;
    const kick = phys.bounce_kick * this.ppm;
    const wallTicks = ctx.config.sound.wall_ticks;
    const rng = ctx.rng.physics;
    const thick2 = cfg.floor_thickness / 2;
    const hasPegs = this.pegCount > 0 && this.pegRows > 0;
    const pegR = cfg.pegs.radius;
    const pegSx = ARENA_W / this.L / Math.max(1, this.pegPer);

    const px = pool.x, py = pool.y, pvx = pool.vx, pvy = pool.vy, pr = pool.r, pw = pool.w, pl = pool.lane;
    const floors = this.floors;
    const lcur = this.laneCur;
    const lfs = this.laneFloorStart;
    const lfc = this.laneFloorCount;
    const lx0 = this.laneX0;
    const lx1 = this.laneX1;
    const pegTop = this.pegTop;
    const pegDy = this.pegDy;
    const pegRowsN = this.pegRows;
    const pegPer = this.pegPer;
    const pegs = this.pegs;
    const pegBase = this.pegBase;

    for (let s = 0; s < sub; s++) {
      const n = pool.count;
      for (let i = 0; i < n; i++) {
        let vx = pvx[i] + gx;
        let vy = pvy[i] + gy;
        let sp2 = vx * vx + vy * vy;
        if (lock > 0 && sp2 > 1e-6) {
          const k = lock / Math.sqrt(sp2);
          vx *= k;
          vy *= k;
        } else if (sp2 > maxV2) {
          const k = maxV / Math.sqrt(sp2);
          vx *= k;
          vy *= k;
        }
        let x = px[i] + vx * sdt;
        let y = py[i] + vy * sdt;
        const r = pr[i];
        const l = pl[i];

        // lane walls
        const a = lx0[l] + r;
        const b = lx1[l] - r;
        if (x < a) {
          x = a;
          if (vx < 0) {
            if (wallTicks) this.pushRaw(2, l, 0, x / ARENA_W, y / ARENA_H, Math.min(1, -vx / maxV) * 0.5, s);
            vx = -vx * rest;
          }
        } else if (x > b) {
          x = b;
          if (vx > 0) {
            if (wallTicks) this.pushRaw(2, l, 0, x / ARENA_W, y / ARENA_H, Math.min(1, vx / maxV) * 0.5, s);
            vx = -vx * rest;
          }
        }
        if (y < r) {
          y = r;
          if (vy < 0) vy = -vy * rest;
        }

        // pegs
        if (hasPegs && y > pegTop - pegR - r - 2 && y < pegTop + (pegRowsN - 1) * pegDy + pegR + r + 2) {
          const rr0 = pegDy > 0 ? Math.round((y - pegTop) / pegDy) : 0;
          const base = pegBase[l];
          for (let rr = rr0 - 1; rr <= rr0 + 1; rr++) {
            if (rr < 0 || rr >= pegRowsN) continue;
            const odd = (rr & 1) === 1;
            const kc = odd ? Math.round((x - lx0[l]) / pegSx) - 1 : Math.floor((x - lx0[l]) / pegSx);
            for (let k = kc - 1; k <= kc + 1; k++) {
              if (k < 0 || k >= pegPer || (odd && k === pegPer - 1)) continue;
              const peg = pegs[base + rr * pegPer + k];
              const dx = x - peg.x;
              const dy = y - peg.y;
              const rad = r + peg.r;
              const d2 = dx * dx + dy * dy;
              if (d2 < rad * rad && d2 > 1e-9) {
                const d = Math.sqrt(d2);
                const nx = dx / d;
                const ny = dy / d;
                x = peg.x + nx * rad;
                y = peg.y + ny * rad;
                const vn = vx * nx + vy * ny;
                if (vn < 0) {
                  vx -= (1 + rest) * vn * nx;
                  vy -= (1 + rest) * vn * ny;
                  peg.glow = 1;
                  heat[i] = 1;
                  this.pushRaw(1, l, rr + 1, x / ARENA_W, y / ARENA_H, Math.min(1, -vn / maxV), s);
                }
              }
            }
          }
        }

        // current floor of the lane
        const cur = lcur[l];
        if (cur < lfc[l]) {
          const fl = floors[lfs[l] + cur];
          const top = fl.y - thick2;
          if (y + r > top && y < fl.y + thick2) {
            y = top - r;
            if (vy > 0) {
              const impact = vy;
              let nvy = -impact * rest;
              if (-nvy < minBounce) nvy = -minBounce;
              vy = nvy;
              vx += (rng() * 2 - 1) * kick;
              heat[i] = 1;
              fl.glow = 1;
              this.pushRaw(0, l, fl.index, x / ARENA_W, y / ARENA_H, Math.max(0.12, Math.min(1, impact / maxV)), s);
              fl.hp -= pw[i] * dmgMult;
              if (fl.hp <= 0) this.breakFloor(fl, l, x, s);
            }
          }
        }

        px[i] = x;
        py[i] = y;
        pvx[i] = vx;
        pvy[i] = vy;
      }
    }

    this.flushRaw(timeSec, dt, sub);
  }

  private breakFloor(fl: FloorView, l: number, x: number, sub: number): void {
    const { ctx, cfg } = this;
    fl.broken = true;
    fl.hp = 0;
    fl.glow = 1;
    this.laneCur[l]++;
    this.stalemate = 0;
    ctx.emit({
      t: this.frame * ctx.dt + (sub / ctx.config.physics.substeps) * ctx.dt,
      kind: "break",
      lane: l,
      index: fl.index,
      x: x / ARENA_W,
      y: fl.y / ARENA_H,
      vel: 1,
      n: 1
    });
    ctx.ruleEvent("ON_FLOOR_BREAK", l, fl.index);
    if (ctx.config.feel.hit_stop_on_break) this.stopFrames = Math.max(this.stopFrames, ctx.config.feel.hit_stop_frames);
    if (ctx.config.feel.flash_on_break) this.flashAmt = Math.max(this.flashAmt, 0.55);

    if (this.laneCur[l] >= this.laneFloorCount[l] && this.winner < 0) {
      this.winner = l;
      this.winnerFrame = this.frame;
      this.flashAmt = 1;
      this.shakeAmt = 1;
    }

    const lane = cfg.lanes[l];
    const act = lane.on_floor_break;
    const cx = (this.laneX0[l] + this.laneX1[l]) / 2;
    const y = fl.y - 80;
    switch (act.op) {
      case "MULTIPLY":
        this.spawnLane(l, Math.floor(ctx.gov.virtual[l] * (act.value - 1)), y);
        break;
      case "ADD":
        this.spawnLane(l, act.value, y);
        break;
      case "SCALE_SIZE":
        this.scaleLaneSize(l, act.value);
        break;
      case "SCALE_SPEED":
        this.scaleLaneSpeed(l, act.value);
        break;
      default:
        break;
    }
    void cx;
  }

  private scaleLaneSize(l: number, f: number): void {
    const pool = this.ctx.pool;
    const next = Math.max(0.3, Math.min(3, this.laneRadiusScale[l] * f));
    const eff = next / this.laneRadiusScale[l];
    this.laneRadiusScale[l] = next;
    for (let i = 0; i < pool.count; i++) {
      if (pool.lane[i] === l) {
        pool.baseR[i] *= eff;
        pool.setWeight(i, pool.w[i]);
      }
    }
  }

  private scaleLaneSpeed(l: number, f: number): void {
    const pool = this.ctx.pool;
    const k = Math.max(0.4, Math.min(2.5, f));
    for (let i = 0; i < pool.count; i++) {
      if (pool.lane[i] === l) {
        pool.vx[i] *= k;
        pool.vy[i] *= k;
      }
    }
  }

  /** Reduce thousands of raw impacts to the K strongest per lane/kind and emit them. */
  private flushRaw(timeSec: number, dt: number, sub: number): void {
    const K = this.ctx.config.sound.max_events_per_frame;
    const L = this.L;
    // [lane][kindIdx] -> indices of top K
    for (let l = 0; l < L; l++) {
      for (let kind = 0; kind < 3; kind++) {
        let picked = 0;
        let total = 0;
        const best: number[] = [];
        for (let i = 0; i < this.rawN; i++) {
          if (this.rawLane[i] !== l || this.rawKind[i] !== kind) continue;
          total++;
          if (best.length < K) {
            best.push(i);
          } else {
            let wi = 0;
            for (let j = 1; j < best.length; j++) if (this.rawVel[best[j]] < this.rawVel[best[wi]]) wi = j;
            if (this.rawVel[i] > this.rawVel[best[wi]]) best[wi] = i;
          }
        }
        picked = best.length;
        if (picked === 0) continue;
        best.sort((a, b) => a - b);
        const merged = Math.max(1, Math.round(total / picked));
        for (const i of best) {
          this.ctx.emit({
            t: timeSec + (this.rawSub[i] / sub) * dt,
            kind: TowerScene.KINDS[kind],
            lane: l,
            index: this.rawIdx[i],
            x: this.rawX[i],
            y: this.rawY[i],
            vel: this.rawVel[i],
            n: merged
          });
        }
      }
    }
  }

  public apply(action: RuleAction, laneIdx: number): void {
    const { ctx } = this;
    const l = action.at ? Math.max(0, this.cfg.lanes.findIndex((x) => x.id === action.at)) : laneIdx;
    switch (action.type) {
      case "SPAWN":
        this.spawnLane(l, action.count ?? 10, -1);
        break;
      case "SCALE_BALL":
        this.scaleLaneSize(l, action.value ?? 1.2);
        break;
      case "SET_GRAVITY":
        this.gy = (action.value ?? 9.81) * this.ppm;
        this.gx = (action.value2 ?? 0) * this.ppm;
        break;
      case "ROTATE_ARENA": {
        const a = ((action.value ?? 15) * Math.PI) / 180;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const ngx = this.gx * c - this.gy * s;
        const ngy = this.gx * s + this.gy * c;
        this.gx = ngx;
        this.gy = ngy;
        break;
      }
      case "DAMAGE_WALL": {
        const cur = this.laneCur[l];
        if (cur < this.laneFloorCount[l]) {
          const fl = this.floors[this.laneFloorStart[l] + cur];
          fl.hp -= action.value ?? 100;
          fl.glow = 1;
          if (fl.hp <= 0) this.breakFloor(fl, l, (this.laneX0[l] + this.laneX1[l]) / 2, 0);
        }
        break;
      }
      case "SHAKE":
        this.shakeAmt = Math.max(this.shakeAmt, action.value ?? 1);
        break;
      case "FLASH":
        this.flashAmt = Math.max(this.flashAmt, action.value ?? 1);
        break;
      default:
        break;
    }
    void ctx;
  }

  public fill(snap: SimSnapshot): void {
    snap.floors = this.floors;
    snap.pegs = this.pegs;
    snap.winnerLane = this.winner;
    snap.winnerFrame = this.winnerFrame;
    snap.hitStop = this.stopFrames > 0;
    snap.flash = this.flashAmt;
    snap.shake = this.shakeAmt;
    let best = 0;
    for (let l = 0; l < this.L; l++) {
      const frac = this.laneCur[l] / Math.max(1, this.laneFloorCount[l]);
      if (frac > best) best = frac;
    }
    snap.progress = best;
  }

  /** Highest floor broken per lane (used by Seed Scout). */
  public laneProgress(l: number): number {
    return this.laneCur[l] / Math.max(1, this.laneFloorCount[l]);
  }
}

