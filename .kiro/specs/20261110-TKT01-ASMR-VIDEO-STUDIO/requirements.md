# Requirements Document (FSD Analysis)
**Ticket:** `20261110-TKT01-ASMR-VIDEO-STUDIO`  
**Feature:** Procedural Physics & Algorithm ASMR Video Studio  
**Date:** 2026-11-10  
**Version:** 2.0  
**Status:** `APPROVED` (`process = Yes`)  

---

## 1. Executive Summary & Business Objective
Sistem ini adalah web studio mandiri (Client-side Single Page Application) yang merancang simulasi fisika prosedural dan visualisasi algoritma menjadi instrumen audiovisual ASMR berkualitas tinggi dengan alur dramatis retensi penonton (*Hook* → *Build* → *Climax* → *Loop Outro*). 

Sistem mengekspor video berformat MP4 vertikal 9:16 (1080×1920 @ 60 FPS) dengan determinisme mutlak: kombinasi Config JSON dan Seed yang identik akan selalu menghasilkan video dan audio yang 100% identik bit-for-bit di setiap eksekusi.

---

## 2. Aktor & Target Pengguna
- **Kreator Konten Video Pendek (Solo Creator):** Memproduksi 3–5 video per minggu untuk platform vertikal (TikTok, YouTube Shorts, Instagram Reels) dengan target waktu kerja ≤ 10 menit dari pemilihan preset hingga MP4 siap unggah.
- **Audience / Viewer:** Penonton video pendek yang mencari kepuasan audio-taktil (ASMR) dan ketegangan visual yang memicu tontonan berulang (*rewatch loop*).

---

## 3. Ruang Lingkup Sistem (Scope Boundaries)
### 3.1 In-Scope (Fase v1 & v2 Roadmap)
1. **Arsitektur 100% Client-side (Browser-only):** Tanpa backend server, tanpa Python, tanpa Electron.
2. **Determinisme Inti:** PRNG seeded (`sfc32`/`mulberry32`), fixed timestep ($\Delta t = 1/60$), urutan event tabrakan deterministik, hash verifikasi FNV-1a.
3. **Simulasi Fisika 2D (Rapier2D Deterministic):**
   - Scene Mode 1: *Tower Breaker* (2–4 lane paralel, damage per benturan, penghancuran lantai, aksi spawn/multiply).
   - Scene Mode 2: *Maze Escape* (wadah konsentris berputar kinematic, trigger sensor keluar, disintegrasi cincin).
4. **Population Governor:** Virtual balls (angka HUD hingga $1.000.000$) vs Physical balls (capped 3.000 preview / 8.000 export) dengan weighted damage.
5. **ASMR Sound-First Pipeline:**
   - Modal Synth sintetis (tanpa sample berbayar/copyright): Kalimba Glow, Glass Bell, Marimba Wood, Thocky Keys.
   - Musical Quantizer (FREE, HARMONIC, GRID).
   - Density-to-Chord aggregator (benturan padat dimainkan sebagai akor harpa).
   - Constant-power stereo panning & Y-axis filter modulation.
   - Dual-mode renderer: Web Audio API (live preview) dan OfflineAudioContext (export), keduanya mengonsumsi HitLog yang identik.
6. **Game Feel & Visual Tactile:**
   - PixiJS v8 WebGL2 Particle rendering & persistent trail buffer.
   - Screen shake deterministik, hit-stop (freeze physics, audio/trail continue), squash & stretch, bloom filter, pitch-to-hue synesthesia, Safe Flash guard.
7. **Arc Director & Tension Curve:**
   - Kurva tension 0–1 memodulasi pitch escalation, densitas notasi, bloom intensity, dan gain bass drone.
   - Loop Outro (cross-dissolve frame akhir ke frame 0).
8. **Seed Scout:** Headless simulation runner di Web Worker untuk mensurvei $N$ seed (default 64) dan memberikan Climax Score otomatis.
9. **Rule Engine:** Event-driven architecture (`Trigger` → `Condition` → `Action[]`) dengan guard ketat (max fires, cooldown, budget per frame, depth limit).
10. **Export Pipeline WebCodecs + Mediabunny:** Direct canvas frame capture ke H.264 High profile dan AudioBuffer ke AAC-LC stereo dalam wadah MP4.
11. **Algorithm Arena (Tier 2):** Falling Sand, TSP 2-Opt, BFS vs Lightning (SOR relaxation), Boids vs Black Hole.

### 3.2 Out-of-Scope (Non-Goals v1)
- Multi-user / Multiplayer dan server-side leaderboard.
- Multi-track timeline video editor kompleks layaknya Premiere/After Effects.
- Rendering 3D atau ray-tracing.
- Native Mobile App (iOS / Android native wrapper).
- Automated social media direct upload / bot autoposter.
- Marketplace cloud preset online.

---

## 4. Kebutuhan Fungsional (Functional Requirements)

### FR-01: Deterministic Simulation Core
- **FR-01.1:** Sistem WAJIB menggunakan generator angka acak semu (PRNG) berbasis seed (`sfc32` atau `mulberry32`). Penggunaan `Math.random()` dilarang keras di seluruh pipeline simulasi dan render.
- **FR-01.2:** PRNG stream HARUS dipisahkan per subsistem (Stream Fisika, Stream VFX, Stream Humanize Audio) agar perubahan visual tidak mengubah trayektori fisika.
- **FR-01.3:** Timestep simulasi harus konstan ($\Delta t = 1 / \text{fps}$, default $1/60$ detik). Time scaling tidak boleh memodifikasi $\Delta t$ fisika melainkan diatur via accumulator terkontrol.
- **FR-01.4:** Seluruh event tabrakan (*collision pair*) wajib diurutkan secara deterministik berdasarkan `(min(idA, idB), max(idA, idB))` sebelum dieksekusi oleh Rule Engine atau Governor.
- **FR-01.5:** Setiap 60 frame, sistem harus menghitung hash state posisi partikel (FNV-1a 32-bit integer). Dua run dengan seed dan konfigurasi yang sama wajib menghasilkan rangkaian hash yang identik.

### FR-02: Population Governor & Entity Pooling
- **FR-02.1:** Sistem memisahkan antara entitas visual/HUD (*Virtual Balls*, $V$) dan entitas komputasi fisika (*Physical Balls*, $P$).
- **FR-02.2:** Jumlah bola fisik dibatasi maksimal `physical_cap` (default 3.000 pada preview, 8.000 pada export).
- **FR-02.3:** Jika aksi spawn melebihi kapasitas yang tersisa ($P \ge \text{cap}$), sistem tidak memunculkan bodi fisika baru, melainkan mengalikan `weight` (bobot virtual) bola yang ada secara proporsional.
- **FR-02.4:** Besaran damage benturan terhadap lantai dihitung setara dengan `weight` bola fisik tersebut.
- **FR-02.5:** Pengalokasian bola fisik wajib menggunakan teknik Object Pool (`setEnabled(false)` saat non-aktif), tanpa alokasi GC repetitif.

### FR-03: Tower Breaker Scene (Tier 1)
- **FR-03.1:** Mendukung 2 hingga 4 lane paralel dengan properti terisolasi (warna, radius, jumlah awal, aturan break lantai).
- **FR-03.2:** Setiap lane memiliki $N$ lantai bertingkat dengan HP yang ditentukan via array manual atau formula pertumbuhan eksponensial $HP[n] = \text{round}(base \cdot growth^n)$.
- **FR-03.3:** Benturan bola mengurangi HP lantai sebesar bobot bola. Ketika HP $\le 0$, lantai hancur (*shatter*), memicu event `ON_FLOOR_BREAK` dan partikel pecahan.
- **FR-03.4:** Penghancuran lantai memicu aksi lane: `ADD (+N)`, `MULTIPLY (xN)`, `SCALE_SIZE`, atau `SCALE_SPEED`.
- **FR-03.5:** Fitur *Sudden Death Shrink*: Jika tidak ada lantai yang pecah dalam durasi $X$ detik, lebar arena menyempit atau gravitasi mengalami rotasi dinamis untuk memecah kebuntuan (*anti-stalemate*).
- **FR-03.6:** Penentuan pemenang saat waktu habis (atau semua lantai satu lane habis): lane dengan lantai tertinggi yang pecah; tie-breaker waktu tercepat.

### FR-04: Maze Escape Scene (Tier 1)
- **FR-04.1:** Wadah berupa cincin konsentris berputar (*Concentric Rings*) dengan segmentasi, ketebalan, kecepatan sudut, dan celah lolos (*gap*).
- **FR-04.2:** Cincin diimplementasikan sebagai *kinematic rigid bodies* yang diputar secara matematis tiap frame.
- **FR-04.3:** Sensor exit (*Exit Gate*) mendeteksi bola yang berhasil keluar dan memicu trigger `ON_EXIT_ENTER`.
- **FR-04.4:** Cincin dapat memiliki durabilitas yang hancur setelah $N$ bola melewatinya (`ON_RING_BREAK`).

### FR-05: Sound-First ASMR Audio Engine
- **FR-05.1: Modal Synthesis:** Suara dihasilkan secara prosedural berbasis persamaan fisika moda getaran batang/lempeng:
  $$s(t) = \sum_{k} a_k \cdot \sin(2\pi \cdot f_0 \cdot r_k \cdot t) \cdot e^{-t / \tau_k}$$
  Tersedia 4 palette bawaan: Kalimba Glow, Glass Bell, Marimba Wood, dan Thocky Keys.
- **FR-05.2: Buffer Pre-rendering:** Nada-nada palette di-prerender ke dalam memory buffer saat startup (40 nada per palette) untuk mengeliminasi latensi CPU runtime.
- **FR-05.3: Musical Quantizer:**
  - Mode `FREE`: Nada berbunyi langsung jika lolos cooldown gate.
  - Mode `HARMONIC`: Nada dipetakan ke skala dan akor aktif yang berprogresi (mis. I–V–vi–IV) mengikuti BPM.
  - Mode `GRID`: Nada ditarik ke grid terdekat jika selisih waktu $\le \text{snap\_ms}$ (maks 30 ms delay atau 8 ms advance), hit di luar toleransi di-thinning.
- **FR-05.4: Chord-dari-Kepadatan (Density-to-Chord):** Jika dalam jendela waktu $W$ ms (default 30 ms) terjadi $\ge K$ benturan (default 6), sistem memicu 1 arpeggio/triad akor harmonis dengan gabungan velocity, bukan menumpuk $K$ nada individual.
- **FR-05.5: Voice Management:** Polifoni maksimum 48 suara dengan algoritma voice stealing (menghentikan suara tertua dan terlemah). Cooldown per-lane antara 12–40 ms.
- **FR-05.6: Spatial Panning & Filter Y:** Constant-power stereo panning berdasarkan posisi horizontal $X$ ($L = \cos(x \pi / 2), R = \sin(x \pi / 2)$). Posisi vertikal $Y$ memodulasi frekuensi cutoff low-pass filter dan send reverb.
- **FR-05.7: Dynamics & Mastering:** Rantai audio mencakup send reverb, kompresor halus, dan lookahead peak limiter (5 ms) dengan ceiling $-1\text{ dBFS}$.

### FR-06: Arc Director & Tension Curve
- **FR-06.1:** Struktur narasi 60 detik default: Hook (0–3s), Build (3–40s), Climax (40–55s), Payoff + Loop (55–60s).
- **FR-06.2:** Tension Curve berupa spline interpolasi kurva ternormalisasi (0.0 hingga 1.0) dengan hingga 8 titik kontrol waktu.
- **FR-06.3:** Parameter terikat Tension:
  - Pitch escalation: $0 \to +12$ semitone (terkunci pada skala).
  - Densitas grid musik: $1/8 \to 1/16 \to 1/32$.
  - Intensitas Bloom: $\times 1.0 \to \times 2.0$.
  - Bass drone gain: $-\infty\text{ dB} \to -12\text{ dB}$.
  - Screen shake trigger saat tension $> 0.9$.
- **FR-06.4: Loop Outro:** Frame ke-0 disimpan sebagai tekstur referensi; $N$ frame terakhir (default 0.6s) melakukan cross-dissolve visual dan pemudaran audio ke nada pembuka.

### FR-07: Visual & Game Feel (Tactile Engine)
- **FR-07.1: Hit-Stop:** Saat lantai besar hancur, simulasi fisika dijeda selama 2 frame, sementara rendering motion trail, bloom, dan audio decay tetap berjalan kontinu.
- **FR-07.2: Squash & Stretch:** Skala visual sprite bola berubah elips searah vektor kecepatan tanpa mengubah collider lingkaran Rapier.
- **FR-07.3: Bloom & Motion Trail:** Menggunakan rendering FBO persisten dengan overlay alpha fade deterministik.
- **FR-07.4: Pitch-to-Hue Synesthesia:** Nada yang berbunyi memicu modulasi warna pada bola atau dinding berdasarkan kelas nada ($0–11 \to \text{Hue } 0–360^\circ$).
- **FR-07.5: Safe Flash Guard:** Membatasi frekuensi kilatan terang layar penuh maksimal 3 kali per detik untuk mencegah kejang fotosensitif.

### FR-08: Seed Scout
- **FR-08.1:** Menjalankan simulasi headless tanpa grafis dan tanpa audio di Web Worker untuk $N$ variasi seed (default 64 seed).
- **FR-08.2:** Menghitung `Climax Score` berbasis formula:
  $$\text{Score} = 0.30 \cdot \text{Kedekatan} + 0.25 \cdot \text{PergantianPemimpin} + 0.20 \cdot \text{KepadatanAkhir} + 0.15 \cdot \text{TanpaStalemate} + 0.10 \cdot \text{VariasiNada}$$
- **FR-08.3:** Menyajikan 5 seed teratas dengan snapshot frame klimaks untuk dipilih pengguna sebelum proses render akhir.

### FR-09: Rule Engine & Event Guard
- **FR-09.1:** Format deklaratif JSON: `Trigger -> (Condition) -> Action[]`.
- **FR-09.2:** Eksekusi aksi ditunda ke awal frame berikutnya melalui *Command Buffer* yang diurutkan secara deterministik.
- **FR-09.3: Safety Guards:**
  - `max_fires` per rule.
  - `cooldown_ms` per rule.
  - `depth_limit = 3` (mencegah rantai cascading spawn loop tak berujung).
  - `budget_per_frame` (maksimal 200 spawn per frame).

### FR-10: Client-Side Export Pipeline
- **FR-10.1: Two-Pass Deterministic Export:**
  - *Pass 1 (Headless Audio):* Eksekusi SimCore penuh untuk menghasilkan `HitLog`, diproses oleh `AudioDirector`, lalu dirender via `OfflineAudioContext` menjadi `AudioBuffer` stereo 48 kHz.
  - *Pass 2 (Visual Frame Capture):* Inisialisasi ulang SimCore dengan seed yang persis sama, lakukan step frame-by-frame, gambar ke canvas, dan encode via `VideoEncoder` (H.264).
- **FR-10.2: Mediabunny Muxing:** Muxing track video H.264 dan track audio AAC-LC secara real-time ke dalam blob format MP4.
- **FR-10.3:** Pengecekan kompatibilitas `VideoEncoder.isConfigSupported()` sebelum ekspor dimulai.

### FR-11: Algorithm Arena (Tier 2)
- **FR-11.1:** Grid data terstruktur `Uint8Array` (default $500 \times 500$) dengan budget operasi sel tetap per frame (`ops_per_frame`).
- **FR-11.2:** Algoritma bawaan: Falling Sand (tabel reaksi material), TSP 2-Opt (pluck pitch traversal), BFS vs Lightning (SOR relaxation DBM), Boids vs Black Hole (spatial hash grid).
- **FR-11.3:** Agregasi audio event terkelompok per milestone sel, bukan per piksel.

### FR-12: Studio UI & Configuration Management
- **FR-12.1:** Skema konfigurasi terpusat divalidasi dengan `Zod` (`ProjectConfig v2`).
- **FR-12.2:** Layout 3-panel: Panel Navigasi & Rule (kiri), Panel Viewport 9:16 & Transport (tengah), Panel Inspector Tabulasi (kanan).
- **FR-12.3:** HUD Overlay mencakup Safe Zone guide vertikal platform (TikTok/Reels/Shorts).

---

## 5. Kebutuhan Non-Fungsional (Non-Functional Requirements)

| ID | Parameter | Spesifikasi & Kriteria Lulus |
|---|---|---|
| **NFR-01** | Determinisme | Seed & config sama wajib menghasilkan hash FNV-1a state identik 100% pada frame 60, 300, 1800, dan 3600. |
| **NFR-02** | A/V Synchronization | Drift visual vs audio onset < 1 frame ($< 16.7\text{ ms}$) sepanjang durasi 60 detik. |
| **NFR-03** | Preview Performance | Stabil $\ge 55\text{ FPS}$ dengan 3.000 bola fisik di browser desktop standar. |
| **NFR-04** | Render Throughput | Durasi render video 60s @ 1080×1920 60 FPS selesai dalam $\le 15$ menit pada mesin benchmark. |
| **NFR-05** | Audio Mastering | Peak level $\le -1\text{ dBFS}$, tanpa clipping analog/digital, tanpa nilai `NaN` atau DC offset. |
| **NFR-06** | Video Standards | Container MP4, Codec H.264 High Profile (yuv420p), Bitrate 10–16 Mbps, Audio AAC-LC 48 kHz stereo 192–256 kbps. |
| **NFR-07** | Local Privacy | 100% data tersimpan di memori browser pengguna; zero outbound telemetry atau server storage. |

---

## 6. Item yang Memerlukan Konfirmasi (`PERLU_DIKONFIRMASI`)

Berikut adalah daftar item yang memerlukan arahan dan konfirmasi eksplisit dari User/Lead sebelum masuk ke tahap pembuatan artefak teknis (*Artifact Generation Phase*):

1. **`PERLU_DIKONFIRMASI` - Package Manager:**  
   FSD menyebutkan penggunaan `pnpm workspace`. Namun pada environment OS Windows saat ini, `pnpm` belum aktif secara global, sedangkan `node v24.21.0`, `npm 11.19.0`, dan `corepack 0.36.0` sudah terpasang. Apakah disetujui untuk mengaktifkan `pnpm` via `corepack enable pnpm`, atau menggunakan standard `npm workspaces`?
2. **`PERLU_DIKONFIRMASI` - Rapier Package Selection:**  
   Apakah implementasi menggunakan build `@dimforge/rapier2d-deterministic-compat` secara eksklusif, atau menyediakan fallback ke `@dimforge/rapier2d` standar jika terdapat isu instalasi binary WASM pada platform Windows?
3. **`PERLU_DIKONFIRMASI` - Target Resolusi Preview Default:**  
   Untuk menjaga performa preview interaktif di perangkat laptop menengah, apakah preview default diset ke resolusi rasio skala $540 \times 960$ (canvas internal tetap $1080 \times 1920$ saat export)?
4. **`PERLU_DIKONFIRMASI` - Prioritas Eksekusi Spike Fase 0:**  
   Sesuai rencana, Spike (c) WebCodecs + Mediabunny ("Hello MP4") dan Spike (a) Rapier deterministik akan dieksekusi pertama pada Fase 0. Apakah alur ini disetujui?

---

## 7. Status Approval & Keputusan Konfirmasi

- **Requirements Status:** `APPROVED` (`process = Yes`)
- **Tanggal Persetujuan:** 2026-11-10
- **Keputusan Item Konfirmasi:**
  1. **Package Manager:** Menggunakan `pnpm` (dieksekusi via `npx pnpm` atau script pnpm workspace).
  2. **Rapier Package:** Target utama `@dimforge/rapier2d-deterministic-compat`, dengan arsitektur adapter/fallback ke `@dimforge/rapier2d` bila diperlukan.
  3. **Resolusi Preview:** Viewport preview diskalakan ke $540 \times 960$ (rasio 9:16) untuk efisiensi CPU/GPU canvas, sedangkan buffer export final tetap pada $1080 \times 1920$ @ 60 FPS.
  4. **Prioritas Eksekusi Spike Fase 0:** Spike (c) WebCodecs + Mediabunny dan Spike (a) Rapier deterministik dijalankan pertama pada Fase 0.

