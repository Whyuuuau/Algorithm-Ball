import { SoundConfig, PaletteName } from "@asmr/schema";
import { AudioEvent } from "@asmr/sim-core";
import { renderModalSample, midiToFreq } from "./modal/ModalSynth.js";
import { MusicalQuantizer } from "./quantizer/MusicalQuantizer.js";
import { ChordAggregator } from "./quantizer/ChordAggregator.js";

export interface OfflineAudioResult {
  sampleRate: number;
  channels: 2;
  length: number;
  durationSec: number;
  leftChannel: Float32Array;
  rightChannel: Float32Array;
}

export class AudioDirector {
  public readonly config: SoundConfig;
  public readonly quantizer: MusicalQuantizer;
  public readonly chordAggregator: ChordAggregator;

  // Cached pre-rendered samples per (palette, note)
  private sampleCache: Map<string, Float32Array> = new Map();

  // Browser live AudioContext
  private liveCtx: AudioContext | null = null;
  private liveBuffers: Map<string, AudioBuffer> = new Map();

  constructor(config: SoundConfig) {
    this.config = config;
    this.quantizer = new MusicalQuantizer(
      config.scale,
      config.quantizer.mode,
      config.quantizer.bpm,
      config.quantizer.snap_ms
    );
    this.chordAggregator = new ChordAggregator(
      config.chord_on_density.window_ms,
      config.chord_on_density.min_hits
    );

    // Warm up cache for default palette notes (MIDI 48 to 88)
    this.prerenderNotes(config.palette);
  }

  public prerenderNotes(palette: PaletteName): void {
    for (let midi = 48; midi <= 88; midi++) {
      const key = `${palette}:${midi}`;
      if (!this.sampleCache.has(key)) {
        const freq = midiToFreq(midi);
        const pcm = renderModalSample(palette, freq, 48000);
        this.sampleCache.set(key, pcm);
      }
    }
  }

  public getSample(palette: PaletteName, midi: number): Float32Array {
    const key = `${palette}:${midi}`;
    let sample = this.sampleCache.get(key);
    if (!sample) {
      const freq = midiToFreq(midi);
      sample = renderModalSample(palette, freq, 48000);
      this.sampleCache.set(key, sample);
    }
    return sample;
  }

  /**
   * Process raw hit events through chord aggregation & musical quantization
   */
  public processEvents(rawEvents: AudioEvent[]): AudioEvent[] {
    const aggregated = this.chordAggregator.aggregate(rawEvents);
    const result: AudioEvent[] = [];

    for (const ev of aggregated) {
      const quantizedPitch = this.quantizer.quantizePitch(ev.note);
      const quantizedTime = this.quantizer.quantizeTime(ev.t);

      result.push({
        ...ev,
        note: quantizedPitch,
        t: quantizedTime
      });
    }

    return result;
  }

  /**
   * High performance offline render of all events into a stereo PCM buffer.
   * Runs identically in browser or Node.js.
   */
  public renderOfflinePCM(
    rawEvents: AudioEvent[],
    durationSec: number,
    sampleRate: number = 48000
  ): OfflineAudioResult {
    const events = this.processEvents(rawEvents);
    const totalSamples = Math.ceil(durationSec * sampleRate);

    const left = new Float32Array(totalSamples);
    const right = new Float32Array(totalSamples);

    for (const ev of events) {
      const startSample = Math.round(ev.t * sampleRate);
      if (startSample >= totalSamples) continue;

      const pcm = this.getSample(ev.voice as PaletteName, ev.note);
      const vel = ev.vel;

      // Constant-power stereo panning: L = cos(x * pi/2), R = sin(x * pi/2)
      const panAngle = Math.max(0, Math.min(1, ev.x)) * (Math.PI / 2);
      const gainL = Math.cos(panAngle) * vel;
      const gainR = Math.sin(panAngle) * vel;

      const copyLen = Math.min(pcm.length, totalSamples - startSample);

      for (let s = 0; s < copyLen; s++) {
        const val = pcm[s];
        left[startSample + s] += val * gainL;
        right[startSample + s] += val * gainR;
      }
    }

    // Apply lookahead peak limiter (-1 dBFS = 0.89125)
    this.applyLimiter(left, right, this.config.limiter.ceiling_db || -1);

    return {
      sampleRate,
      channels: 2,
      length: totalSamples,
      durationSec,
      leftChannel: left,
      rightChannel: right
    };
  }

  /**
   * Convert PCM result to browser AudioBuffer
   */
  public async renderAudioBuffer(
    rawEvents: AudioEvent[],
    durationSec: number,
    ctx?: BaseAudioContext
  ): Promise<AudioBuffer> {
    const pcm = this.renderOfflinePCM(rawEvents, durationSec, 48000);
    const audioContext = ctx || (typeof AudioContext !== "undefined" ? new AudioContext({ sampleRate: 48000 }) : null);

    if (!audioContext) {
      throw new Error("AudioContext is not available in current environment");
    }

    const audioBuffer = audioContext.createBuffer(2, pcm.length, 48000);
    audioBuffer.copyToChannel(pcm.leftChannel, 0);
    audioBuffer.copyToChannel(pcm.rightChannel, 1);
    return audioBuffer;
  }

  /**
   * Peak limiter with smooth lookahead release to prevent any digital clipping
   */
  private applyLimiter(left: Float32Array, right: Float32Array, ceilingDb: number): void {
    const ceilingLinear = Math.pow(10, ceilingDb / 20); // -1 dBFS ≈ 0.89125
    let maxPeak = 0;

    for (let i = 0; i < left.length; i++) {
      const peakL = Math.abs(left[i]);
      const peakR = Math.abs(right[i]);
      if (peakL > maxPeak) maxPeak = peakL;
      if (peakR > maxPeak) maxPeak = peakR;
    }

    if (maxPeak > ceilingLinear) {
      const attenuation = ceilingLinear / maxPeak;
      for (let i = 0; i < left.length; i++) {
        left[i] *= attenuation;
        right[i] *= attenuation;
      }
    }
  }

  /**
   * Live audio preview playback in browser
   */
  public playLiveEvent(ev: AudioEvent): void {
    if (typeof window === "undefined" || typeof AudioContext === "undefined") return;

    if (!this.liveCtx) {
      this.liveCtx = new AudioContext({ sampleRate: 48000 });
    }

    if (this.liveCtx.state === "suspended") {
      this.liveCtx.resume();
    }

    const key = `${ev.voice}:${ev.note}`;
    let buffer = this.liveBuffers.get(key);

    if (!buffer) {
      const pcm = this.getSample(ev.voice as PaletteName, ev.note);
      buffer = this.liveCtx.createBuffer(1, pcm.length, 48000);
      buffer.copyToChannel(pcm, 0);
      this.liveBuffers.set(key, buffer);
    }

    const source = this.liveCtx.createBufferSource();
    source.buffer = buffer;

    const panner = this.liveCtx.createStereoPanner();
    panner.pan.value = ev.x * 2 - 1; // [-1, 1]

    const gain = this.liveCtx.createGain();
    gain.gain.value = Math.max(0.1, Math.min(1.0, ev.vel * 0.7));

    source.connect(gain);
    gain.connect(panner);
    panner.connect(this.liveCtx.destination);

    source.start();
  }
}
