import type { ArenaId, ArenaParamSpec } from "./types.js";

export const ARENA_PARAM_SPECS: Record<ArenaId, ArenaParamSpec[]> = {
  FALLING_SAND: [
    { key: "emitters", label: "Jumlah Keran", min: 1, max: 8, step: 1, default: 4 },
    { key: "flow", label: "Laju Tuang", min: 1, max: 10, step: 1, default: 4 },
    { key: "walls", label: "Jumlah Lereng Batu", min: 0, max: 14, step: 1, default: 5 }
  ],
  TSP_2OPT: [
    { key: "cities", label: "Jumlah Kota", min: 40, max: 600, step: 20, default: 260 },
    { key: "swaps_per_frame", label: "Swap / Frame", min: 1, max: 20, step: 1, default: 4 }
  ],
  BFS_LIGHTNING: [
    { key: "eta", label: "Cabang Petir (eta)", min: 1, max: 6, step: 0.2, default: 3.2 },
    { key: "obstacles", label: "Kepadatan Rintangan", min: 0, max: 0.35, step: 0.05, default: 0.2 },
    { key: "bfs_steps", label: "Laju BFS / Frame", min: 1, max: 25, step: 1, default: 5 }
  ],
  BOIDS: [
    { key: "count", label: "Jumlah Boids", min: 100, max: 2400, step: 100, default: 900 },
    { key: "gravity", label: "Tarikan Lubang Hitam", min: 40, max: 700, step: 20, default: 260 },
    { key: "hole_radius", label: "Radius Event Horizon", min: 4, max: 24, step: 1, default: 9 }
  ]
};

export function arenaDefaults(id: ArenaId): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of ARENA_PARAM_SPECS[id]) out[s.key] = s.default;
  return out;
}
