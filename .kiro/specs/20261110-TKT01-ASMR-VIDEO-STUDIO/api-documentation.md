# Module API & Contract Documentation
**Ticket:** `20261110-TKT01-ASMR-VIDEO-STUDIO`  
**Feature:** Procedural Physics & Algorithm ASMR Video Studio  
**Date:** 2026-11-10  
**Version:** 2.0  
**Status:** `APPROVED` (`process = Yes`)  

---

## 1. SimCore API (`packages/sim-core`)

```typescript
export interface SimStateSnapshot {
  frame: number;
  timeSec: number;
  virtualBallCount: number;
  physicalBallCount: number;
  balls: Float32Array; // Interleaved: [x, y, vx, vy, radius, r, g, b, alpha, laneIdx]
  floors: FloorState[];
  scores: Record<string, number>;
  stalemateTimer: number;
  hash: number; // 32-bit FNV-1a
}

export interface AudioEvent {
  t: number;          // Waktu deterministik (frame * dt)
  voice: string;      // Nama palette ("kalimba_glow", "glass_bell", dll.)
  note: number;       // MIDI Note number (0 - 127)
  vel: number;        // Velocity ternormalisasi (0.0 - 1.0)
  x: number;          // Posisi X ternormalisasi (0.0 - 1.0) untuk stereo pan
  y: number;          // Posisi Y ternormalisasi (0.0 - 1.0) untuk cutoff filter
  lane: string;       // Identitas lane/sumber
}

export interface ISimCore {
  init(config: ProjectConfig): Promise<void>;
  step(): SimStateSnapshot;
  getHitLog(): AudioEvent[];
  reset(seed?: number): void;
}
```

---

## 2. Audio Core API (`packages/audio-core`)

```typescript
export interface IAudioDirector {
  init(config: SoundConfig): Promise<void>;
  processHitLog(rawHits: RawHitEvent[]): AudioEvent[];
  renderOffline(events: AudioEvent[], durationSec: number): Promise<AudioBuffer>;
  playLiveEvent(event: AudioEvent): void;
  setTension(tension: number): void;
}
```

---

## 3. Render Core API (`packages/render-core`)

```typescript
export interface IStageRenderer {
  init(canvas: HTMLCanvasElement, config: ProjectConfig): Promise<void>;
  draw(state: SimStateSnapshot, tension: number): void;
  resize(width: number, height: number): void;
  captureFrame(): Promise<ImageBitmap>;
  destroy(): void;
}
```

---

## 4. Exporter API (`apps/studio/src/exporter`)

```typescript
export interface ExportProgress {
  phase: "SIMULATING_AUDIO" | "RENDERING_AUDIO" | "RENDERING_VIDEO" | "FINALIZING";
  frame: number;
  totalFrames: number;
  progressPercent: number;
}

export interface IExportDirector {
  exportMp4(
    config: ProjectConfig,
    onProgress: (p: ExportProgress) => void,
    signal?: AbortSignal
  ): Promise<Blob>;
}
```

