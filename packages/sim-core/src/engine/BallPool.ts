/**
 * Structure-of-arrays ball storage. Everything the renderer needs is read straight from
 * these typed arrays (zero copy, zero per-frame allocation).
 */
export class BallPool {
  public readonly cap: number;
  public count = 0;
  public readonly x: Float64Array;
  public readonly y: Float64Array;
  public readonly vx: Float64Array;
  public readonly vy: Float64Array;
  /** collision + render radius in px */
  public readonly r: Float32Array;
  /** radius without the weight bonus (px) */
  public readonly baseR: Float32Array;
  /** damage / virtual weight */
  public readonly w: Float64Array;
  public readonly lane: Uint8Array;
  /** 0..1 hit glow, decays every frame */
  public readonly heat: Float32Array;
  /** maze ring level (number of rings already crossed) */
  public readonly lvl: Uint16Array;
  /** rotation angle in radians (used for cubes / tumbling shapes) */
  public readonly rot: Float32Array;
  /** per-entity hue (0..360) for rainbow palettes */
  public readonly hue: Float32Array;

  constructor(cap: number) {
    this.cap = cap;
    this.x = new Float64Array(cap);
    this.y = new Float64Array(cap);
    this.vx = new Float64Array(cap);
    this.vy = new Float64Array(cap);
    this.r = new Float32Array(cap);
    this.baseR = new Float32Array(cap);
    this.w = new Float64Array(cap);
    this.lane = new Uint8Array(cap);
    this.heat = new Float32Array(cap);
    this.lvl = new Uint16Array(cap);
    this.rot = new Float32Array(cap);
    this.hue = new Float32Array(cap);
  }

  public clear(): void {
    this.count = 0;
  }

  /** Sub-linear visual/collision radius: r = base * (1 + 0.15 * log10(weight)). */
  public static radiusFor(base: number, weight: number): number {
    return weight <= 1 ? base : base * (1 + 0.15 * Math.log10(weight));
  }

  public add(x: number, y: number, vx: number, vy: number, baseR: number, w: number, lane: number): number {
    if (this.count >= this.cap) return -1;
    const i = this.count++;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.baseR[i] = baseR;
    this.w[i] = w;
    this.r[i] = BallPool.radiusFor(baseR, w);
    this.lane[i] = lane;
    this.heat[i] = 0;
    this.lvl[i] = 0;
    this.rot[i] = 0;
    this.hue[i] = (i * 137.508) % 360;
    return i;
  }

  public setWeight(i: number, w: number): void {
    this.w[i] = w;
    this.r[i] = BallPool.radiusFor(this.baseR[i], w);
  }
}

