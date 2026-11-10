import type { PRNG } from "../prng/index.js";
import type { ArenaAlgorithm, ArenaEvent, ArenaFactory, ArenaHudStat } from "./types.js";
import { BG, clamp, rgb } from "./util.js";

export const EMPTY = 0;
export const WALL = 1;
export const SAND = 2;
export const WATER = 3;
export const LAVA = 4;
export const ICE = 5;
export const STEAM = 6;
export const OBSIDIAN = 7;
export const GLASS = 8;

const HORIZON = 3600; // ~60 s at 60 fps

const BASE_COLORS: number[][] = [
  [0, 0, 0], // EMPTY (unused)
  [78, 78, 112], // WALL
  [255, 205, 60], // SAND
  [30, 140, 255], // WATER
  [255, 85, 15], // LAVA
  [175, 240, 255], // ICE
  [205, 205, 240], // STEAM
  [150, 70, 235], // OBSIDIAN
  [60, 255, 190], // GLASS
];

/**
 * 'Falling Sand Alchemist' – a cellular automaton on a Uint8Array grid.
 * Ops accounting: every material move / spawn / reaction costs 1 op. The scan itself
 * (a cheap read of each cell) is O(width*height) and not charged.
 */
export const createFallingSand: ArenaFactory = (
  width: number,
  height: number,
  rng: PRNG,
  params: Record<string, number>
): ArenaAlgorithm => {
  const W = Math.max(8, Math.floor(width));
  const H = Math.max(8, Math.floor(height));
  const n = W * H;
  const g = new Uint8Array(n);
  const stamp = new Uint32Array(n);

  const nEm = clamp(Math.round(params.emitters ?? 4), 1, 8);
  const flow = clamp(Math.round(params.flow ?? 3), 1, 12);
  const nWalls = clamp(Math.round(params.walls ?? 5), 0, 16);
  const pour = Math.max(3, Math.round(W / 60));

  // ---- floor + seeded ramps -------------------------------------------------------------
  for (let x = 0; x < W; x++) g[(H - 1) * W + x] = WALL;
  const setWall = (x: number, y: number): void => {
    if (x >= 0 && x < W && y >= 2 && y < H) g[y * W + x] = WALL;
  };
  for (let w = 0; w < nWalls; w++) {
    const len = W * (0.18 + rng() * 0.22);
    const cx = W * (0.1 + rng() * 0.8);
    const cy = H * (0.3 + rng() * 0.5);
    const slope = (0.15 + rng() * 0.4) * (rng() < 0.5 ? -1 : 1);
    const x0 = cx - len / 2;
    const x1 = cx + len / 2;
    const y0 = cy - (len / 2) * slope;
    const y1 = cy + (len / 2) * slope;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      setWall(x, y);
      setWall(x, y + 1);
    }
  }

  // ---- emitters --------------------------------------------------------------------------
  const emitMats = [SAND, WATER, LAVA, ICE, SAND, WATER, LAVA, SAND];
  const emX = new Int32Array(nEm);
  const emMat = new Uint8Array(nEm);
  const emStart = new Int32Array(nEm);
  const emEnd = new Int32Array(nEm);
  let maxEnd = 1;
  for (let e = 0; e < nEm; e++) {
    emX[e] = clamp(Math.round(W * ((e + 0.5) / nEm) + (rng() - 0.5) * (W / nEm) * 0.5), 2, W - 3);
    emMat[e] = emitMats[e % emitMats.length];
    emStart[e] = emMat[e] === LAVA ? 40 + Math.floor(rng() * 200) : 1 + Math.floor(rng() * 40);
    emEnd[e] = Math.floor(HORIZON * (0.6 + rng() * 0.4));
    if (emEnd[e] > maxEnd) maxEnd = emEnd[e];
  }

  // ---- palette (8 shades per material) ---------------------------------------------------
  const pal = new Uint32Array(9 * 8);
  for (let m = 1; m < 9; m++) {
    for (let k = 0; k < 8; k++) {
      const f = (0.72 + (0.28 * k) / 7) * (m === STEAM ? 0.8 : 1);
      pal[m * 8 + k] = rgb(BASE_COLORS[m][0] * f, BASE_COLORS[m][1] * f, BASE_COLORS[m][2] * f);
    }
  }

  // ---- state -----------------------------------------------------------------------------
  let tick = 0;
  let filled = 0;
  let totalReactions = 0;
  let lastSettle = -100;
  let ops = 0;
  let recentMoves = 1000;
  let activeEmitters = nEm;

  const mv = (i: number, j: number): void => {
    const t = g[j];
    g[j] = g[i];
    g[i] = t;
    stamp[i] = tick;
    stamp[j] = tick;
    ops++;
  };

  const step = (_frame: number, _dt: number, opsBudget: number, emit: (e: ArenaEvent) => void): void => {
    tick++;
    const budget = Math.max(16, Math.floor(opsBudget));
    ops = 0;
    let reactions = 0;
    let landed = 0;
    let rxX = 0;
    let rxY = 0;
    let ldX = 0;
    let ldY = 0;
    const startOps = ops;

    // emitters (limited to a quarter of the budget)
    activeEmitters = 0;
    const spawnLimit = budget >> 2;
    for (let e = 0; e < nEm; e++) {
      if (tick < emStart[e] || tick > emEnd[e]) continue;
      activeEmitters++;
      const m = emMat[e];
      const spawns = m === LAVA ? (flow + 1) >> 1 : flow;
      for (let k = 0; k < spawns && ops < spawnLimit; k++) {
        let cx = emX[e] + Math.floor(rng() * pour) - (pour >> 1);
        cx = cx < 1 ? 1 : cx > W - 2 ? W - 2 : cx;
        const idx = W + cx;
        if (g[idx] === EMPTY) {
          g[idx] = m;
          stamp[idx] = tick;
          filled++;
          ops++;
        }
      }
    }

    const fwd = (tick & 1) === 0;
    const lim2 = n - 2 * W;
    outer: for (let y = H - 2; y >= 0; y--) {
      const row = y * W;
      for (let k = 0; k < W; k++) {
        const x = fwd ? k : W - 1 - k;
        const i = row + x;
        const m = g[i];
        if (m < SAND || m === OBSIDIAN || m === GLASS) continue;
        if (stamp[i] === tick) continue;
        if (ops >= budget) break outer;

        switch (m) {
          case SAND:
          case ICE: {
            const b = g[i + W];
            let j = -1;
            if (b === EMPTY || b === STEAM || (m === SAND && b === WATER)) {
              j = i + W;
            } else {
              const dl = x > 0 ? g[i + W - 1] : WALL;
              const dr = x < W - 1 ? g[i + W + 1] : WALL;
              const okL = dl === EMPTY || dl === STEAM || (m === SAND && dl === WATER);
              const okR = dr === EMPTY || dr === STEAM || (m === SAND && dr === WATER);
              if (okL && okR) j = rng() < 0.5 ? i + W - 1 : i + W + 1;
              else if (okL) j = i + W - 1;
              else if (okR) j = i + W + 1;
            }
            if (j >= 0) {
              mv(i, j);
              if (j === i + W && j < lim2 && g[j + W] === EMPTY) {
                mv(j, j + W);
                j += W;
              }
              if (m === SAND && g[j + W] !== EMPTY && g[j + W] !== STEAM) {
                landed++;
                ldX = j % W;
                ldY = (j / W) | 0;
              }
            }
            break;
          }
          case WATER: {
            const b = g[i + W];
            let j = -1;
            if (b === EMPTY || b === STEAM) {
              j = i + W;
            } else {
              const dl = x > 0 ? g[i + W - 1] : WALL;
              const dr = x < W - 1 ? g[i + W + 1] : WALL;
              const okL = dl === EMPTY || dl === STEAM;
              const okR = dr === EMPTY || dr === STEAM;
              if (okL && okR) j = rng() < 0.5 ? i + W - 1 : i + W + 1;
              else if (okL) j = i + W - 1;
              else if (okR) j = i + W + 1;
              else {
                const sl = x > 0 && g[i - 1] === EMPTY;
                const sr = x < W - 1 && g[i + 1] === EMPTY;
                if (sl && sr) j = rng() < 0.5 ? i - 1 : i + 1;
                else if (sl) j = i - 1;
                else if (sr) j = i + 1;
              }
            }
            if (j >= 0) {
              mv(i, j);
              if (j === i + W && j < lim2 && g[j + W] === EMPTY) mv(j, j + W);
            } else if (rng() < 0.015) {
              // slow freezing next to ice
              const up = y > 0 ? g[i - W] : WALL;
              const lf = x > 0 ? g[i - 1] : WALL;
              const rt = x < W - 1 ? g[i + 1] : WALL;
              if (up === ICE || lf === ICE || rt === ICE || g[i + W] === ICE) {
                g[i] = ICE;
                ops++;
              }
            }
            break;
          }
          case LAVA: {
            let gone = false;
            for (let d = 0; d < 4 && !gone; d++) {
              let j: number;
              if (d === 0) {
                if (y === 0) continue;
                j = i - W;
              } else if (d === 1) {
                j = i + W;
              } else if (d === 2) {
                if (x === 0) continue;
                j = i - 1;
              } else {
                if (x === W - 1) continue;
                j = i + 1;
              }
              const nm = g[j];
              if (nm === WATER) {
                if (rng() < 0.4) {
                  g[i] = OBSIDIAN;
                  g[j] = STEAM;
                  stamp[j] = tick;
                  reactions++;
                  rxX = x;
                  rxY = y;
                  ops++;
                  gone = true;
                }
              } else if (nm === ICE) {
                if (rng() < 0.12) {
                  g[j] = WATER;
                  stamp[j] = tick;
                  reactions++;
                  rxX = x;
                  rxY = y;
                  ops++;
                  if (rng() < 0.3) {
                    g[i] = OBSIDIAN;
                    gone = true;
                  }
                }
              } else if (nm === SAND) {
                if (rng() < 0.015) {
                  g[j] = GLASS;
                  reactions++;
                  rxX = x;
                  rxY = y;
                  ops++;
                }
              }
            }
            if (gone) break;
            if (y > 0 && g[i - W] === EMPTY && rng() < 0.002) {
              g[i] = OBSIDIAN; // slow crust cooling
              ops++;
              break;
            }
            if (rng() < 0.4) {
              const b = g[i + W];
              let j = -1;
              if (b === EMPTY || b === STEAM) {
                j = i + W;
              } else {
                const dl = x > 0 ? g[i + W - 1] : WALL;
                const dr = x < W - 1 ? g[i + W + 1] : WALL;
                const okL = dl === EMPTY || dl === STEAM;
                const okR = dr === EMPTY || dr === STEAM;
                if (okL && okR) j = rng() < 0.5 ? i + W - 1 : i + W + 1;
                else if (okL) j = i + W - 1;
                else if (okR) j = i + W + 1;
                else {
                  const sl = x > 0 && g[i - 1] === EMPTY;
                  const sr = x < W - 1 && g[i + 1] === EMPTY;
                  if (sl && sr) j = rng() < 0.5 ? i - 1 : i + 1;
                  else if (sl) j = i - 1;
                  else if (sr) j = i + 1;
                }
              }
              if (j >= 0) mv(i, j);
            }
            break;
          }
          case STEAM: {
            if (y === 0 || rng() < 0.007) {
              g[i] = EMPTY;
              filled--;
              ops++;
              break;
            }
            let j = -1;
            if (g[i - W] === EMPTY && rng() < 0.85) {
              j = i - W;
            } else {
              const ul = x > 0 && g[i - W - 1] === EMPTY;
              const ur = x < W - 1 && g[i - W + 1] === EMPTY;
              if (ul && ur) j = rng() < 0.5 ? i - W - 1 : i - W + 1;
              else if (ul) j = i - W - 1;
              else if (ur) j = i - W + 1;
              else {
                const sl = x > 0 && g[i - 1] === EMPTY;
                const sr = x < W - 1 && g[i + 1] === EMPTY;
                if (sl && sr) j = rng() < 0.5 ? i - 1 : i + 1;
                else if (sl) j = i - 1;
                else if (sr) j = i + 1;
              }
            }
            if (j >= 0) mv(i, j);
            break;
          }
          default:
            break;
        }
      }
    }

    recentMoves = recentMoves * 0.9 + (ops - startOps) * 0.1;

    // events (<= 2 per frame)
    if (reactions > 0) {
      totalReactions += reactions;
      emit({
        kind: "reaction",
        magnitude: clamp(0.2 + reactions / 10, 0, 1),
        x: rxX / W,
        y: rxY / H,
      });
    }
    if (landed > 0 && tick - lastSettle >= 8 && rng() < 0.35) {
      lastSettle = tick;
      emit({
        kind: "settle",
        magnitude: clamp(0.15 + landed / 40, 0, 1),
        x: ldX / W,
        y: ldY / H,
      });
    } else if (reactions === 0 && activeEmitters > 0 && tick % 12 === 0) {
      const eIdx = (tick / 12) % nEm | 0;
      emit({
        kind: "pour",
        magnitude: 0.22,
        x: emX[eIdx] / W,
        y: 0.08,
      });
    }
  };

  const render = (out: Uint32Array): void => {
    const fl = tick >> 1;
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const m = g[row + x];
        if (m === EMPTY) {
          out[row + x] = BG;
        } else {
          const shade = (x * 5 + y * 3 + (m === LAVA || m === STEAM ? fl : 0)) & 7;
          out[row + x] = pal[m * 8 + shade];
        }
      }
    }
  };

  const done = (): boolean => tick > maxEnd && recentMoves < 10;

  const progress = (): number => {
    if (done()) return 1;
    const tf = clamp(tick / maxEnd, 0, 1);
    const ff = clamp(filled / (n * 0.3), 0, 1);
    return clamp(0.6 * tf + 0.4 * ff, 0, 1);
  };

  const hud = (): ArenaHudStat[] => [
    { label: "Particles", value: String(filled) },
    { label: "Reactions", value: String(totalReactions) },
    { label: "Emitters", value: `${activeEmitters}/${nEm}` },
  ];

  return { width: W, height: H, step, render, progress, done, hud };
};
