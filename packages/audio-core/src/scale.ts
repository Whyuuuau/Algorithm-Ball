export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const SCALE_INTERVALS: Record<string, number[]> = {
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  hirajoshi: [0, 2, 3, 7, 8],
  insen: [0, 1, 5, 7, 10],
  gypsy_minor: [0, 2, 3, 6, 7, 8, 11],
  whole_tone: [0, 2, 4, 6, 8, 10],
  blues: [0, 3, 5, 6, 7, 10]
};

const ROMAN: Record<string, number> = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 };

export function parseNote(name: string): number {
  const m = name.match(/^([A-Ga-g]#?)(-?\d)$/);
  if (!m) return 60;
  const idx = NOTE_NAMES.indexOf(m[1].toUpperCase());
  return (parseInt(m[2], 10) + 1) * 12 + (idx < 0 ? 0 : idx);
}

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export class Scale {
  public readonly root: number;
  /** ascending midi notes of the scale across `octaves` octaves (+ the closing root) */
  public readonly notes: number[] = [];
  private readonly diatonic: number[];

  constructor(rootName: string, mode: string, octaves: number) {
    this.root = parseNote(rootName);
    const iv = SCALE_INTERVALS[mode] ?? SCALE_INTERVALS.pentatonic_major;
    for (let o = 0; o < octaves; o++) for (const i of iv) this.notes.push(this.root + o * 12 + i);
    this.notes.push(this.root + octaves * 12);
    this.diatonic = iv.length === 7 ? iv : mode.includes("minor") ? SCALE_INTERVALS.minor : SCALE_INTERVALS.major;
  }

  public nearest(midi: number): number {
    let best = this.notes[0];
    let bd = Math.abs(midi - best);
    for (let i = 1; i < this.notes.length; i++) {
      const d = Math.abs(midi - this.notes[i]);
      if (d < bd) {
        bd = d;
        best = this.notes[i];
      }
    }
    return best;
  }

  /** Chord tones (root, third, fifth, octave) for a roman numeral, in the lower octave range. */
  public chord(numeral: string): number[] {
    const key = numeral.toLowerCase().replace(/[^iv]/g, "");
    const deg = ROMAN[key] ?? 0;
    const d = this.diatonic;
    const at = (k: number): number => {
      const oct = Math.floor(k / 7);
      return this.root + oct * 12 + d[((k % 7) + 7) % 7];
    };
    return [at(deg), at(deg + 2), at(deg + 4), at(deg + 7)];
  }

  public nearestFrom(pool: number[], midi: number): number {
    let best = pool[0];
    let bd = Infinity;
    for (const p of pool) {
      for (let o = -2; o <= 2; o++) {
        const c = p + o * 12;
        const dd = Math.abs(c - midi);
        if (dd < bd) {
          bd = dd;
          best = c;
        }
      }
    }
    return best;
  }
}

