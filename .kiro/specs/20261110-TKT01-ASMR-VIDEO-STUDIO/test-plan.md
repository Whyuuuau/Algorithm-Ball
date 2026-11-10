# Test Plan & Verification Strategy
**Ticket:** `20261110-TKT01-ASMR-VIDEO-STUDIO`  
**Feature:** Procedural Physics & Algorithm ASMR Video Studio  
**Date:** 2026-11-10  
**Version:** 2.0  
**Status:** `APPROVED` (`process = Yes`)  

---

## 1. Test Categories & Verification Matrix

| Kategori Tes | Sasaran Pengujian | Tolok Ukur / Kriteria Lulus |
|---|---|---|
| **Determinisme Simulasi** | Menjalankan dua iterasi SimCore dengan seed dan konfigurasi identik. | Hash FNV-1a state posisi partikel pada frame 60, 600, 1800, dan 3600 wajib 100% identik bit-for-bit. |
| **Population Governor** | Menguji skenario spawn jutaan bola (mis. $\times 100$ per lantai). | Jumlah bola fisik $P \le \text{physical\_cap}$ setiap saat. Jumlah virtual $V$ bertambah akurat. Total damage benturan konsisten dengan total bobot. |
| **Rule Engine Guards** | Memicu aturan cascading spawn rekursif tak terbatas. | Eksekusi dipotong oleh `depth_limit = 3` dan `budget_per_frame = 200`. Tidak terjadi UI freeze atau infinite call stack. |
| **A/V Sync Accuracy** | Pengujian "Clap Test" (frame kilatan visual dan tone klik audio). | Selisih waktu onset audio dengan frame visual $< 16.7\text{ ms}$ ($< 1$ frame pada 60 FPS). |
| **Audio Peak & Headroom** | Analisis output PCM dari OfflineAudioContext. | Peak level audio $\le -1\text{ dBFS}$, tanpa clipping, tanpa nilai `NaN` atau `Infinity`, tanpa DC offset. |
| **WebCodecs MP4 Smoke Test** | Ekspor render 3 detik pada 540×960 dan 1080×1920. | File MP4 berukuran wajar, dapat diputar sempurna di media player standar dengan audio AAC stereo. |
| **Memory Leak & VRAM** | Eksekusi render 60 detik penuh (3.600 frame). | Penggunaan heap memory JS stabil, tidak terjadi crash `Out of Memory` atau WebGL context loss. |

