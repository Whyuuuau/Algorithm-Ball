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

## Ringkasan Proyek (Overview)

**ASMR Video Studio v2.0** dirancang untuk kreator konten edukasi sains, algoritma, dan simulator fisika santai (*oddly satisfying*). Seluruh proses—mulai dari simulasi partikel, sintesis gelombang audio, rendering grafis, hingga encoding kontainer video MP4—dieksekusi secara **100% lokal di browser pengguna** tanpa memerlukan server backend atau GPU eksternal.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           ASMR STUDIO ARCHITECTURE                             │
│                                                                                │
│  [ UI Studio (React 18 + Zustand) ]                                            │
│        │                                                                       │
│        ▼                                                                       │
│  [ @asmr/schema ] ── Zod v3 Config ── 7 Presets ── Monotone Tension Curve      │
│        │                                                                       │
│        ├───────────────────────────────────┬───────────────────────────────────┤
│        ▼                                   ▼                                   ▼
│  [ @asmr/sim-core ]                [ @asmr/audio-core ]              [ @asmr/render-core ]
│  • Structure-of-Arrays (SoA)       • 5 Modal Synth Palettes          • Canvas 2D Stage
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

## Fitur Unggulan

### 1. Tiga Mode Scene + 7 Preset Bawaan

| Mode Scene | Deskripsi | Preset Bawaan |
|---|---|---|
| **Tower Breaker** | Pertarungan multi-lane memecahkan tumpukan lantai ber-HP (Manual Array atau Rumus Eksponensial), pin rintangan dinamis (*pegs*), hit-stop, sudden-death damage scaling, dan aksi lantai pecah (`MULTIPLY`, `ADD`, `SCALE_SIZE`, `SCALE_SPEED`). | `3 Towers - 60s`<br>`Duel 2 Lanes - 45s` |
| **Maze Escape** | Cincin konsentris berputar dengan sudut celah (*gap angle*), ketahanan cincin (*durability*), transfer kecepatan sudut tangensial, dan penghitung target bola lolos. | `5 Cincin Maze - 60s` |
| **Algorithm Arena** | Empat visualisasi algoritma sains & komputasi komputer yang berpacu secara visual dan menghasilkan nada prosedural yang sinkron. | `Falling Sand Alchemist`<br>`TSP 2-Opt`<br>`BFS vs Petir`<br>`Boids vs Lubang Hitam` |

#### Visualiser Algorithm Arena:
1. **Falling Sand Alchemist**: Automata seluler kisi piksel interaktif simulasi partikel Pasir, Air, Lava, Es, Uap, Obsidian, dan Kaca lengkap dengan transfer panas dan reaksi kimia eksotermik.
2. **TSP 2-Opt (Untangling Tour)**: Penyelesaian masalah *Traveling Salesperson Problem* secara real-time; benang kusut yang awalnya ruwet terurai menjadi cincin lingkaran berurutan optimal.
3. **BFS vs Petir (Dielectric Breakdown Model)**: Pertarungan kecepatan antara algoritma Breadth-First Search (BFS) eksplorasi seragam melawan fraktal petir Laplace DBM acak.
4. **Boids vs Lubang Hitam**: Ribuan partikel boids kawanan (*Flocking Reynolds*) dengan gaya separasi, kohesi, dan alignment yang berjuang meloloskan diri dari tarikan singularitas *event horizon*.

---

### 2. Mesin Fisika Zero-Allocation & 100% Deterministik

- **Bebas Alokasi Memori di Hot-Loop**: Seluruh entitas bola dikelola menggunakan Structure-of-Arrays (SoA) berbasis `Float64Array`, `Float32Array`, `Uint8Array`, dan `Uint16Array` ([`BallPool.ts`](file:///packages/sim-core/src/engine/BallPool.ts)). Tidak ada garbage collection (GC pause) saat simulasi berlangsung.
- **Performa Ekstrem**: 600 frame simulasi analitik 3.000 bola selesai dalam waktu **< 60 ms** (< 0.1 ms per frame), menjamin 60 FPS stabil di browser perangkat standar.
- **Population Governor**: Memisahkan populasi visual di HUD yang bisa mencapai **jutaan bola** dari batas fisik (*physical cap* <= 3000 bola aktif), mempertahankan fluiditas visual tanpa lagging.
- **Determinisme Lintas Mesin**: Generator bilangan acak berbasis `SFC32` dengan state hash `FNV-1a 32-bit`. Seed yang sama selalu menghasilkan gerakan, tumbukan, dan not musik yang persis sama di semua sistem operasi.

---

### 3. Sintesis Audio Prosedural ASMR (`@asmr/audio-core`)

- **5 Palet Instrumen Modal**:
  - `kalimba_glow`: Nada kalimba hangat dan resonan dengan peluruhan ganda.
  - `glass_bell`: Denting kristal jernih dengan harmonik lonceng panjang.
  - `marimba_wood`: Ketukan kayu marimba bulat dan renyah.
  - `thocky_keys`: Suara keyboard mekanikal *thock* dengan redaman transien empuk.
  - `water_drop`: Tetesan air gelembung dengan modulasi pitch eksponensial.
- **Live Audition**: Tombol *Tes Bunyi* interaktif pada Inspector untuk mendengarkan palet instrumen sebelum merender.
- **Musical Quantizer**: Pilihan mode `FREE`, `HARMONIC` (mengikuti progresi akor angka Romawi), dan `GRID` (sinkronisasi ketukan 1/16 note).
- **Chord-on-Density**: Mengelompokkan tumbukan bola yang rapat menjadi akor triad yang harmonis alih-alih suara berisik.
- **Rantai Efek DSP**:
  - *Constant-Power Stereo Panning* (mengikuti koordinat X).
  - *Y-Axis 1-Pole Low-Pass Filter* (posisi atas terdengar terang, posisi bawah terdengar hangat).
  - *Tension Sub-Bass Drone* (mengikuti kurva tensi video).
  - *Schroeder Stereo Reverb* (comb & all-pass filter network).
  - *Lookahead Peak Limiter* (-1 dBFS ceiling anti-clipping).

---

### 4. Studio UI & Inspector Kustomisasi (6 Tab)

- **Scene**: Konfigurasi lane (tambah/hapus, warna, label, bola awal, radius, aksi lantai pecah), formula HP lantai (Array Manual vs Eksponensial), pin rintangan (pegs), cincin maze, atau parameter khusus algoritma.
- **Fisika**: Gravitasi X/Y, restitusi (pantulan), speed lock, substep integrasi numerik, hit-stop, screen shake, dan safe flash guard.
- **Suara**: Pemilihan palet instrumen, nada dasar (*root note* C1-B8), skala nada (pentatonic, dorian, lydian, mayor, minor), volume, reverb, dan cutoff filter.
- **Visual**: Tema latar, ketebalan glow, intensitas bloom pass, trail fade, pitch-to-hue synesthesia (warna bola berubah sesuai tinggi nada), HUD toggle, dan safe zone overlay.
- **Arc/Rule**:
  - **Interactive SVG Tension Curve Editor**: Drag titik kurva tensi secara bebas (tambah/hapus titik) dengan interpolasi smoothstep C1.
  - **Declarative Rule Engine**: Buat aturan kausal kustom (*Trigger: ON_FLOOR_BREAK / ON_TIMER / ON_COUNT_REACHED / ON_BEAT* $\rightarrow$ *Guard: max_fires, cooldown, depth_limit* $\rightarrow$ *Action: MULTIPLY, ADD, SHAKE, FLASH, SHIFT_PITCH*).
- **Export**:
  - **Seed Scout (Climax Finder)**: Evaluasi puluhan kandidat seed secara instan (*headless*) untuk menemukan seed dengan skor tensi dan dramatisasi tertinggi.
  - **Two-Pass MP4 Exporter**: Ekspor video 1080×1920 60 FPS langsung ke file `.mp4` siap unggah.
  - **Manajemen Preset**: Simpan preset kustom ke LocalStorage serta Import/Export format `.json`.
  - **Undo / Redo Penuh**: Riwayat perubahan tak terbatas (`Ctrl+Z` / `Ctrl+Y`).

---

## Struktur Monorepo (NPM Workspaces)

```text
├── packages/
│   ├── schema/        # Skema Zod v3, ProjectConfig, 7 Preset, & Tension Evaluator
│   ├── sim-core/      # Mesin fisika SoA, Tower/Maze/Arena, Governor, Rule Engine
│   ├── audio-core/    # Sintesis modal, Skala nada, Kuantizer, Reverb, Limiter
│   └── render-core/   # Canvas 2D StageRenderer, Bloom Filter, Cached Glow Sprites
├── apps/
│   └── studio/        # Web Studio (Vite, React 18, Tailwind, WebCodecs Exporter)
├── knowledge/         # Dokumentasi lesson learned arsitektur & determinisme
└── .kiro/specs/       # Dokumen spesifikasi teknis (FSD, TSD, Task List, Scan Evidence)
```

---

## Panduan Instalasi & Menjalankan Proyek

### Kebutuhan Sistem
- **Node.js**: versi `>= 18.0.0`
- **npm**: versi `>= 9.0.0`
- **Browser Rekomendasi**: Google Chrome, Microsoft Edge, atau browser berbasis Chromium terkini (mendukung WebCodecs API).

### 1. Clone & Install Dependensi
```bash
git clone https://github.com/Whyuuuau/Algorithm-Ball.git
cd Algorithm-Ball
npm install
```

### 2. Jalankan Server Pengembangan (Dev Mode)
```bash
npm run dev
```
Buka browser dan akses alamat: **`http://localhost:5173/`**.

### 3. Jalankan Pengujian & Verifikasi
```bash
# Validasi tipe TypeScript seluruh packages
npx tsc -p tsconfig.json --noEmit

# Jalankan seluruh unit test suite & verifikasi determinisme
npm run test

# Build bundle production studio
npm run build --workspace=@asmr/studio
```

---

## Navigasi Pintasan Keyboard (Shortcuts)

| Tombol | Fungsi |
|---|---|
| <kbd>Space</kbd> | Mulai / Jeda simulasi pratinjau (*Play / Pause*) |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Batalkan perubahan konfigurasi (*Undo*) |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | Ulangi perubahan (*Redo*) |

---

## Standar & Kepatuhan Keamanan
- **Safe Flash Guard**: Membatasi efek kilatan layar (flash) maksimal $\le 3$ kali per detik guna mematuhi standar aksesibilitas fotosensitivitas **WCAG 2.1**.
- **No External Secrets**: Aplikasi bebas dari secret keys, API credentials, maupun ketergantungan server pihak ketiga.

---

## Lisensi
Didistribusikan di bawah lisensi **MIT**. Bebas digunakan dan dikembangkan untuk kebutuhan produksi konten kreatif.
