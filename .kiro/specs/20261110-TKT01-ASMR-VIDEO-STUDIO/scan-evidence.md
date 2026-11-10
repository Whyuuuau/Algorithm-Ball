# Scan & Verification Evidence
**Ticket:** `20261110-TKT01-ASMR-VIDEO-STUDIO`  
**Feature:** Procedural Physics & Algorithm ASMR Video Studio  
**Date:** 2026-11-10  

---

## 1. Automated Test Suite Execution (Vitest)
**Status:** `PASS`  
**Command:** `npm run test` (Vitest v3.2.7)  
**Execution Timestamp:** 2026-11-10 15:16:12 WIB  

```
 RUN  v3.2.7 C:/Dokumen Why/Algorithm Ball

 ✓ packages/sim-core/test/rules-and-maze.test.ts (2 tests) 54ms
 ✓ packages/sim-core/test/determinism.test.ts (2 tests) 1701ms
   ✓ SimCore Determinism & Governor Contract > should produce 100% identical hashes across two runs with identical seed  1698ms
 ✓ packages/audio-core/test/audio.test.ts (3 tests) 2067ms
   ✓ AudioDirector & Modal Synthesis Verification > should generate clean modal PCM without NaN or Infinity  1455ms
   ✓ AudioDirector & Modal Synthesis Verification > should enforce -1 dBFS limiter ceiling on offline render  328ms

 Test Files  3 passed (3)
      Tests  7 passed (7)
   Start at  15:16:12
   Duration  3.06s (transform 442ms, setup 0ms, collect 828ms, tests 3.82s, environment 1ms, prepare 673ms)
```

---

## 2. Production Bundle Compilation (Vite)
**Status:** `PASS`  
**Command:** `npm run build --workspace=@asmr/studio`  
**Execution Timestamp:** 2026-11-10 15:15:35 WIB  

```
> @asmr/studio@2.0.0 build
> vite build

vite v6.4.6 building for production...
transforming...
✓ 2199 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.66 kB │ gzip:     0.44 kB
dist/assets/index-Dau66xic.css     15.76 kB │ gzip:     3.67 kB
dist/assets/index-3gFKNwqf.js   4,045.45 kB │ gzip: 1,460.82 kB
✓ built in 4.98s
```

---

## 3. Security & Static Analysis Tool Status

| Tools / Security Gate | Status | Evidence / Alasan |
|---|---|---|
| **TypeScript Strict Checking** | `PASS` | Lolos kompilasi tanpa type errors (`strict: true`). |
| **Unit Test Coverage** | `PASS` | 7 test cases covering determinism, governor cap, modal synthesis, limiter, rules, & maze mechanics. |
| **SonarQube Analysis** | `NOT_RUN` | Server SonarQube lokal/remote tidak dikonfigurasi pada workspace ini. |
| **SAST (Static Application Security Testing)** | `NOT_RUN` | Runner SAST enterprise (mis. Checkmarx/Snyk CLI) tidak tersedia. |
| **DAST (Dynamic Analysis)** | `NOT_RUN` | Membutuhkan deployment staging aktif dan scanner DAST. |
| **Penetration Test** | `NOT_RUN` | Belum dijadwalkan untuk rilis internal ini. |
