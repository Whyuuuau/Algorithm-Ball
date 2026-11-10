import { PaletteName } from "@asmr/schema";

export interface ModalRecipe {
  ratios: number[];
  decays: number[];
  amplitudes: number[];
}

export const MODAL_RECIPES: Record<PaletteName, ModalRecipe> = {
  kalimba_glow: {
    ratios: [1.0, 6.27, 17.55],
    decays: [1.0, 0.4, 0.1],
    amplitudes: [1.0, 0.35, 0.12]
  },
  glass_bell: {
    ratios: [1.0, 2.76, 5.4, 8.93],
    decays: [1.8, 1.2, 0.7, 0.4],
    amplitudes: [1.0, 0.6, 0.4, 0.2]
  },
  marimba_wood: {
    ratios: [1.0, 4.0, 10.0],
    decays: [0.35, 0.2, 0.08],
    amplitudes: [1.0, 0.5, 0.25]
  },
  thocky_keys: {
    ratios: [1.0, 1.8, 3.2],
    decays: [0.08, 0.05, 0.03],
    amplitudes: [1.0, 0.4, 0.2]
  },
  water_drop: {
    ratios: [1.0, 2.0],
    decays: [0.12, 0.04],
    amplitudes: [1.0, 0.3]
  }
};

/**
 * MIDI note number to frequency in Hertz
 */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Procedural waveform generation for a single modal note.
 * Returns Float32Array containing PCM audio samples at sampleRate.
 */
export function renderModalSample(
  palette: PaletteName,
  freq: number,
  sampleRate: number = 48000
): Float32Array {
  const recipe = MODAL_RECIPES[palette] || MODAL_RECIPES.kalimba_glow;
  const maxDecay = Math.max(...recipe.decays);
  const durationSec = Math.min(2.0, maxDecay * 1.5);
  const length = Math.ceil(durationSec * sampleRate);
  const buffer = new Float32Array(length);

  const numModes = recipe.ratios.length;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;

    for (let m = 0; m < numModes; m++) {
      const modeFreq = freq * recipe.ratios[m];
      const decay = recipe.decays[m];
      const amp = recipe.amplitudes[m];

      if (palette === "water_drop") {
        // Upward pitch sweep
        const sweepFreq = modeFreq * (1 + 0.8 * Math.exp(-t * 25));
        sample += amp * Math.sin(2 * Math.PI * sweepFreq * t) * Math.exp(-t / decay);
      } else if (palette === "thocky_keys") {
        // Noise transient + low sine thump
        const noise = (Math.random() * 2 - 1) * Math.exp(-t / 0.02);
        const sine = Math.sin(2 * Math.PI * 140 * t) * Math.exp(-t / 0.06);
        sample += (noise * 0.4 + sine * 0.6) * Math.exp(-t / decay);
      } else {
        sample += amp * Math.sin(2 * Math.PI * modeFreq * t) * Math.exp(-t / decay);
      }
    }

    buffer[i] = sample;
  }

  // Normalize peak
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const abs = Math.abs(buffer[i]);
    if (abs > peak) peak = abs;
  }

  if (peak > 0) {
    const norm = 0.8 / peak;
    for (let i = 0; i < length; i++) {
      buffer[i] *= norm;
    }
  }

  return buffer;
}
