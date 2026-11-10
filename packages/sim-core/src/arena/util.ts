/** Shared helpers for the Algorithm Arena module (pure, deterministic, allocation-free). */

/** Background colour #060609 in little-endian 0xAABBGGRR. */
export const BG = 0xff090606;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Pack r,g,b (0..255) into 0xAABBGGRR with full alpha. */
export function rgb(r: number, g: number, b: number): number {
  const rr = r < 0 ? 0 : r > 255 ? 255 : r | 0;
  const gg = g < 0 ? 0 : g > 255 ? 255 : g | 0;
  const bb = b < 0 ? 0 : b > 255 ? 255 : b | 0;
  return (0xff000000 | (bb << 16) | (gg << 8) | rr) >>> 0;
}

/** Scale a packed colour's channels by f (0..~1.5), keeping alpha opaque. */
export function scaleColor(c: number, f: number): number {
  return rgb((c & 255) * f, ((c >>> 8) & 255) * f, ((c >>> 16) & 255) * f);
}

/** HSV (h in degrees, s,v in 0..1) to packed colour. */
export function hsv(h: number, s: number, v: number): number {
  const hh = (((h % 360) + 360) % 360) / 60;
  const i = Math.floor(hh);
  const f = hh - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  let r = v;
  let g = t;
  let b = p;
  switch (i) {
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
    default:
      break;
  }
  return rgb(r * 255, g * 255, b * 255);
}

/** Bresenham line into a w*h Uint32Array, clipped per pixel. */
export function drawLine(
  out: Uint32Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  col: number
): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  // hard cap guards against any pathological input
  let guard = dx - dy + 2;
  while (guard-- > 0) {
    if (x0 >= 0 && x0 < w && y0 >= 0 && y0 < h) out[y0 * w + x0] = col;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}
