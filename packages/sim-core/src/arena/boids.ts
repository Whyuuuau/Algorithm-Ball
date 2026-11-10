import type { PRNG } from "../prng/index.js";
import type { ArenaAlgorithm, ArenaEvent, ArenaFactory } from "./types.js";
import { BG, clamp, hsv, rgb } from "./util.js";

export const createBoids: ArenaFactory = (width, height, rng, params): ArenaAlgorithm => {
  const W = Math.max(32, Math.floor(width));
  const H = Math.max(32, Math.floor(height));
  const N = clamp(Math.round(params.count ?? 900), 50, 3000);
  const pull = clamp(params.gravity ?? 260, 20, 900);
  const rEvt = clamp(params.hole_radius ?? 9, 4, 28);
  const cell = 14;
  const cw = Math.ceil(W / cell);
  const ch = Math.ceil(H / cell);
  const head = new Int32Array(cw * ch);
  const next = new Int32Array(N);

  const bx = new Float32Array(N);
  const by = new Float32Array(N);
  const bvx = new Float32Array(N);
  const bvy = new Float32Array(N);
  const alive = new Uint8Array(N).fill(1);
  // faded trail buffer
  const trail = new Uint8Array(W * H);

  for (let i = 0; i < N; i++) {
    bx[i] = rng() * W;
    by[i] = rng() * H;
    const a = rng() * Math.PI * 2;
    const s = 40 + rng() * 35;
    bvx[i] = Math.cos(a) * s;
    bvy[i] = Math.sin(a) * s;
  }

  let hx = W * 0.5;
  let hy = H * 0.55;
  const p1 = rng() * 6.28;
  const p2 = rng() * 6.28;
  let absorbed = 0;
  let tick = 0;

  return {
    width: W,
    height: H,
    step(frame: number, dt: number, opsBudget: number, emit: (e: ArenaEvent) => void): void {
      tick = frame;
      // fade trail
      for (let i = 0; i < trail.length; i++) trail[i] = (trail[i] * 215) >> 8;

      const t = frame * dt;
      hx = W * (0.5 + 0.28 * Math.sin(t * 0.55 + p1));
      hy = H * (0.52 + 0.26 * Math.cos(t * 0.37 + p2));

      head.fill(-1);
      for (let i = 0; i < N; i++) {
        if (!alive[i]) continue;
        const gx = clamp((bx[i] / cell) | 0, 0, cw - 1);
        const gy = clamp((by[i] / cell) | 0, 0, ch - 1);
        const c = gy * cw + gx;
        next[i] = head[c];
        head[c] = i;
      }

      const maxNb = Math.max(4, Math.min(18, Math.floor(opsBudget / Math.max(1, N))));
      let eat = 0;
      const r2 = cell * cell;
      const sepR2 = 36;

      for (let i = 0; i < N; i++) {
        if (!alive[i]) continue;
        const x = bx[i];
        const y = by[i];
        let vx = bvx[i];
        let vy = bvy[i];

        const gx = clamp((x / cell) | 0, 0, cw - 1);
        const gy = clamp((y / cell) | 0, 0, ch - 1);
        let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, cnt = 0;
        outer: for (let dy = -1; dy <= 1; dy++) {
          const yy = gy + dy;
          if (yy < 0 || yy >= ch) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = gx + dx;
            if (xx < 0 || xx >= cw) continue;
            for (let j = head[yy * cw + xx]; j >= 0; j = next[j]) {
              if (j === i) continue;
              const ddx = bx[j] - x;
              const ddy = by[j] - y;
              const d2 = ddx * ddx + ddy * ddy;
              if (d2 < r2 && d2 > 1e-4) {
                cnt++;
                ax += bvx[j];
                ay += bvy[j];
                cx += bx[j];
                cy += by[j];
                if (d2 < sepR2) {
                  sx -= ddx / d2;
                  sy -= ddy / d2;
                }
                if (cnt >= maxNb) break outer;
              }
            }
          }
        }
        if (cnt > 0) {
          vx += (ax / cnt - vx) * 0.06 + (cx / cnt - x) * 0.015 + sx * 18;
          vy += (ay / cnt - vy) * 0.06 + (cy / cnt - y) * 0.015 + sy * 18;
        }

        // black hole pull + swirl
        const dx = hx - x;
        const dy = hy - y;
        const d2 = dx * dx + dy * dy;
        const d = Math.sqrt(d2) + 0.1;
        if (d < rEvt) {
          alive[i] = 0;
          absorbed++;
          eat++;
          continue;
        }
        const f = Math.min(240, (pull * 45) / (d2 + 80));
        const nx = dx / d;
        const ny = dy / d;
        vx += (nx * f + -ny * f * 0.45) * dt;
        vy += (ny * f + nx * f * 0.45) * dt;

        const sp = Math.hypot(vx, vy);
        const maxSp = 110;
        const minSp = 28;
        if (sp > maxSp) {
          vx = (vx / sp) * maxSp;
          vy = (vy / sp) * maxSp;
        } else if (sp < minSp && sp > 1e-4) {
          vx = (vx / sp) * minSp;
          vy = (vy / sp) * minSp;
        }

        let nxPos = x + vx * dt;
        let nyPos = y + vy * dt;
        if (nxPos < 2) { nxPos = 2; vx = Math.abs(vx); }
        else if (nxPos > W - 3) { nxPos = W - 3; vx = -Math.abs(vx); }
        if (nyPos < 2) { nyPos = 2; vy = Math.abs(vy); }
        else if (nyPos > H - 3) { nyPos = H - 3; vy = -Math.abs(vy); }

        bx[i] = nxPos;
        by[i] = nyPos;
        bvx[i] = vx;
        bvy[i] = vy;
        trail[(nyPos | 0) * W + (nxPos | 0)] = 255;
      }

      if (eat > 0) {
        emit({ kind: "absorb", magnitude: clamp(0.25 + eat / 12, 0.25, 1), x: hx / W, y: hy / H });
      }
    },
    render(out: Uint32Array): void {
      for (let i = 0; i < out.length; i++) {
        const tr = trail[i];
        out[i] = tr > 8 ? rgb((tr * 0.2) | 0, (tr * 0.7) | 0, tr) : BG;
      }
      // accretion ring
      const rRing = rEvt + 6;
      const x0 = Math.max(0, Math.floor(hx - rRing - 4));
      const x1 = Math.min(W - 1, Math.ceil(hx + rRing + 4));
      const y0 = Math.max(0, Math.floor(hy - rRing - 4));
      const y1 = Math.min(H - 1, Math.ceil(hy + rRing + 4));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d = Math.hypot(x - hx, y - hy);
          if (d < rEvt) out[y * W + x] = rgb(2, 0, 4);
          else if (d < rRing) {
            const k = 1 - Math.abs(d - (rEvt + 2.5)) / 4;
            if (k > 0) out[y * W + x] = hsv((tick * 3 + Math.atan2(y - hy, x - hx) * 57) % 360, 0.75, clamp(k, 0.2, 1));
          }
        }
      }
      // boids
      for (let i = 0; i < N; i++) {
        if (!alive[i]) continue;
        const x = bx[i] | 0;
        const y = by[i] | 0;
        const h = ((Math.atan2(bvy[i], bvx[i]) * 180) / Math.PI + 360) % 360;
        const col = hsv(h, 0.75, 1);
        out[y * W + x] = col;
        if (x + 1 < W) out[y * W + x + 1] = col;
      }
    },
    progress: () => clamp(absorbed / Math.max(1, N * 0.85), 0, 1),
    done: () => absorbed >= N,
    hud: () => [
      { label: "Tersisa", value: String(N - absorbed) },
      { label: "Terserap", value: String(absorbed) }
    ]
  };
};
