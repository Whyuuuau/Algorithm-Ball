import { describe, it, expect } from "vitest";
import { CLASSIC_3_TOWERS_PRESET } from "@asmr/schema";
import { AudioDirector } from "../src/AudioDirector.js";
import { renderModalSample } from "../src/modal/ModalSynth.js";
import { AudioEvent } from "@asmr/sim-core";

describe("AudioDirector & Modal Synthesis Verification", () => {
  it("should generate clean modal PCM without NaN or Infinity", () => {
    const pcm = renderModalSample("kalimba_glow", 440, 48000);
    expect(pcm.length).toBeGreaterThan(0);

    for (let i = 0; i < pcm.length; i++) {
      expect(Number.isFinite(pcm[i])).toBe(true);
      expect(Math.abs(pcm[i])).toBeLessThanOrEqual(1.0);
    }
  });

  it("should collapse burst hits into a clean chord with ChordAggregator", () => {
    const director = new AudioDirector(CLASSIC_3_TOWERS_PRESET.sound);

    // 10 hits all within 10 ms (dense cluster)
    const burstHits: AudioEvent[] = [];
    for (let i = 0; i < 10; i++) {
      burstHits.push({
        t: 1.000 + i * 0.001,
        voice: "kalimba_glow",
        note: 60,
        vel: 0.8,
        x: 0.5,
        y: 0.5,
        lane: "center"
      });
    }

    const processed = director.chordAggregator.aggregate(burstHits);
    // 10 dense hits should be collapsed into a triad (3 notes: root, +4, +7)
    expect(processed.length).toBe(3);
    expect(processed[0].note).toBe(60);
    expect(processed[1].note).toBe(64);
    expect(processed[2].note).toBe(67);
  });

  it("should enforce -1 dBFS limiter ceiling on offline render", () => {
    const director = new AudioDirector(CLASSIC_3_TOWERS_PRESET.sound);

    // Massive volume overload hits
    const massiveHits: AudioEvent[] = [];
    for (let i = 0; i < 50; i++) {
      massiveHits.push({
        t: 0.1,
        voice: "kalimba_glow",
        note: 60 + (i % 12),
        vel: 1.0,
        x: 0.5,
        y: 0.5,
        lane: "center"
      });
    }

    const result = director.renderOfflinePCM(massiveHits, 1.0, 48000);
    const ceilingLinear = Math.pow(10, -1 / 20); // ~0.89125

    let maxL = 0;
    let maxR = 0;
    for (let i = 0; i < result.length; i++) {
      if (Math.abs(result.leftChannel[i]) > maxL) maxL = Math.abs(result.leftChannel[i]);
      if (Math.abs(result.rightChannel[i]) > maxR) maxR = Math.abs(result.rightChannel[i]);
    }

    expect(maxL).toBeLessThanOrEqual(ceilingLinear + 0.0001);
    expect(maxR).toBeLessThanOrEqual(ceilingLinear + 0.0001);
  });
});
