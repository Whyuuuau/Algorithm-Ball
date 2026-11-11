import type { ArenaId, ArenaParamSpec } from "./types.js";

export const ARENA_PARAM_SPECS: Record<ArenaId, ArenaParamSpec[]> = {
  FALLING_SAND: [
    { key: "emitters", label: "Faucet Count", min: 1, max: 8, step: 1, default: 4 },
    { key: "flow", label: "Pour Rate", min: 1, max: 10, step: 1, default: 4 },
    { key: "walls", label: "Rock Slopes Count", min: 0, max: 14, step: 1, default: 5 }
  ],
  TSP_2OPT: [
    { key: "cities", label: "City Count", min: 40, max: 600, step: 20, default: 260 },
    { key: "swaps_per_frame", label: "Swaps / Frame", min: 1, max: 20, step: 1, default: 4 }
  ],
  BFS_LIGHTNING: [
    { key: "eta", label: "Lightning Branching (η)", min: 1, max: 6, step: 0.2, default: 3.2 },
    { key: "obstacles", label: "Obstacle Density", min: 0, max: 0.35, step: 0.05, default: 0.2 },
    { key: "bfs_steps", label: "BFS Speed / Frame", min: 1, max: 25, step: 1, default: 5 }
  ],
  BOIDS: [
    { key: "count", label: "Boid Population", min: 100, max: 2400, step: 100, default: 900 },
    { key: "gravity", label: "Black Hole Gravity Pull", min: 40, max: 700, step: 20, default: 260 },
    { key: "hole_radius", label: "Event Horizon Radius", min: 4, max: 24, step: 1, default: 9 }
  ]
};

export function arenaDefaults(id: ArenaId): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of ARENA_PARAM_SPECS[id]) out[s.key] = s.default;
  return out;
}

