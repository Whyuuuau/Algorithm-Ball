# Code Review & Architecture Notes
**Ticket:** `20261110-TKT01-ASMR-VIDEO-STUDIO`  
**Feature:** Procedural Physics & Algorithm ASMR Video Studio  
**Date:** 2026-11-10  

---

## 1. Evaluasi Kualitas Arsitektur

### 1.1 Kepatuhan Kontrak Determinisme
- Seluruh pembangkitan angka acak diisolasi di `SeededRNGPool` (`sfc32`).
- Tidak ada pemanggilan `Math.random()`, `Date.now()`, atau `performance.now()` di dalam thread simulasi `SimCore`.
- Timestamp audio diikat langsung ke formula diskrit `t = frame * dt`.
- Pasangan tabrakan Rapier disortir secara leksikografis sebelum diproses oleh Governor dan AudioLog.
- Dua run terpisah terbukti menghasilkan hash state FNV-1a yang 100% identik pada Vitest.

### 1.2 Efisiensi Kinerja Klien (Client-Side Optimizations)
- **Zero-Allocation Inner Loop:** Transfer posisi partikel ke `StageRenderer` menggunakan pre-allocated `Float32Array` statis ($10 \times \text{physical\_cap}$ floats) tanpa alokasi object literal GC berulang.
- **Pre-rendered Modal Audio:** Seluruh 40 notasi modal disintesis satu kali ke memory buffer 48 kHz stereo saat start, menghapus beban sintesis runtime saat ribuan bola bertabrakan.
- **Density-to-Chord:** Lonjakan hit padat dalam jendela 30 ms diagregasi menjadi 1 triad akor, mencegah audio glitching dan penumpukan voice polifoni.
- **Population Governor:** Jumlah bola fisik disimulasikan Rapier tetap dibatasi maksimal $\le \text{physical\_cap}$ (3.000 preview / 8.000 export), sementara angka virtual HUD ("×1.000.000 BALLS") diakomodasi melalui penskalaan bobot damage.

### 1.3 Keandalan Ekspor Video (Two-Pass WebCodecs)
- Menggunakan arsitektur Two-Pass:
  - Pass 1: Headless simulation menghasilkan `HitLog` akurat dan merender `AudioBuffer` stereo 48 kHz lengkap.
  - Pass 2: Inisialisasi ulang `SimCore` dengan seed yang sama, merender canvas resolusi penuh 1080×1920 @ 60 FPS, dan menyalurkannya langsung ke `VideoEncoder` H.264 High Profile melalui `mediabunny`.
- Tidak ada alokasi frame mentah RGBA uncompressed di memori browser, menghemat lebih dari 30 GB penggunaan RAM.
