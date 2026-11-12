import { describe, it, expect } from "vitest";
import { CLASSIC_3_TOWERS_PRESET } from "@asmr/schema";
import {
  Scale,
  midiToFreq,
  renderModalSample,
  AudioDirector
} from "../src/index.js";

describe("@asmr/audio-core", () => {
  it("computes musical scale frequencies and chord tones accurately", () => {
    const scale = new Scale("C4", "pentatonic_minor", 3);
    expect(scale.notes.length).toBe(16);
    expect(midiToFreq(scale.root)).toBeCloseTo(261.63, 1);
    const triad = scale.chord("I");
    expect(triad).toHaveLength(4);
    expect(triad[1]).toBeGreaterThan(triad[0]);
    expect(triad[2]).toBeGreaterThan(triad[1]);

    const hirajoshi = new Scale("D4", "hirajoshi", 2);
    expect(hirajoshi.notes.length).toBe(11);
    const wholeTone = new Scale("C4", "whole_tone", 2);
    expect(wholeTone.notes.length).toBe(13);
  });

  it("synthesizes finite, normalized modal PCM across all palettes", () => {
    const palettes = [
      "kalimba_glow",
      "glass_bell",
      "marimba_wood",
      "thocky_keys",
      "water_drop",
      "synth_pluck",
      "music_box",
      "crystal_bowl",
      "cosmic_laser"
    ] as const;

    for (const p of palettes) {
      const buf = renderModalSample(p, 440, 48000);
      expect(buf.length).toBeGreaterThan(4800);
      let maxAbs = 0;
      for (let i = 0; i < buf.length; i++) {
        expect(Number.isFinite(buf[i])).toBe(true);
        const a = Math.abs(buf[i]);
        if (a > maxAbs) maxAbs = a;
      }
      expect(maxAbs).toBeGreaterThan(0.5);
      expect(maxAbs).toBeLessThanOrEqual(0.85);
    }
  });

  it("schedules notes with quantization, chord-on-density, and renders peak-limited stereo PCM", () => {
    const soundCfg = structuredClone(CLASSIC_3_TOWERS_PRESET.sound);
    soundCfg.quantizer.mode = "HARMONIC";
    soundCfg.chord_on_density.enabled = true;

    const director = new AudioDirector(soundCfg);
    const hits = [];
    // Create a burst of 8 simultaneous hits to trigger chord-on-density
    for (let i = 0; i < 8; i++) {
      hits.push({
        t: 0.25 + i * 0.002,
        kind: (i === 0 ? "break" : "floor") as "break" | "floor",
        lane: i % 3,
        index: i + 1,
        x: (i % 3) * 0.4 + 0.1,
        y: 0.5,
        vel: 0.9,
        n: 10,
        shift: 0
      });
    }

    const scheduled = director.scheduleNotes(hits, 1.5, CLASSIC_3_TOWERS_PRESET.arc.tension_curve);
    expect(scheduled.length).toBeGreaterThan(0);

    const { leftChannel: left, rightChannel: right } = director.renderOfflinePCM(
      hits,
      1.5,
      48000,
      CLASSIC_3_TOWERS_PRESET.arc
    );
    expect(left.length).toBe(48000 * 1.5);
    expect(right.length).toBe(48000 * 1.5);

    // Check limiter ceiling (-1 dBFS ~= 0.891)
    let peakL = 0;
    let peakR = 0;
    for (let i = 0; i < left.length; i++) {
      expect(Number.isFinite(left[i])).toBe(true);
      expect(Number.isFinite(right[i])).toBe(true);
      if (Math.abs(left[i]) > peakL) peakL = Math.abs(left[i]);
      if (Math.abs(right[i]) > peakR) peakR = Math.abs(right[i]);
    }
    expect(peakL).toBeGreaterThan(0.05);
    expect(peakL).toBeLessThanOrEqual(0.90);
    expect(peakR).toBeLessThanOrEqual(0.90);
  });
});
