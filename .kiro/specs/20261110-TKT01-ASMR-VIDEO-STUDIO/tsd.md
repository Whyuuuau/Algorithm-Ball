# Technical Specification Document (TSD)
**Ticket:** `20261110-TKT01-ASMR-VIDEO-STUDIO`  
**Feature:** Procedural Physics & Algorithm ASMR Video Studio  
**Date:** 2026-11-10  
**Version:** 2.0  
**Status:** `APPROVED` (`process = Yes`)  

---

## 1. Technical Stack & Environment

- **Runtime Environment:** Browser modern (Chromium-based: Google Chrome / Microsoft Edge v114+ dengan dukungan WebCodecs, WebGL2, dan AudioWorklet/WebAudio).
- **Workspace Tooling:** Node.js v24+, npm workspaces, TypeScript 5.x (Strict mode), Vite.
- **Physics Engine:** `@dimforge/rapier2d` / `@dimforge/rapier2d-deterministic-compat` (WASM-based 2D Rigid Body Physics) dengan fixed substeps ($\ge 4$) dan spatial hash broadphase.
- **Visual & Graphic Engine:** PixiJS v8 (WebGL2 backend), `@pixi/filter-bloom`, custom GLSL shader untuk threshold metaball dan persistent motion trail.
- **Audio Engine:** Pure Web Audio API + Prosedural Modal Synthesis (zero sample dependensi), Lookahead Limiter offline, Musical Quantizer.
- **Video & Muxing Pipeline:** W3C WebCodecs API (`VideoEncoder` H.264 AVC High Profile, `AudioEncoder` AAC-LC), Mediabunny MP4 muxer.
- **UI Framework:** React 19, TailwindCSS, Zustand state store, Zod schema validator, Lucide icons.

---

## 2. Low-Level Component Specifications

### 2.1 SimCore Loop & Mathematical Contract
Simulasi berjalan dengan discrete fixed timestep:
$$\Delta t = \frac{1}{\text{fps}} = \frac{1}{60} \approx 0.01666667\text{ s}$$

Setiap pemanggilan `step()` mengeksekusi urutan berikut secara deterministik:
1. `rules.applyPendingCommandBuffer(world)`: Menerapkan penambahan/penghapusan entitas dari frame sebelumnya.
2. `world.step(eventQueue)`: Menjalankan $k$ substep simulasi Rapier2D ($k = 4$, $\Delta t_{\text{sub}} = \Delta t / 4$).
3. `collectAndSortCollisions(eventQueue)`: Mengurutkan pasangan tabrakan secara leksikografis berdasarkan tuple ID entitas `(idA, idB)`.
4. `governor.processHits(hits)`:
   - Menghitung damage lantai: $\text{damage} = \sum \text{weight}_{\text{ball}}$.
   - Mengurangi HP lantai dan mengecek breakpoint.
5. `audioLog.recordEvents(hits, frameIndex * dt)`: Mencatat event audio dengan timestamp deterministik berbasis frame, bukan `performance.now()`.
6. `rules.evaluateTriggers(hits, state)`: Mengumpulkan aksi baru ke dalam Command Buffer untuk frame $i+1$.
7. `hashState(frameIndex)`: Menghitung 32-bit FNV-1a hash atas koordinat terkuantisasi $(x, y, v_x, v_y)$ setiap 60 frame.

### 2.2 Population Governor Scaling Function
Ketika entitas virtual $V$ bertambah sementara entitas fisik $P = \text{physical\_cap}$:
$$w_{\text{new}} = w_{\text{current}} \cdot \frac{V + N}{V}$$
Visual radius bola diskalakan secara sub-linear agar bola tidak menutupi seluruh layar:
$$r_{\text{render}} = r_{\text{base}} \cdot \left(1 + 0.15 \cdot \log_{10}(w)\right)$$

### 2.3 Modal Synthesis Parameters
Persamaan modal:
$$s(t) = \sum_{k=0}^{M-1} a_k \sin\left(2\pi f_0 r_k t\right) e^{-t / \tau_k}$$
Konfigurasi matrik palette:
- **Kalimba:** Modes $r = [1.0, 6.27, 17.55]$, Dampening $\tau = [1.0, 0.4, 0.1]$, Amplitudo $a = [1.0, 0.35, 0.12]$.
- **Glass Bell:** Modes $r = [1.0, 2.76, 5.40, 8.93]$, Dampening $\tau = [1.8, 1.2, 0.7, 0.4]$, Amplitudo $a = [1.0, 0.6, 0.4, 0.2]$.
- **Marimba Wood:** Modes $r = [1.0, 4.0, 10.0]$, Dampening $\tau = [0.35, 0.2, 0.08]$, Amplitudo $a = [1.0, 0.5, 0.25]$.

---

## 3. High-Performance Client-Side Optimizations

1. **Zero-Garbage Collection (Zero-Alloc) State Transfer:**
   - Posisi dan status partikel dikemas dalam `Float32Array` teralokasi di awal:
     `[posX, posY, velX, velY, radius, r, g, b, alpha, ...]`.
   - Tidak ada pembuatan objek JS sementara di dalam event loop 60 FPS.
2. **Audio Buffer Pooling & Synthesizer Caching:**
   - Seluruh notasi modal dirender satu kali ke `AudioBuffer` 48 kHz stereo saat inisialisasi scene.
   - Pemicuan nada langsung memutar buffer yang ada tanpa re-sintesis gelombang di live preview maupun offline rendering.
3. **Canvas Offscreen & WebCodecs Direct Transfer:**
   - Frame dari WebGL2 context langsung diekstrak via `VideoFrame` / canvas source tanpa `gl.readPixels()` blocking ke CPU memory.

