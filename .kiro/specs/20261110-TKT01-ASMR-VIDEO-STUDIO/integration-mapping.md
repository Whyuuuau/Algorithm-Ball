# Integration Mapping Document
**Ticket:** `20261110-TKT01-ASMR-VIDEO-STUDIO`  
**Feature:** Procedural Physics & Algorithm ASMR Video Studio  
**Date:** 2026-11-10  
**Version:** 2.0  
**Status:** `APPROVED` (`process = Yes`)  

---

## 1. Modul Integrasi Antar-Subsistem

```mermaid
flowchart LR
    subgraph S1 ["1. State & Config"]
        Schema["@asmr/schema<br/>(Zod Validation)"]
        Presets["Default Presets<br/>(Tower/Maze)"]
    end

    subgraph S2 ["2. Headless Simulation"]
        Sim["@asmr/sim-core<br/>(PRNG + Rapier2D + Governor)"]
    end

    subgraph S3 ["3. Audio Synthesis"]
        Audio["@asmr/audio-core<br/>(Modal + Quantizer + Limiter)"]
    end

    subgraph S4 ["4. Graphic Rendering"]
        Render["@asmr/render-core<br/>(PixiJS v8 + Bloom + Trail)"]
    end

    subgraph S5 ["5. Export Pipeline"]
        WebCodecs["WebCodecs H.264 + AAC"]
        Mediabunny["Mediabunny MP4 Muxer"]
    end

    subgraph S6 ["6. User Interface"]
        Studio["@asmr/studio<br/>(React 19 + Zustand)"]
    end

    Schema --> Presets
    Presets --> Studio
    Studio -->|ProjectConfig| Sim
    Sim -->|HitLog Events| Audio
    Sim -->|State Float32Array| Render
    Audio -->|PCM AudioBuffer| WebCodecs
    Render -->|Canvas VideoFrame| WebCodecs
    WebCodecs --> Mediabunny
    Mediabunny --> Studio
```

---

## 2. Pemetaan Antarmuka Integrasi

| Dari Modul | Ke Modul | Format Data Transfer | Mekanisme Komunikasi |
|---|---|---|---|
| `Studio UI` | `SimCore` | `ProjectConfig` object | Direct instance / Web Worker `postMessage` |
| `SimCore` | `RenderCore` | `SimStateSnapshot` (`Float32Array`) | Zero-copy Transferable ArrayBuffer |
| `SimCore` | `AudioCore` | `AudioEvent[]` (`HitLog`) | Structured Array pass |
| `AudioCore` | `Export Pipeline` | `AudioBuffer` (PCM Stereo 48 kHz) | `AudioBufferSourceNode` -> `AudioData` WebCodecs |
| `RenderCore` | `Export Pipeline` | `HTMLCanvasElement` / `ImageBitmap` | `VideoFrame(canvas)` WebCodecs |
| `WebCodecs` | `Mediabunny` | `EncodedVideoChunk` & `EncodedAudioChunk` | Stream write to Memory/File Target |
| `Mediabunny` | `Studio UI` | `Uint8Array` / `Blob` (`video/mp4`) | File download trigger |

---

## 3. Integrasi Eksternal (Third-Party Libraries)
- **Rapier2D (`@dimforge/rapier2d`):** Diintegrasikan melalui WebAssembly binary loader deterministik.
- **PixiJS v8 (`pixi.js`):** Menggunakan pipeline WebGL2 teroptimasi untuk batch rendering jutaan partikel via sprite pooling.
- **Mediabunny (`mediabunny`):** Menggantikan pustaka lama (`mp4-muxer`) untuk standarisasi muxing AVC/AAC ke ISO Base Media File Format (MP4).
