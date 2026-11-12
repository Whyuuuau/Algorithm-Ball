import type { PaletteName } from "@asmr/schema";

export const SAMPLE_RATE = 48000;

interface Recipe {
  ratios: number[];
  decays: number[]; // seconds (time constant)
  amps: number[];
}

/** Modal synthesis recipes (ratios of vibrating-bar / bell partials). */
export const RECIPES: Record<PaletteName, Recipe> = {
  kalimba_glow: { ratios: [1, 6.27, 17.55], decays: [0.9, 0.3, 0.07], amps: [1, 0.35, 0.12] },
  glass_bell: { ratios: [1, 2.76, 5.4, 8.93], decays: [1.5, 1.0, 0.6, 0.3], amps: [1, 0.6, 0.4, 0.2] },
  marimba_wood: { ratios: [1, 3.98, 9.92], decays: [0.32, 0.18, 0.07], amps: [1, 0.5, 0.22] },
  thocky_keys: { ratios: [1, 1.8], decays: [0.05, 0.03], amps: [1, 0.4] },
  water_drop: { ratios: [1, 2], decays: [0.11, 0.04], amps: [1, 0.25] },
  synth_pluck: { ratios: [1, 2, 3, 4, 6], decays: [0.38, 0.22, 0.14, 0.08, 0.04], amps: [1, 0.65, 0.4, 0.25, 0.12] },
  music_box: { ratios: [1, 5.82, 9.4], decays: [1.1, 0.35, 0.09], amps: [1, 0.45, 0.18] },
  crystal_bowl: { ratios: [1, 1.006, 2.76, 5.4], decays: [2.0, 1.8, 1.2, 0.7], amps: [1, 0.85, 0.35, 0.15] },
  cosmic_laser: { ratios: [1, 2.5], decays: [0.14, 0.05], amps: [1, 0.3] },
  handpan_steel: { ratios: [1, 2, 2.99, 4.02], decays: [1.25, 0.65, 0.28, 0.12], amps: [1, 0.55, 0.26, 0.1] },
  celesta_chime: { ratios: [1, 3.01, 5.18, 8.2], decays: [1.4, 0.75, 0.35, 0.14], amps: [1, 0.42, 0.22, 0.09] }
};

/** Tiny deterministic noise source (LCG) so synthesis never touches Math.random. */
function makeNoise(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
}

/** Render one note. Pure function of (palette, freq). */
export function renderModalSample(palette: PaletteName, freq: number, sr: number = SAMPLE_RATE): Float32Array {
  const rc = RECIPES[palette];
  const tauMax = Math.max(...rc.decays);
  const dur = Math.min(2.4, Math.max(0.12, tauMax * 5.5));
  const len = Math.ceil(dur * sr);
  const out = new Float32Array(len);

  if (palette === "water_drop") {
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const f = freq * (1 + 1.4 * Math.exp(-t / 0.018));
      phase += (2 * Math.PI * f) / sr;
      out[i] = Math.sin(phase) * Math.exp(-t / rc.decays[0]) + 0.25 * Math.sin(phase * 2.01) * Math.exp(-t / rc.decays[1]);
    }
  } else if (palette === "cosmic_laser") {
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const f = freq * (1 + 2.5 * Math.exp(-t / 0.022));
      phase += (2 * Math.PI * f) / sr;
      out[i] = Math.sin(phase) * Math.exp(-t / rc.decays[0]) + 0.3 * Math.sin(phase * 2) * Math.exp(-t / rc.decays[1]);
    }
  } else if (palette === "thocky_keys") {
    const noise = makeNoise(0x9e3779b9 ^ Math.round(freq * 100));
    const thump = Math.min(220, Math.max(70, freq * 0.5));
    let lp = 0;
    let c = 1;
    let s = 0;
    const w = (2 * Math.PI * thump) / sr;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      lp += 0.35 * (noise() - lp);
      const n = lp * Math.exp(-t / 0.012);
      const nc = c * cw - s * sw;
      s = c * sw + s * cw;
      c = nc;
      out[i] = 0.55 * n + 0.8 * s * Math.exp(-t / 0.05) + 0.25 * Math.sin(2 * Math.PI * freq * 2 * t) * Math.exp(-t / 0.02);
    }
  } else {
    for (let m = 0; m < rc.ratios.length; m++) {
      const f = freq * rc.ratios[m];
      if (f >= sr / 2 - 200) continue;
      const w = (2 * Math.PI * f) / sr;
      const cw = Math.cos(w);
      const sw = Math.sin(w);
      const decay = Math.exp(-1 / (sr * rc.decays[m]));
      let c = 1;
      let s = 0;
      let env = rc.amps[m];
      for (let i = 0; i < len; i++) {
        out[i] += env * s;
        const nc = c * cw - s * sw;
        s = c * sw + s * cw;
        c = nc;
        env *= decay;
      }
    }
  }

  // normalise, 1.5ms attack ramp, 6ms release
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const a = Math.abs(out[i]);
    if (a > peak) peak = a;
  }
  const norm = peak > 0 ? 0.8 / peak : 1;
  const atk = Math.max(1, Math.floor(0.0015 * sr));
  const rel = Math.max(1, Math.floor(0.006 * sr));
  for (let i = 0; i < len; i++) {
    let g = norm;
    if (i < atk) g *= i / atk;
    if (i > len - rel) g *= (len - i) / rel;
    out[i] *= g;
  }
  return out;
}

/** Cache of mono sample banks, shared by live preview and offline export. */
export class SampleBank {
  private cache = new Map<string, Float32Array>();
  public get(palette: PaletteName, midi: number): Float32Array {
    const key = `${palette}:${midi}`;
    let s = this.cache.get(key);
    if (!s) {
      s = renderModalSample(palette, 440 * Math.pow(2, (midi - 69) / 12));
      this.cache.set(key, s);
    }
    return s;
  }
  public size(): number {
    return this.cache.size;
  }
}
