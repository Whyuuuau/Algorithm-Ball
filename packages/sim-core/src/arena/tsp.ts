import type { PRNG } from "../prng/index.js";
import type { ArenaAlgorithm, ArenaEvent, ArenaFactory } from "./types.js";
import { BG, clamp, drawLine, hsv, rgb } from "./util.js";

export const createTsp2Opt: ArenaFactory = (width, height, rng, params): ArenaAlgorithm => {
  const W = Math.max(32, Math.floor(width));
  const H = Math.max(32, Math.floor(height));
  const N = clamp(Math.round(params.cities ?? 260), 30, 800);
  const maxSwaps = clamp(Math.round(params.swaps_per_frame ?? 4), 1, 40);

  const cx = new Float32Array(N);
  const cy = new Float32Array(N);
  const tour = new Int32Array(N);
  const padX = W * 0.08;
  const padY = H * 0.2;
  for (let i = 0; i < N; i++) {
    cx[i] = padX + rng() * (W - padX * 2);
    cy[i] = padY + rng() * (H - padY * 1.45);
    tour[i] = i;
  }
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = tour[i];
    tour[i] = tour[j];
    tour[j] = t;
  }

  const dist = (a: number, b: number): number => Math.hypot(cx[a] - cx[b], cy[a] - cy[b]);
  const calcLen = (): number => {
    let s = 0;
    for (let i = 0; i < N; i++) s += dist(tour[i], tour[(i + 1) % N]);
    return s;
  };
  const initLen = calcLen();
  let curLen = initLen;
  const est = 0.7124 * Math.sqrt(N * (W - padX * 2) * (H - padY * 1.45));
  let ii = 0;
  let jj = 2;
  let swaps = 0;
  let sinceSwap = 0;
  let finished = false;
  let hiA = -1;
  let hiB = -1;
  let hiGlow = 0;

  const reverse = (a: number, b: number): void => {
    while (a < b) {
      const t = tour[a];
      tour[a] = tour[b];
      tour[b] = t;
      a++;
      b--;
    }
  };

  return {
    width: W,
    height: H,
    step(_frame: number, _dt: number, opsBudget: number, emit: (e: ArenaEvent) => void): void {
      hiGlow *= 0.85;
      if (finished) return;
      const budget = Math.max(64, opsBudget | 0);
      let ops = 0;
      let doneSwaps = 0;
      while (ops < budget && doneSwaps < maxSwaps && !finished) {
        if (jj >= N) {
          ii++;
          if (ii >= N - 2) {
            if (sinceSwap >= (N * (N - 3)) / 2) {
              finished = true;
              break;
            }
            ii = 0;
          }
          jj = ii + 2;
        }
        if (ii === 0 && jj === N - 1) {
          jj++;
          continue;
        }
        const a = tour[ii];
        const b = tour[ii + 1];
        const c = tour[jj];
        const d = tour[(jj + 1) % N];
        const gain = dist(a, b) + dist(c, d) - (dist(a, c) + dist(b, d));
        ops++;
        sinceSwap++;
        if (gain > 1e-4) {
          reverse(ii + 1, jj);
          curLen = Math.max(1, curLen - gain);
          swaps++;
          doneSwaps++;
          sinceSwap = 0;
          hiA = ii;
          hiB = jj;
          hiGlow = 1;
          emit({
            kind: "improve",
            magnitude: clamp(0.2 + (gain / (initLen / N)) * 0.4, 0.15, 1),
            x: (cx[a] + cx[c]) / (2 * W),
            y: (cy[a] + cy[c]) / (2 * H)
          });
        }
        jj++;
      }
    },
    render(out: Uint32Array): void {
      out.fill(BG);
      for (let i = 0; i < N; i++) {
        const a = tour[i];
        const b = tour[(i + 1) % N];
        const col = hsv((i / N) * 300 + 170, 0.85, 0.9);
        drawLine(out, W, H, cx[a], cy[a], cx[b], cy[b], col);
      }
      if (hiGlow > 0.08 && hiA >= 0) {
        const white = rgb(255, 255, 255);
        for (const k of [hiA, hiB]) {
          const a = tour[k];
          const b = tour[(k + 1) % N];
          drawLine(out, W, H, cx[a], cy[a], cx[b], cy[b], white);
        }
      }
      const dot = rgb(255, 255, 255);
      for (let i = 0; i < N; i++) {
        const x = Math.round(cx[i]);
        const y = Math.round(cy[i]);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const px = x + dx;
            const py = y + dy;
            if (px >= 0 && px < W && py >= 0 && py < H) out[py * W + px] = dot;
          }
        }
      }
    },
    progress(): number {
      if (finished) return 1;
      return clamp(1 - (curLen - est) / Math.max(1, initLen - est), 0, 0.99);
    },
    done: () => finished,
    hud: () => [
      { label: "Panjang Rute", value: Math.round(curLen).toLocaleString() },
      { label: "Perbaikan", value: swaps.toLocaleString() },
      { label: "Kota", value: String(N) }
    ]
  };
};
