import type { PRNG } from "../prng/index.js";
import { createBoids } from "./boids.js";
import { createBfsLightning } from "./lightning.js";
import { createFallingSand } from "./sand.js";
import { arenaDefaults } from "./specs.js";
import { createTsp2Opt } from "./tsp.js";
import type { ArenaAlgorithm, ArenaId } from "./types.js";

export * from "./types.js";
export * from "./specs.js";

export function createArena(
  id: ArenaId,
  width: number,
  height: number,
  rng: PRNG,
  params: Record<string, number> = {}
): ArenaAlgorithm {
  const merged = { ...arenaDefaults(id), ...params };
  switch (id) {
    case "FALLING_SAND":
      return createFallingSand(width, height, rng, merged);
    case "TSP_2OPT":
      return createTsp2Opt(width, height, rng, merged);
    case "BFS_LIGHTNING":
      return createBfsLightning(width, height, rng, merged);
    case "BOIDS":
      return createBoids(width, height, rng, merged);
  }
}
