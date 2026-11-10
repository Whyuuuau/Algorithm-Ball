import type { PRNG } from "../prng/index.js";
import type { ArenaAlgorithm, ArenaEvent, ArenaFactory } from "./types.js";
import { BG, clamp, rgb } from "./util.js";

/**
 * BFS wavefront vs Dielectric-Breakdown-Model (DBM / SOR Laplace) lightning racing from the top
 * of a seeded obstacle field to a grounded bottom target.
 */
export const createBfsLightning: ArenaFactory = (width, height, rng, params): ArenaAlgorithm => {
  const W = Math.max(40, Math.floor(width));
  const H = Math.max(40, Math.floor(height));
  const S = W > 180 ? 2 : 1;
  const gw = Math.floor(W / S);
  const gh = Math.floor(H / S);
  const GN = gw * gh;

  const eta = clamp(params.eta ?? 3.2, 0.5, 6);
  const obsDensity = clamp(params.obstacles ?? 0.2, 0, 0.35);
  const bfsRate = clamp(Math.round(params.bfs_steps ?? 5), 1, 30);

  const wall = new Uint8Array(GN);
  const rows = Math.floor(gh / 7);
  for (let r = 2; r < rows - 2; r++) {
    if (rng() > obsDensity * 2.5) continue;
    const y = r * 7 + Math.floor(rng() * 3);
    const gap1 = 2 + Math.floor(rng() * (gw - 4));
    const gap2 = 2 + Math.floor(rng() * (gw - 4));
    const gw1 = 3 + Math.floor(rng() * 5);
    for (let x = 1; x < gw - 1; x++) {
      if (Math.abs(x - gap1) <= gw1 || Math.abs(x - gap2) <= gw1) continue;
      if (rng() < 0.8) wall[y * gw + x] = 1;
    }
  }

  const startX = gw >> 1;
  const startY = 2;
  const goalY = gh - 3;
  wall[startY * gw + startX] = 0;
  for (let x = 0; x < gw; x++) wall[goalY * gw + x] = 0;

  // BFS
  const bfsVis = new Uint8Array(GN);
  const bfsParent = new Int32Array(GN).fill(-1);
  const bfsQ = new Int32Array(GN);
  let qHead = 0;
  let qTail = 0;
  const sIdx = startY * gw + startX;
  bfsVis[sIdx] = 1;
  bfsQ[qTail++] = sIdx;
  let bfsDone = false;
  let bfsMaxY = startY;

  // DBM lightning: potential u in [0 (tree/top), 1 (bottom ground)]
  const tree = new Uint8Array(GN);
  const lParent = new Int32Array(GN).fill(-1);
  const u = new Float32Array(GN);
  for (let y = 0; y < gh; y++) {
    const v = y / (gh - 1);
    for (let x = 0; x < gw; x++) u[y * gw + x] = v;
  }
  tree[sIdx] = 1;
  u[sIdx] = 0;
  const cand = new Int32Array(GN);
  const candFrom = new Int32Array(GN);
  const candIn = new Uint8Array(GN);
  let candN = 0;
  const addCand = (idx: number, from: number): void => {
    if (wall[idx] || tree[idx] || candIn[idx]) return;
    candIn[idx] = 1;
    cand[candN] = idx;
    candFrom[candN] = from;
    candN++;
  };
  const addNb = (idx: number): void => {
    const x = idx % gw;
    const y = (idx / gw) | 0;
    if (x > 0) addCand(idx - 1, idx);
    if (x < gw - 1) addCand(idx + 1, idx);
    if (y > 0) addCand(idx - gw, idx);
    if (y < gh - 1) addCand(idx + gw, idx);
  };
  addNb(sIdx);
  let lDone = false;
  let lCount = 1;
  let lMaxY = startY;
  let winner = "";

  const pathMask = new Uint8Array(GN); // 1 = bfs winning path, 2 = lightning main bolt

  const trace = (goal: number, par: Int32Array, bit: number): void => {
    let c = goal;
    let guard = GN;
    while (c >= 0 && guard-- > 0) {
      pathMask[c] |= bit;
      c = par[c];
    }
  };

  return {
    width: W,
    height: H,
    step(frame: number, _dt: number, opsBudget: number, emit: (e: ArenaEvent) => void): void {
      if (bfsDone && lDone) return;
      let ops = 0;
      const budget = Math.max(200, opsBudget | 0);

      // 1. BFS steps
      for (let k = 0; k < bfsRate && !bfsDone && qHead < qTail; k++) {
        const cur = bfsQ[qHead++];
        const x = cur % gw;
        const y = (cur / gw) | 0;
        if (y > bfsMaxY) bfsMaxY = y;
        if (y >= goalY) {
          bfsDone = true;
          trace(cur, bfsParent, 1);
          if (!winner) winner = "BFS";
          emit({ kind: "reach", magnitude: 1, x: x / gw, y: y / gh });
          break;
        }
        const nbs = [x > 0 ? cur - 1 : -1, x < gw - 1 ? cur + 1 : -1, y > 0 ? cur - gw : -1, y < gh - 1 ? cur + gw : -1];
        for (const nb of nbs) {
          if (nb >= 0 && !wall[nb] && !bfsVis[nb]) {
            bfsVis[nb] = 1;
            bfsParent[nb] = cur;
            bfsQ[qTail++] = nb;
          }
        }
        ops += 4;
      }

      // 2. SOR Laplace sweeps + 1-2 lightning growths
      if (!lDone && candN > 0) {
        const sweeps = Math.max(1, Math.min(3, Math.floor((budget - ops) / Math.max(1, GN))));
        for (let s = 0; s < sweeps; s++) {
          for (let y = 1; y < gh - 1; y++) {
            const row = y * gw;
            for (let x = 1; x < gw - 1; x++) {
              const i = row + x;
              if (tree[i] || wall[i]) continue;
              const avg = 0.25 * (u[i - 1] + u[i + 1] + u[i - gw] + u[i + gw]);
              u[i] += 1.75 * (avg - u[i]);
            }
          }
        }
        for (let g = 0; g < 2 && !lDone && candN > 0; g++) {
          let sum = 0;
          for (let i = 0; i < candN; i++) sum += Math.pow(Math.max(1e-4, u[cand[i]]), eta);
          let r = rng() * sum;
          let pick = candN - 1;
          for (let i = 0; i < candN; i++) {
            r -= Math.pow(Math.max(1e-4, u[cand[i]]), eta);
            if (r <= 0) {
              pick = i;
              break;
            }
          }
          const idx = cand[pick];
          const from = candFrom[pick];
          candN--;
          cand[pick] = cand[candN];
          candFrom[pick] = candFrom[candN];
          tree[idx] = 1;
          lParent[idx] = from;
          u[idx] = 0;
          lCount++;
          addNb(idx);
          const x = idx % gw;
          const y = (idx / gw) | 0;
          if (y > lMaxY) lMaxY = y;
          if (y >= goalY) {
            lDone = true;
            trace(idx, lParent, 2);
            if (!winner) winner = "PETIR";
            emit({ kind: "reach", magnitude: 1, x: x / gw, y: y / gh });
          } else if ((frame & 1) === 0) {
            emit({ kind: "grow", magnitude: clamp(0.2 + (y / gh) * 0.7, 0.2, 0.95), x: x / gw, y: y / gh });
          }
        }
      }
    },
    render(out: Uint32Array): void {
      const cWall = rgb(58, 62, 88);
      const cBfs = rgb(0, 180, 230);
      const cBfsPath = rgb(80, 255, 220);
      const cBolt = rgb(190, 120, 255);
      const cBoltCore = rgb(255, 245, 255);
      for (let y = 0; y < H; y++) {
        const gy = Math.min(gh - 1, (y / S) | 0) * gw;
        const row = y * W;
        for (let x = 0; x < W; x++) {
          const i = gy + Math.min(gw - 1, (x / S) | 0);
          let col = BG;
          if (wall[i]) col = cWall;
          else if (pathMask[i] & 2) col = cBoltCore;
          else if (tree[i]) col = cBolt;
          else if (pathMask[i] & 1) col = cBfsPath;
          else if (bfsVis[i]) col = cBfs;
          out[row + x] = col;
        }
      }
    },
    progress(): number {
      return clamp(Math.max(bfsMaxY, lMaxY) / Math.max(1, goalY), 0, 1);
    },
    done: () => bfsDone && lDone,
    hud: () => [
      { label: "BFS Sel", value: String(qHead) },
      { label: "Petir Sel", value: String(lCount) },
      { label: "Juara", value: winner || "Berpacu..." }
    ]
  };
};
