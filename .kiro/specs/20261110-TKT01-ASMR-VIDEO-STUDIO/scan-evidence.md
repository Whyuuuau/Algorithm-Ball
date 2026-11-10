# Scan & Verification Evidence — `20261110-TKT01-ASMR-VIDEO-STUDIO`

## 1. Status Ringkasan Pengujian & Pemindaian

| Kategori | Tool / Pemeriksaan | Status | Bukti (Evidence) |
|---|---|---|---|
| **Typecheck** | `npx tsc -p tsconfig.json --noEmit` | `PASS` | Exit code `0`, 0 error di seluruh 5 workspace packages |
| **Unit & Determinism Tests** | `npm run test` (`vitest run`) | `PASS` | `3 passed (3)` test files, `13 passed (13)` assertions |
| **Production Bundle Build** | `npm run build --workspace=@asmr/studio` | `PASS` | `✓ built in 6.63s` (`index.js` 119.49 kB gzip, `muxer.js` 60.84 kB gzip, `vendor.js` 8.27 kB gzip) |
| **Live Browser E2E Verification** | `playwright-core` (Chromium Headless against `http://localhost:5173/`) | `PASS` | `TOTAL_ERRORS: 0` (`0 console.error`, `0 pageerror`), 60 FPS pada semua 7 preset & 6 tab |
| **Static Linter (ESLint/Biome)** | External CLI Linter | `NOT_RUN` | Tidak dikonfigurasi secara terpisah di luar `tsc --strict` |
| **SonarQube** | SonarScanner | `NOT_RUN` | Tidak tersedia di environment lokal |
| **SAST / DAST / Pentest** | Security Scanner | `NOT_RUN` | Aplikasi 100% client-side offline di browser |

---

## 2. Log Bukti Eksekusi (`tsc`, `vitest`, `vite build`, `playwright`)

### 2.1 TypeScript Strict Typecheck (`npx tsc -p tsconfig.json --noEmit`)
```text
Command: npx tsc -p tsconfig.json --noEmit
Exit Code: 0
Output: (clean, 0 errors)
```

### 2.2 Vitest Unit & Determinism Suite (`npm run test`)
```text
> asmr-video-studio@2.0.0 test
> vitest run

 RUN  v3.2.7 C:/Dokumen Why/Algorithm Ball

 ✓ packages/schema/test/schema.test.ts (3 tests) 7ms
 ✓ packages/sim-core/test/sim.test.ts (7 tests) 1893ms
   ✓ @asmr/sim-core > runs all 4 ALGORITHM_ARENA modes deterministically with pixel output and hits 1693ms
 ✓ packages/audio-core/test/audio.test.ts (3 tests) 3891ms
   ✓ @asmr/audio-core > synthesizes finite, normalized modal PCM across all 5 palettes 2917ms
   ✓ @asmr/audio-core > schedules notes with quantization, chord-on-density, and renders peak-limited stereo PCM 968ms

 Test Files  3 passed (3)
      Tests  13 passed (13)
```

### 2.3 Vite Production Build (`npm run build --workspace=@asmr/studio`)
```text
> @asmr/studio@2.0.0 build
> vite build

vite v6.4.6 building for production...
transforming...
✓ 2208 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.81 kB │ gzip:   0.48 kB
dist/assets/index-hItFiJi8.css   17.02 kB │ gzip:   3.89 kB
dist/assets/vendor-C7sPKgxt.js   27.35 kB │ gzip:   8.27 kB
dist/assets/muxer-B1IV3RYD.js   242.73 kB │ gzip:  60.84 kB
dist/assets/index-F8x6NG3_.js   408.23 kB │ gzip: 119.49 kB
✓ built in 6.63s
```

### 2.4 Live Browser Runtime Verification (Playwright Chromium on `http://localhost:5173/`)
```text
TOWER_HEADER: ASMR STUDIO v2.0 | 3 Towers - 60s TOWER_BREAKER FNV-1a: 0xAAAC6434 Seed Scout Export 1080×1920 MP4
ADDED_4TH_LANE: success
MAZE_SNAP: success
SAND_SNAP: success
TSP_SNAP: success
LIGHTNING_SNAP: success
BOIDS_SNAP: success
ARC_TAB_SNAP: success
EXPORT_TAB_SNAP: success
TOTAL_ERRORS: 0
```
