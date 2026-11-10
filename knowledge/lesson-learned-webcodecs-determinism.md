# Lesson Learned: Deterministic Procedural Video Generation in Browser
**Source Ticket:** `20261110-TKT01-ASMR-VIDEO-STUDIO`  
**Date:** 2026-11-10  
**Domain:** Client-Side Simulation, WebCodecs, Web Audio API  

---

## 1. Context & Problem
Pada rendering video beresolusi tinggi (1080×1920 @ 60 FPS) berbasis fisika dan audio ASMR langsung di peramban (client-side SPA):
- Penskalaan bola eksponensial (mis. $\times 100$ per lantai) dapat memicu jutaan entitas yang menyebabkan WebGL crash atau GPU VRAM exhaustion.
- Alokasi frame mentah RGBA uncompressed di RAM (3.600 frame $\times$ 8.3 MB $\approx$ 30 GB) mengakibatkan browser tab Out of Memory (OOM).
- Inkonsistensi floating point atau urutan event tabrakan dapat merusak sinkronisasi audio dan video.

## 2. Root Cause Analysis & Solution
1. **Population Governor:** Memisahkan *Virtual Entities* (angka HUD) dari *Physical Entities* (Rapier rigid bodies dengan hard cap 3.000 preview / 8.000 export). Saat kapasitas penuh, kalikan bobot partikel secara dinamis.
2. **Two-Pass Deterministic Export:**
   - Pass 1 (Headless): Menjalankan simulasi tanpa render grafis untuk mengumpulkan `HitLog` dan merender stereo PCM audio via `OfflineAudioContext`.
   - Pass 2 (Streaming Encoding): Menginisialisasi ulang simulasi dengan seed identik, menggambar frame, dan langsung mengirimkannya ke `VideoEncoder` via `mediabunny.CanvasSource` tanpa menyimpan raw frame RGBA di memori.
3. **Discrete Frame-Based Audio Timestamps:** Mengikat waktu audio tepat pada $\text{frame} \times \Delta t$ alih-alih `performance.now()`, memastikan preview dan hasil export berbunyi 100% sinkron.
