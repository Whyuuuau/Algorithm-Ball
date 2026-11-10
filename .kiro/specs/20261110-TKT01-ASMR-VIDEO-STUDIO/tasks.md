# Tasks & Execution Roadmap
**Ticket:** `20261110-TKT01-ASMR-VIDEO-STUDIO`  
**Feature:** Procedural Physics & Algorithm ASMR Video Studio  
**Date:** 2026-11-10  
**Version:** 2.0  
**Status:** `APPROVED` (`process = Yes`)  

---

## Task Breakdown per Fase

### Fase 0: Project Setup & Spike Proofs
- [ ] **Task 0.1:** Inisialisasi Monorepo (npm workspaces), TypeScript strict, TailwindCSS, dan konfigurasi Vite.
- [ ] **Task 0.2:** Buat `packages/schema` dengan Zod untuk validasi `ProjectConfig v2` dan preset default (*Classic 3 Towers*).
- [ ] **Task 0.3:** Spike (a) - Verifikasi integrasi Rapier2D WASM (deterministik fixed timestep).
- [ ] **Task 0.4:** Spike (c) - Walking skeleton WebCodecs (VideoEncoder H.264 + Mediabunny muxer) untuk video 1080×1920 60 FPS + audio AAC.
- [ ] **Task 0.5:** Spike (d) - Modal Synthesizer test (prerendering Kalimba, Glass Bell, Marimba ke AudioBuffer).

### Fase 1: Vertical Slice (Tower Breaker Core)
- [ ] **Task 1.1:** Implementasi `packages/sim-core`: PRNG pool (`sfc32`), Rapier physics wrapper, collision event ordering.
- [ ] **Task 1.2:** Implementasi `Population Governor` (alokasi bola fisik vs virtual, weighted damage, object pool).
- [ ] **Task 1.3:** Implementasi Tower Breaker rules & floor shatter mechanics (HP calculation, multiplier, spawn command buffer).
- [ ] **Task 1.4:** Implementasi `packages/audio-core`: AudioDirector, HitLog recording, Musical Quantizer (pentatonic scale), dan Lookahead Limiter (-1 dBFS).
- [ ] **Task 1.5:** Implementasi `packages/render-core`: PixiJS v8 renderer, ParticleContainer untuk bola, rendering lantai, HUD status.
- [ ] **Task 1.6:** Implementasi `Two-Pass Deterministic Exporter` di `apps/studio` (Pass 1 Headless Audio -> Pass 2 Frame Video -> MP4).

### Fase 2: Sound & Tactile Game Feel
- [ ] **Task 2.1:** Implementasi 4 Modal Synth Palette lengkap (Kalimba Glow, Glass Bell, Marimba Wood, Thocky Keys).
- [ ] **Task 2.2:** Implementasi Chord-dari-Kepadatan (Density-to-Chord sliding window aggregator).
- [ ] **Task 2.3:** Implementasi Constant-Power Spatial Panning & Filter Y vertikal.
- [ ] **Task 2.4:** Implementasi Arc Director & Tension Curve (interpolasi spline memodulasi pitch, bloom, dan drone).
- [ ] **Task 2.5:** Efek Game Feel: Hit-stop 2-frame, Screen Shake deterministik, Squash & Stretch, Bloom & Motion Trail, Safe Flash limiter.
- [ ] **Task 2.6:** Implementasi Loop Outro (visual cross-dissolve & audio fade ke frame 0).

### Fase 3: Studio UI & Maze Escape
- [ ] **Task 3.1:** Studio UI Layout: Panel Konfigurasi (Kiri), Viewport 9:16 interaktif & Transport Bar (Tengah), Inspector Tabulasi (Kanan).
- [ ] **Task 3.2:** Tension Curve Editor visual (draggable control points spline).
- [ ] **Task 3.3:** Implementasi Maze Escape Scene (Concentric kinematic rotating rings, sensor exit gate, ring break triggers).
- [ ] **Task 3.4:** Rule Engine deklaratif dengan safety guards (`max_fires`, `cooldown_ms`, `depth_limit`, `budget_per_frame`).

### Fase 4: Algorithm Arena
- [ ] **Task 4.1:** GridEngine (`Uint8Array` 500×500 sel, fixed budget ops per frame).
- [ ] **Task 4.2:** Falling Sand Alchemist (reaksi material Lava/Es/Asam).
- [ ] **Task 4.3:** TSP 2-Opt (traversal penataan simpul dengan pitch pluck bertahap).
- [ ] **Task 4.4:** BFS vs Lightning (SOR relaxation DBM).
- [ ] **Task 4.5:** Boids vs Black Hole (spatial hashing grid flocking).

### Fase 5: Seed Scout & Optimasi Produksi
- [ ] **Task 5.1:** Seed Scout Web Worker runner (menjalankan 64 seed headless).
- [ ] **Task 5.2:** Formula kalkulasi Climax Score dan pratinjau 5 seed terbaik.
- [ ] **Task 5.3:** Stress testing performa: 60 FPS stabil pada 3.000 bola preview, render 1080×1920 export tanpa kebocoran memori.
