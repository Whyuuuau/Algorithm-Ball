import type { ArcConfigSchema, PaletteName, SoundConfig } from "@asmr/schema";
import { evaluateTensionCurve } from "@asmr/schema";
import type { HitEvent } from "@asmr/sim-core";
import type { z } from "zod";
import { SAMPLE_RATE, SampleBank } from "./modal/ModalSynth.js";
import { Scale, midiToFreq } from "./scale.js";

export type ArcConfig = z.infer<typeof ArcConfigSchema>;

export interface NoteEvent {
  t: number;
  palette: PaletteName;
  midi: number;
  vel: number;
  x: number;
  y: number;
  lane: number;
}

export interface OfflineAudioResult {
  sampleRate: number;
  channels: 2;
  length: number;
  durationSec: number;
  leftChannel: Float32Array<ArrayBuffer>;
  rightChannel: Float32Array<ArrayBuffer>;
  peakDb: number;
  noteCount: number;
}

const sharedBank = new SampleBank();

export class AudioDirector {
  public readonly config: SoundConfig;
  public readonly scale: Scale;
  private readonly bank: SampleBank = sharedBank;
  private lastLaneTime: number[] = [-1e9, -1e9, -1e9, -1e9, -1e9, -1e9, -1e9, -1e9];

  // Browser live WebAudio state
  private liveCtx: AudioContext | null = null;
  private liveBufs = new Map<string, AudioBuffer>();
  private activeVoices = 0;

  constructor(config: SoundConfig) {
    this.config = config;
    this.scale = new Scale(config.scale.root, config.scale.mode, config.scale.octaves);
    // Warm up scale notes for active palette
    for (const m of this.scale.notes) {
      this.bank.get(config.palette, m);
    }
  }

  public resetLiveGates(): void {
    this.lastLaneTime.fill(-1e9);
  }

  /** Map a single HitEvent to a raw MIDI pitch before scale/chord quantisation. */
  private pickRawMidi(ev: HitEvent, tension: number): number {
    const cfg = this.config;
    const notes = this.scale.notes;
    const span = notes.length;
    let deg = 0;
    if (cfg.note_mapping === "x_position") {
      deg = Math.floor(Math.max(0, Math.min(0.999, ev.x)) * span);
    } else if (cfg.note_mapping === "lane_floor") {
      deg = (ev.lane * 3 + ev.index) % span;
    } else {
      const h = Math.imul((ev.index * 2654435761) ^ Math.round(ev.x * 997), 1597334677) >>> 0;
      deg = h % span;
    }
    const base = notes[Math.max(0, Math.min(span - 1, deg))];
    const floorEsc = Math.min(18, (ev.index - 1) * cfg.escalation.pitch_semitones_per_floor);
    const tensEsc = tension * cfg.escalation.tension_semitones;
    const breakBoost = ev.kind === "break" || ev.kind === "ring_break" || ev.kind === "exit" ? 7 : 0;
    return Math.max(36, Math.min(96, Math.round(base + floorEsc + tensEsc + breakBoost + ev.shift)));
  }

  private quantizeMidi(rawMidi: number, t: number): number {
    const q = this.config.quantizer;
    if (q.mode === "FREE") return rawMidi;
    const barSec = (60 / Math.max(40, q.bpm)) * 4;
    const prog = q.progression.length > 0 ? q.progression : ["I"];
    const chordIdx = Math.max(0, Math.floor((Number.isFinite(t) ? t : 0) / (barSec * 2))) % prog.length;
    const chordTones = this.scale.chord(prog[chordIdx] ?? "I");
    if (rawMidi % 3 === 0) return Math.max(36, Math.min(96, this.scale.nearestFrom(chordTones, rawMidi)));
    return Math.max(36, Math.min(96, this.scale.nearest(rawMidi)));
  }

  /**
   * Convert raw simulation HitEvents into musical NoteEvents
   * (applies cooldown gate, grid quantizer, harmonic progression, and density-to-chord).
   */
  public scheduleNotes(
    rawHits: readonly HitEvent[],
    durationSec: number = 60,
    tensionCurve?: ReadonlyArray<readonly [number, number]>
  ): NoteEvent[] {
    const cfg = this.config;
    const cooldownSec = cfg.cooldown_ms / 1000;
    const lastByLane = new Float64Array(16).fill(-1e9);
    const filtered: HitEvent[] = [];

    const gridSec = 60 / Math.max(40, cfg.quantizer.bpm) / 4; // 1/16 note
    const snapSec = cfg.quantizer.snap_ms / 1000;

    for (const h of rawHits) {
      if (h.t < 0 || h.t > durationSec) continue;
      const l = h.lane & 15;
      const isBreak = h.kind === "break" || h.kind === "ring_break" || h.kind === "exit";
      if (!isBreak && h.t - lastByLane[l] < cooldownSec) continue;

      let t = h.t;
      if (cfg.quantizer.mode === "GRID" && !isBreak) {
        const nearest = Math.round(t / gridSec) * gridSec;
        const diff = nearest - t;
        // Golden rule: sound may delay <= snap_ms or advance <= 8ms
        if (diff >= -0.008 && diff <= snapSec) {
          t = Math.max(0, nearest);
        } else {
          continue; // thinned out by rhythmic grid
        }
      }

      lastByLane[l] = t;
      filtered.push(t === h.t ? h : { ...h, t });
    }

    const out: NoteEvent[] = [];
    const winSec = cfg.chord_on_density.window_ms / 1000;
    const minHits = cfg.chord_on_density.min_hits;
    let i = 0;

    while (i < filtered.length) {
      const first = filtered[i];
      const progress = durationSec > 0 ? first.t / durationSec : 0;
      const tension = tensionCurve ? evaluateTensionCurve(tensionCurve, progress) : 0.5;

      // Count hits in sliding window (accounting for merged raw impacts `n`)
      let j = i;
      let hitSum = 0;
      let velSum = 0;
      while (j < filtered.length && filtered[j].t - first.t <= winSec) {
        hitSum += Math.max(1, filtered[j].n);
        velSum += filtered[j].vel;
        j++;
      }

      if (cfg.chord_on_density.enabled && (j - i >= minHits || hitSum >= minHits * 2)) {
        const root = this.quantizeMidi(this.pickRawMidi(first, tension), first.t);
        const v = Math.min(1, Math.pow(velSum, 0.6) / 2.2) * cfg.volume;
        const triad = [root, this.scale.nearest(root + 4), this.scale.nearest(root + 7)];
        for (let k = 0; k < 3; k++) {
          out.push({
            t: first.t + k * 0.009,
            palette: cfg.palette,
            midi: Math.max(36, Math.min(96, triad[k])),
            vel: v * (1 - k * 0.14),
            x: first.x,
            y: first.y,
            lane: first.lane
          });
        }
        i = j;
      } else {
        const midi = this.quantizeMidi(this.pickRawMidi(first, tension), first.t);
        const v = Math.min(1, Math.pow(Math.max(0.1, first.vel), 0.6)) * cfg.volume;
        out.push({
          t: first.t,
          palette: cfg.palette,
          midi,
          vel: v,
          x: first.x,
          y: first.y,
          lane: first.lane
        });
        if (first.kind === "break" || first.kind === "ring_break") {
          // Octave shimmer on break
          out.push({
            t: first.t + 0.012,
            palette: cfg.palette,
            midi: Math.min(96, midi + 7),
            vel: v * 0.75,
            x: first.x,
            y: first.y,
            lane: first.lane
          });
        }
        i++;
      }
    }

    return out;
  }

  /**
   * Full offline render: modal voices + spatial pan + Y lowpass + tension bass drone
   * + climax riser + Schroeder stereo reverb + lookahead limiter + loop-outro crossfade.
   */
  public renderOfflinePCM(
    rawHits: readonly HitEvent[],
    durationSec: number,
    sampleRate: number = SAMPLE_RATE,
    arc?: ArcConfig
  ): OfflineAudioResult {
    const cfg = this.config;
    const totalSamples = Math.max(1, Math.ceil(durationSec * sampleRate));
    const left = new Float32Array(new ArrayBuffer(totalSamples * 4));
    const right = new Float32Array(new ArrayBuffer(totalSamples * 4));

    const notes = this.scheduleNotes(rawHits, durationSec, arc?.tension_curve);

    // Ensure frame-0 hook chime if no hit is already at t < 0.05s
    if (notes.length === 0 || notes[0].t > 0.05) {
      notes.unshift({
        t: 0,
        palette: cfg.palette,
        midi: this.scale.root + 12,
        vel: 0.65 * cfg.volume,
        x: 0.5,
        y: 0.3,
        lane: 0
      });
    }

    // Voice stealing / polyphony window tracking
    const poly = Math.max(4, cfg.polyphony);
    const activeEnd = new Float64Array(poly).fill(-1);

    for (const ev of notes) {
      const startSample = Math.round(ev.t * sampleRate);
      if (startSample < 0 || startSample >= totalSamples) continue;

      const pcm = this.bank.get(ev.palette, ev.midi);
      const endSec = ev.t + pcm.length / sampleRate;

      // Find free voice slot or steal the voice ending soonest
      let slot = 0;
      let minEnd = activeEnd[0];
      for (let v = 0; v < poly; v++) {
        if (activeEnd[v] <= ev.t) {
          slot = v;
          minEnd = -1;
          break;
        }
        if (activeEnd[v] < minEnd) {
          minEnd = activeEnd[v];
          slot = v;
        }
      }
      activeEnd[slot] = endSec;

      // Constant-power stereo pan
      const panX = cfg.spatial.pan ? Math.max(0, Math.min(1, ev.x)) : 0.5;
      const theta = panX * (Math.PI * 0.5);
      const gainL = Math.cos(theta) * ev.vel;
      const gainR = Math.sin(theta) * ev.vel;

      // Y-position 1-pole low-pass filter (top y=0 bright, bottom y=1 warm)
      const copyLen = Math.min(pcm.length, totalSamples - startSample);
      if (cfg.spatial.y_filter) {
        const yClamped = Math.max(0, Math.min(1, ev.y));
        const cutoff =
          cfg.spatial.lowpass_max_hz * Math.pow(cfg.spatial.lowpass_min_hz / cfg.spatial.lowpass_max_hz, yClamped);
        const rc = 1 / (2 * Math.PI * Math.max(200, cutoff));
        const dt = 1 / sampleRate;
        const alpha = dt / (rc + dt);
        let z = 0;
        for (let s = 0; s < copyLen; s++) {
          z += alpha * (pcm[s] - z);
          left[startSample + s] += z * gainL;
          right[startSample + s] += z * gainR;
        }
      } else {
        for (let s = 0; s < copyLen; s++) {
          const val = pcm[s];
          left[startSample + s] += val * gainL;
          right[startSample + s] += val * gainR;
        }
      }
    }

    // Sub-bass drone following Tension Curve
    if (cfg.escalation.drone && arc?.tension_curve) {
      const droneFreq = midiToFreq(Math.max(28, this.scale.root - 24));
      const maxAmp = Math.pow(10, cfg.escalation.drone_gain_db / 20) * cfg.volume;
      let phase = 0;
      const dPhase = (2 * Math.PI * droneFreq) / sampleRate;
      for (let i = 0; i < totalSamples; i++) {
        const tension = evaluateTensionCurve(arc.tension_curve, i / totalSamples);
        const amp = maxAmp * Math.max(0, (tension - 0.15) / 0.85);
        const v = Math.sin(phase) * amp * 0.5;
        phase += dPhase;
        left[i] += v;
        right[i] += v;
      }
    }

    // Stereo Schroeder comb reverb
    if (cfg.reverb.enabled && cfg.reverb.mix > 0.01) {
      this.applyReverb(left, right, sampleRate, cfg.reverb.mix, cfg.reverb.size);
    }

    // Loop-outro audio crossfade into the opening 0.6s
    const outroSec = arc?.loop_outro_sec ?? 0;
    const outroSamples = Math.min(Math.floor(totalSamples * 0.25), Math.round(outroSec * sampleRate));
    if (outroSamples > 64) {
      const start = totalSamples - outroSamples;
      for (let i = 0; i < outroSamples; i++) {
        const u = i / outroSamples;
        const gOut = Math.cos(u * Math.PI * 0.5);
        const gIn = Math.sin(u * Math.PI * 0.5);
        left[start + i] = left[start + i] * gOut + left[i] * gIn;
        right[start + i] = right[start + i] * gOut + right[i] * gIn;
      }
    }

    // Lookahead peak limiter (-1 dBFS default)
    const peakLinear = this.applyLookaheadLimiter(
      left,
      right,
      sampleRate,
      cfg.limiter.lookahead_ms,
      cfg.limiter.ceiling_db
    );

    return {
      sampleRate,
      channels: 2,
      length: totalSamples,
      durationSec,
      leftChannel: left,
      rightChannel: right,
      peakDb: peakLinear > 1e-9 ? 20 * Math.log10(peakLinear) : -100,
      noteCount: notes.length
    };
  }

  private applyReverb(
    left: Float32Array,
    right: Float32Array,
    sr: number,
    mix: number,
    size: number
  ): void {
    const delays = [
      Math.max(64, Math.round(0.0297 * size * sr)),
      Math.max(64, Math.round(0.0371 * size * sr)),
      Math.max(64, Math.round(0.0411 * size * sr)),
      Math.max(64, Math.round(0.0437 * size * sr))
    ];
    const fb = 0.68 * Math.min(0.95, 0.6 + 0.35 * size);
    const bufsL = delays.map((d) => new Float32Array(d));
    const bufsR = delays.map((d) => new Float32Array(d + 23));
    const idxL = [0, 0, 0, 0];
    const idxR = [0, 0, 0, 0];
    const wet = Math.min(0.6, mix * 0.45);
    const dry = 1 - wet * 0.4;

    for (let i = 0; i < left.length; i++) {
      const inL = left[i];
      const inR = right[i];
      let sumL = 0;
      let sumR = 0;
      for (let k = 0; k < 4; k++) {
        const bL = bufsL[k];
        const pL = idxL[k];
        const yL = bL[pL];
        bL[pL] = inL + yL * fb;
        idxL[k] = pL + 1 === bL.length ? 0 : pL + 1;
        sumL += yL;

        const bR = bufsR[k];
        const pR = idxR[k];
        const yR = bR[pR];
        bR[pR] = inR + yR * fb;
        idxR[k] = pR + 1 === bR.length ? 0 : pR + 1;
        sumR += yR;
      }
      left[i] = inL * dry + sumL * 0.25 * wet;
      right[i] = inR * dry + sumR * 0.25 * wet;
    }
  }

  private applyLookaheadLimiter(
    left: Float32Array,
    right: Float32Array,
    sr: number,
    lookaheadMs: number,
    ceilingDb: number
  ): number {
    const ceiling = Math.pow(10, ceilingDb / 20);
    const look = Math.max(1, Math.round((lookaheadMs / 1000) * sr));
    const releaseCoeff = Math.exp(-1 / (0.06 * sr));
    let env = 0;
    let maxOut = 0;

    // Envelope follower with lookahead window
    const n = left.length;
    for (let i = 0; i < n; i++) {
      const lookIdx = Math.min(n - 1, i + look);
      const pk = Math.max(Math.abs(left[lookIdx]), Math.abs(right[lookIdx]), Math.abs(left[i]), Math.abs(right[i]));
      env = pk > env ? pk : env * releaseCoeff + pk * (1 - releaseCoeff);
      const gain = env > ceiling ? ceiling / env : 1;
      const l = (left[i] *= gain);
      const r = (right[i] *= gain);
      const a = Math.max(Math.abs(l), Math.abs(r));
      if (a > maxOut) maxOut = a;
    }

    // Hard safety clamp at ceiling
    if (maxOut > ceiling) {
      const scale = ceiling / maxOut;
      for (let i = 0; i < n; i++) {
        left[i] *= scale;
        right[i] *= scale;
      }
      maxOut = ceiling;
    }
    return maxOut;
  }

  /** Convert offline PCM into a browser AudioBuffer for WebCodecs / Mediabunny. */
  public async renderAudioBuffer(
    rawHits: readonly HitEvent[],
    durationSec: number,
    arc?: ArcConfig,
    ctx?: BaseAudioContext
  ): Promise<AudioBuffer> {
    const pcm = this.renderOfflinePCM(rawHits, durationSec, SAMPLE_RATE, arc);
    const audioContext =
      ctx || (typeof AudioContext !== "undefined" ? new AudioContext({ sampleRate: SAMPLE_RATE }) : null);
    if (!audioContext) {
      throw new Error("AudioContext is not available in current environment");
    }
    const audioBuffer = audioContext.createBuffer(2, pcm.length, SAMPLE_RATE);
    audioBuffer.copyToChannel(pcm.leftChannel, 0);
    audioBuffer.copyToChannel(pcm.rightChannel, 1);
    return audioBuffer;
  }

  private ensureLiveCtx(): AudioContext | null {
    if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
    if (!this.liveCtx) {
      this.liveCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
    if (this.liveCtx.state === "suspended") {
      void this.liveCtx.resume();
    }
    return this.liveCtx;
  }

  /** Play new HitEvents in real-time preview using the same scale/quantizer/palette. */
  public playLiveHits(hits: readonly HitEvent[], tension: number = 0.5): number | null {
    const ctx = this.ensureLiveCtx();
    if (!ctx || hits.length === 0) return null;

    const cfg = this.config;
    const cooldownSec = cfg.cooldown_ms / 1000;
    let lastMidi: number | null = null;

    for (const h of hits) {
      const l = h.lane & 7;
      const isBreak = h.kind === "break" || h.kind === "ring_break" || h.kind === "exit";
      if (!isBreak && h.t - this.lastLaneTime[l] < cooldownSec) continue;
      this.lastLaneTime[l] = h.t;

      const midi = this.quantizeMidi(this.pickRawMidi(h, tension), h.t);
      lastMidi = midi;
      const vel = Math.min(1, Math.pow(Math.max(0.12, h.vel), 0.6)) * cfg.volume;
      this.triggerLiveVoice(ctx, cfg.palette, midi, vel, h.x, h.y);
      if (isBreak) {
        this.triggerLiveVoice(ctx, cfg.palette, Math.min(96, midi + 7), vel * 0.75, h.x, h.y, 0.015);
      }
    }
    return lastMidi;
  }

  /** Audition a single note immediately (e.g. when changing palette or scale in UI). */
  public auditionNote(midi?: number): void {
    const ctx = this.ensureLiveCtx();
    if (!ctx) return;
    const m = midi ?? this.scale.root + 12;
    this.triggerLiveVoice(ctx, this.config.palette, m, 0.75 * this.config.volume, 0.5, 0.3);
  }

  private triggerLiveVoice(
    ctx: AudioContext,
    palette: PaletteName,
    midi: number,
    vel: number,
    x: number,
    y: number,
    delaySec: number = 0
  ): void {
    if (this.activeVoices >= this.config.polyphony) return;
    const key = `${palette}:${midi}`;
    let buffer = this.liveBufs.get(key);
    if (!buffer) {
      const pcm = this.bank.get(palette, midi);
      buffer = ctx.createBuffer(1, pcm.length, SAMPLE_RATE);
      buffer.copyToChannel(new Float32Array(pcm), 0);
      this.liveBufs.set(key, buffer);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.value = Math.max(0.05, Math.min(1, vel * 0.7));

    const pan = ctx.createStereoPanner();
    pan.pan.value = this.config.spatial.pan ? Math.max(-1, Math.min(1, x * 2 - 1)) : 0;

    if (this.config.spatial.y_filter) {
      const flt = ctx.createBiquadFilter();
      flt.type = "lowpass";
      const yc = Math.max(0, Math.min(1, y));
      flt.frequency.value =
        this.config.spatial.lowpass_max_hz *
        Math.pow(this.config.spatial.lowpass_min_hz / this.config.spatial.lowpass_max_hz, yc);
      src.connect(flt);
      flt.connect(gain);
    } else {
      src.connect(gain);
    }
    gain.connect(pan);
    pan.connect(ctx.destination);

    this.activeVoices++;
    src.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    };
    src.start(ctx.currentTime + delaySec);
  }
}
