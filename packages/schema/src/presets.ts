import { ProjectConfig, ProjectConfigInput, ProjectConfigSchema } from "./schema.js";

const make = (input: ProjectConfigInput): ProjectConfig => ProjectConfigSchema.parse(input);

/** 3 lane Tower Breaker – "siapa pecahkan lantai 10 duluan". */
export const CLASSIC_3_TOWERS_PRESET: ProjectConfig = make({
  seed: 20261110,
  meta: { title: "3 Towers - 60s" },
  scene: { type: "TOWER_BREAKER" }
});

/** Exponential HP, 2 lanes, glass-bell palette. */
export const DUEL_2_LANES_PRESET: ProjectConfig = make({
  seed: 777,
  meta: { title: "Duel 2 Lanes - 45s", duration_sec: 45 },
  arc: { hook_text: "2 TOWER. 1 PEMENANG.\nSIAPA LEBIH CEPAT?" },
  sound: { palette: "glass_bell", scale: { root: "D4", mode: "dorian", octaves: 3 } },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: { mode: "exponential", base: 30, growth: 2.3, count: 9 },
    lanes: [
      { id: "red", label: "x3 / LANTAI", color: "#ff3b6b", initial_balls: 3, ball_radius: 8, on_floor_break: { op: "MULTIPLY", value: 3 } },
      { id: "blue", label: "+200 / LANTAI", color: "#3b9bff", initial_balls: 40, ball_radius: 6, on_floor_break: { op: "ADD", value: 200 } }
    ],
    pegs: { rows: 6, per_row: 5 }
  }
});

/** Concentric rotating rings, zero gravity. */
export const MAZE_RINGS_PRESET: ProjectConfig = make({
  seed: 4242,
  meta: { title: "5 Cincin Maze - 60s" },
  arc: { hook_text: "5 CINCIN. 1 JALUR KELUAR.\nBISAKAH SEMUA LOLOS?", tension_curve: [[0, 0.15], [0.3, 0.4], [0.7, 0.75], [0.9, 1], [1, 0.3]] },
  physics: { gravity: [0, 0], speed_lock: 26, restitution_default: 1, bounce_kick: 0 },
  sound: { palette: "marimba_wood", scale: { root: "C4", mode: "pentatonic_minor", octaves: 3 } },
  scene: { type: "MAZE_ESCAPE" }
});

const arena = (title: string, algorithm: "FALLING_SAND" | "TSP_2OPT" | "BFS_LIGHTNING" | "BOIDS", palette: "kalimba_glow" | "glass_bell" | "water_drop" | "marimba_wood", hook: string): ProjectConfig =>
  make({
    seed: 99,
    meta: { title },
    arc: { hook_text: hook },
    sound: { palette, quantizer: { mode: "HARMONIC" } },
    scene: { type: "ALGORITHM_ARENA", algorithm }
  });

export const SAND_PRESET = arena("Falling Sand Alchemist", "FALLING_SAND", "water_drop", "PASIR + LAVA + AIR\nAPA YANG TERJADI?");
export const TSP_PRESET = arena("TSP 2-Opt", "TSP_2OPT", "glass_bell", "RUTE TERPENDEK\nDITEMUKAN DALAM 60 DETIK");
export const LIGHTNING_PRESET = arena("BFS vs Petir", "BFS_LIGHTNING", "kalimba_glow", "BFS vs PETIR\nSIAPA TIBA DULUAN?");
export const BOIDS_PRESET = arena("Boids vs Lubang Hitam", "BOIDS", "glass_bell", "RIBUAN BURUNG\nMELAWAN LUBANG HITAM");

export const PRESETS: Record<string, { label: string; config: ProjectConfig }> = {
  classic_3_towers: { label: "3 Towers", config: CLASSIC_3_TOWERS_PRESET },
  duel_2_lanes: { label: "Duel 2 Lanes", config: DUEL_2_LANES_PRESET },
  maze_rings: { label: "Maze Rings", config: MAZE_RINGS_PRESET },
  falling_sand: { label: "Falling Sand", config: SAND_PRESET },
  tsp_2opt: { label: "TSP 2-Opt", config: TSP_PRESET },
  bfs_lightning: { label: "BFS vs Petir", config: LIGHTNING_PRESET },
  boids: { label: "Boids vs Black Hole", config: BOIDS_PRESET }
};
