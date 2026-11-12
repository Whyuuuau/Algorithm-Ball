# Procedural Physics & Algorithm ASMR Video Studio v2.0

> **Generative 100% Client-Side Web Studio** for producing high-retention vertical ASMR videos (TikTok, Instagram Reels, YouTube Shorts, 9:16 aspect ratio). Powered by deterministic analytical physics, algorithmic cellular/graph simulations, procedural modal sound synthesis, and browser-native **1080×1920 @ 60 FPS MP4** export via **WebCodecs** and **Mediabunny**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-3.0-729B1B?logo=vitest&logoColor=white)](https://vitest.dev/)
[![WebCodecs](https://img.shields.io/badge/WebCodecs-H.264%20%2B%20AAC-emerald.svg)]()
[![Resolution](https://img.shields.io/badge/Export-1080x1920%20%40%2060%20FPS-cyan.svg)]()

---

## Project Overview

**ASMR Video Studio v2.0** is designed for creators of science education, algorithms, and oddly satisfying physics simulation content. The entire pipeline—particle simulation, acoustic audio waveform synthesis, graphics rendering, and MP4 container multiplexing—is executed **100% locally in the user's browser** without requiring any backend servers or external GPU compute.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           ASMR STUDIO ARCHITECTURE                             │
│                                                                                │
│  [ UI Studio (React 18 + Zustand) ]                                            │
│        │                                                                       │
│        ▼                                                                       │
│  [ @asmr/schema ] ── Zod v3 Config ── 20 Presets ── Monotone Tension Curve     │
│        │                                                                       │
│        ├───────────────────────────────────┬───────────────────────────────────┤
│        ▼                                   ▼                                   ▼
│  [ @asmr/sim-core ]                [ @asmr/audio-core ]              [ @asmr/render-core ]
│  • Structure-of-Arrays (SoA)       • 9 Modal Synth Palettes          • Canvas 2D Stage
│  • Tower Breaker (Lanes/Pegs/HP)   • Scales & Chord Triads           • Cached Radial Glow
│  • Maze Escape (Rotating Rings)    • Spatial Pan & Y Lowpass         • Additive Bloom Pass
│  • 4 Algorithm Arena Modes         • Tension Bass Drone              • Safe Flash Guard
│  • Population Governor             • Schroeder Stereo Reverb         • Synesthesia (Hue)
│  • Declarative Rule Engine         • Lookahead Limiter (-1 dBFS)     • Loop Outro Dissolve
│        │                                   │                                   │
│        └─────────────────┬─────────────────┘                                   │
│                          ▼                                                     │
│            [ Two-Pass WebCodecs MP4 Exporter ] ◄───────────────────────────────┘
│            • Pass 1: Headless Sim Hits Log + Offline 48kHz Stereo PCM Render
│            • Pass 2: High-Bitrate H.264 VideoTrack + AAC-LC AudioTrack Muxing
│            • Output: 1080×1920 @ 60 FPS MP4 File
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Features

### 1. Nine Scene Engines + 17 Zero-Duplicate Flagship Presets (4 Categories)

| Category | Featured Presets | Highlights & Signature Experience |
|---|---|---|
| **Satisfying & ASMR** | `Harmonic Pendulum Wave Harp`<br>`Chromatic Prism Chamber`<br>`Sacred Lens Caustic Mandala`<br>`Chrono-Pendulum Goblet Surge`<br>`Galton Probability Bell Curve` | **Phase-locked 18-string Pendulum Wave with liquid silk ribbon**, **breathing 7-sided Chromatic Prism**, **precessing Vesica Piscis optical lens**, **chalice overflow fill gauge**, and **funnel Galton curve**. |
| **High Tension & Battle** | `The Exponential Gambit: 1 vs 512`<br>`Hexagonal Quantum Centrifuge`<br>`4-Faction Cyber Laser Siege`<br>`Custom Keyswitch Pachinko ASMR`<br>`1-Orb Evolution to 1,000,000` | **Broadcast Duel HUD**, **spinning hexagonal cube centrifuge**, **cathedral pins & 136 BPM synth pulse**, **lubed mechanical switch acoustics**, and **Handpan mutating solo orb**. |
| **Sci-Fi & Cosmic** | `Celestial Polyrhythm Astrarium`<br>`Solar Handpan Gravity Vault`<br>`432 Hz Aurora Crystal Sanctuary` | **16 concentric planetary orbits with constellation threads**, **breakable concentric vault rings with metallic handpan**, and **deep aurora crystal bowls**. |
| **Algorithm & Arena** | `Falling Sand Alchemist`<br>`TSP 2-Opt Geometric Untangler`<br>`BFS Wavefront vs Fractal Lightning`<br>`Cosmic Boids vs Singularity` | Four interactive scientific computing and cellular automata pixel arenas synchronized to procedurally generated acoustic scales. |

#### Algorithm Arena Visualizers:
1. **Falling Sand Alchemist**: Interactive pixel-grid cellular automata simulating Sand, Water, Lava, Ice, Steam, Obsidian, and Glass particles complete with exothermic heat transfer and state transitions.
2. **TSP 2-Opt (Untangling Tour)**: Real-time heuristic optimization of the Traveling Salesperson Problem; entangled route loops untangle into a sleek, optimal geometric ring tour.
3. **BFS vs Lightning (Dielectric Breakdown Model)**: High-stakes speed contest between uniform Breadth-First Search wavefront expansion and stochastic Laplacian DBM fractal lightning bolts.
4. **Boids vs Black Hole**: Thousands of flocking boid agents governed by Reynolds separation, cohesion, and alignment struggling to break free from the event horizon gravitational well.

---

### 2. Zero-Allocation & 100% Deterministic Physics Engine

- **Zero Memory Allocation in Hot-Loops**: Ball entities are managed using Structure-of-Arrays (SoA) layout with typed arrays (`Float64Array`, `Float32Array`, `Uint8Array`, and `Uint16Array`) ([`BallPool.ts`](file:///packages/sim-core/src/engine/BallPool.ts)). Zero garbage collection pauses during live simulation.
- **Extreme Performance**: 600 analytical simulation frames of 3,000 balls finish in **< 60 ms** (< 0.1 ms per frame), guaranteeing rock-solid 60 FPS in standard browser environments.
- **Population Governor**: Decouples visual HUD populations (which can reach **millions of balls**) from the physical active collision pool (capped at <= 3,000 physical bodies), maintaining fluid performance without lag.
- **Cross-Platform Determinism**: `SFC32` pseudorandom number generator with 32-bit `FNV-1a` state hashing. Identical seeds yield byte-for-byte identical motion vectors, collision points, and musical notes across all operating systems.

---

### 3. Procedural Physical ASMR Audio Synthesis (`@asmr/audio-core`)

- **Direct Physical Bounce Acoustic Excitation**: Sounds are directly triggered by ball collision events against floors, pegs, rings, and walls. Volume dynamics scale with collision momentum ($0.28 + 0.72 \cdot v^{0.75}$) so high-speed slams deliver rich, explosive impact while gentle grazing taps produce delicate acoustic clicks.
- **9 Modal Resonator Palettes**:
  - `kalimba_glow`: Warm, resonant dual-decay metallic kalimba tines.
  - `glass_bell`: Crystalline bell tones with extended bell-strike harmonics.
  - `marimba_wood`: Deep, rounded rosewood marimba bar strikes.
  - `thocky_keys`: Lubed mechanical keyboard keypresses with soft transient damping.
  - `water_drop`: Organic bubble water drops with exponential pitch modulations.
  - `synth_pluck`: Punchy 80s Cyberpunk analog synth plucks.
  - `music_box`: Nostalgic mechanical pinned cylinder music box chimes.
  - `crystal_bowl`: Pure 432 Hz quartz singing bowl healing resonance.
  - `cosmic_laser`: Fast arcade sci-fi laser frequency sweeps.
- **11 Musical Scale Modes**: Pentatonic Major, Pentatonic Minor, Dorian, Lydian, Major, Minor, **Hirajoshi** (Japanese Zen), **Insen** (Traditional Japanese), **Gypsy Minor** (Dramatic), **Whole Tone** (Surreal Dream), and **Blues**.
- **Live Audition**: Interactive *Preview Sound* button on the Inspector to test instrument palettes before exporting.
- **Musical Quantizer**: Select between `FREE` (pure physical timing), `HARMONIC` (mapped to Roman numeral chord progressions), and `GRID` (1/16th note musical quantization).
- **Density-Triggered Chords**: Dynamically collapses dense multi-ball collision clusters into harmonious musical triads.
- **DSP Effect Chain**:
  - *Constant-Power Stereo Panning* (mapped to the horizontal X impact coordinate).
  - *Vertical 1-Pole Low-Pass Filter* (upper collisions sound bright and airy; lower collisions sound warm and filtered).
  - *Tension Sub-Bass Drone* (modulates with the dramatic narrative tension curve).
  - *Schroeder Stereo Reverb* (comb & all-pass feedback network).
  - *Lookahead Peak Limiter* (-1 dBFS true-peak anti-clipping ceiling).

---

### 4. Studio UI & Deep Inspector Customization (6 Tabs)

- **Scene**: Preset gallery with 16 templates and category filters (Satisfying & ASMR, High Tension, Sci-Fi, Arena), lane management (add/remove, hex colors, custom labels, initial balls, radii, floor break actions), floor HP formulas (Manual Array vs Exponential), obstacle pins (pegs), maze rings, or algorithm arena parameters.
- **Physics**: X/Y Gravity, fluid drag viscosity, gravity wave oscillation, restitution elasticity, speed lock, numerical integration substeps, hit-stop freeze frames, screen shake, and WCAG-compliant safe flash guards.
- **Sound**: 9 modal synthesizers, 11 musical scales, root notes (C1 to B8), master volume, reverb, escalation, and collision pitch mapping options.
- **Look**: 5 background visual themes (Solid, Radial Spotlight, Deep Space Nebula, Cyber Grid, Aurora Gradient), 4 ball styles (Neon Glow, Energy Ring, Glass Marble, Crystal Sparkle), 4 floor styles (Solid Bar, Neon Laser, Glass Bricks, Warning Stripes), Cinematic FX (Chromatic Aberration, CRT Scanlines, Dark Vignette), bloom pass, and HUD overlays.
- **Arc/Rules**:
  - **Interactive SVG Tension Curve Editor**: Drag keyframes with C1 smoothstep interpolation to shape narrative pacing.
  - **Declarative Rule Engine**: Construct custom event triggers (*Trigger: ON_FLOOR_BREAK / ON_TIMER / ON_COUNT_REACHED / ON_BEAT* $\rightarrow$ *Action: SPAWN, SCALE_BALL, ROTATE_ARENA, DAMAGE_WALL, SHIFT_PITCH, SHAKE, FLASH*).
- **Export**:
  - **Seed Scout (Climax Finder)**: Headless simulation across candidate seeds to automatically surface the seed with the highest dramatic climax score.
  - **Two-Pass MP4 Exporter**: Client-side hardware-accelerated 1080×1920 60 FPS MP4 export with WebCodecs H.264 & AAC.
  - **Preset Management**: Save custom presets to LocalStorage and import/export `.json` configurations.
  - **Full Undo / Redo**: Unlimited history tracking (`Ctrl+Z` / `Ctrl+Y`).

---

## Monorepo Architecture (NPM Workspaces)

```text
├── packages/
│   ├── schema/        # Zod v3 schemas, ProjectConfig, 16 Presets, & Tension Evaluator
│   ├── sim-core/      # SoA physics engine, Tower/Maze/Arena scenes, Governor, Rule Engine
│   ├── audio-core/    # Modal synthesis, scales, quantizer, reverb, limiter, AudioDirector
│   └── render-core/   # Canvas 2D StageRenderer, bloom filter, cached glow sprites
├── apps/
│   └── studio/        # Web Studio (Vite, React 18, Tailwind CSS, WebCodecs Exporter)
├── knowledge/         # Architecture notes & determinism documentation
└── .kiro/specs/       # Technical specifications (FSD, TSD, Task List, Scan Evidence)
```

---

## Installation & Getting Started

### System Requirements
- **Node.js**: version `>= 18.0.0`
- **npm**: version `>= 9.0.0`
- **Recommended Browsers**: Latest Google Chrome, Microsoft Edge, or Chromium-based browsers with WebCodecs API support.

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Whyuuuau/Algorithm-Ball.git
cd Algorithm-Ball
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
Open your browser and navigate to: **`http://localhost:5173/`**.

### 3. Testing & Production Build
```bash
# Type-check all packages
npx tsc -p tsconfig.json --noEmit

# Run unit test suite and verify determinism
npm run test

# Build production studio bundle
npm run build --workspace=@asmr/studio
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Space</kbd> | Play / Pause live simulation preview |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo configuration change |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | Redo configuration change |

---

## Safety & Compliance Standards
- **Safe Flash Guard**: Limits full-frame screen flash events to $\le 3$ flashes per second to conform with **WCAG 2.1** photosensitivity accessibility guidelines.
- **Zero External Secrets**: Clean client-side codebase with no private keys, external telemetry, or third-party server tracking.

---

## License
Distributed under the **MIT License**. Free for personal and commercial video production workflows.
