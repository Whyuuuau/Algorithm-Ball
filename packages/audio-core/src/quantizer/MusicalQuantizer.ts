export interface ScaleConfig {
  root: string;
  mode: "pentatonic_major" | "pentatonic_minor" | "dorian" | "lydian";
  octaves: number;
}

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const SCALE_INTERVALS: Record<string, number[]> = {
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11]
};

export class MusicalQuantizer {
  public readonly rootMidi: number;
  public readonly scaleNotes: number[] = [];
  public readonly mode: "FREE" | "HARMONIC" | "GRID";
  public readonly bpm: number;
  public readonly snapMs: number;

  constructor(
    scale: ScaleConfig,
    quantizerMode: "FREE" | "HARMONIC" | "GRID" = "HARMONIC",
    bpm: number = 120,
    snapMs: number = 30
  ) {
    this.mode = quantizerMode;
    this.bpm = bpm;
    this.snapMs = snapMs;

    this.rootMidi = this.parseNoteNameToMidi(scale.root);
    const intervals = SCALE_INTERVALS[scale.mode] || SCALE_INTERVALS.pentatonic_major;

    for (let oct = 0; oct < scale.octaves; oct++) {
      for (const interval of intervals) {
        this.scaleNotes.push(this.rootMidi + oct * 12 + interval);
      }
    }
  }

  public parseNoteNameToMidi(name: string): number {
    const match = name.match(/^([A-G]#?)(-?\d+)$/i);
    if (!match) return 60; // Default C4
    const noteName = match[1].toUpperCase();
    const oct = parseInt(match[2], 10);
    const semitone = NOTE_NAMES.indexOf(noteName);
    return (oct + 1) * 12 + (semitone !== -1 ? semitone : 0);
  }

  /**
   * Quantize pitch to nearest scale note
   */
  public quantizePitch(rawNote: number): number {
    if (this.mode === "FREE" || this.scaleNotes.length === 0) {
      return rawNote;
    }

    let closest = this.scaleNotes[0];
    let minDiff = Math.abs(rawNote - closest);

    for (const note of this.scaleNotes) {
      const diff = Math.abs(rawNote - note);
      if (diff < minDiff) {
        minDiff = diff;
        closest = note;
      }
    }

    return closest;
  }

  /**
   * Quantize time to nearest grid division
   */
  public quantizeTime(rawTimeSec: number): number {
    if (this.mode !== "GRID") return rawTimeSec;

    const beatDuration = 60 / this.bpm;
    const gridDuration = beatDuration / 4; // 1/16th note grid
    const nearestGrid = Math.round(rawTimeSec / gridDuration) * gridDuration;

    const diffSec = Math.abs(rawTimeSec - nearestGrid);
    if (diffSec <= this.snapMs / 1000) {
      return nearestGrid;
    }

    return rawTimeSec;
  }
}
