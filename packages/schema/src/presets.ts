import { ProjectConfig, ProjectConfigInput, ProjectConfigSchema } from "./schema.js";

const make = (input: ProjectConfigInput): ProjectConfig => ProjectConfigSchema.parse(input);

/** 3 lane Tower Breaker – "Who breaks floor 10 first". */
export const CLASSIC_3_TOWERS_PRESET: ProjectConfig = make({
  seed: 20261110,
  meta: { title: "3 Towers Classic - 60s" },
  scene: { type: "TOWER_BREAKER" }
});

/** Exponential HP, 2 lanes, glass-bell palette. */
export const DUEL_2_LANES_PRESET: ProjectConfig = make({
  seed: 777,
  meta: { title: "Duel 2 Lanes - 45s", duration_sec: 45 },
  arc: { hook_text: "2 TOWERS. 1 WINNER.\nWHO REACHES THE BOTTOM FIRST?" },
  sound: { palette: "glass_bell", scale: { root: "D4", mode: "dorian", octaves: 3 } },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: { mode: "exponential", base: 20, growth: 1.75, count: 9 },
    lanes: [
      { id: "red", label: "x2 / FLOOR", color: "#ff3b6b", initial_balls: 2, ball_radius: 8, on_floor_break: { op: "MULTIPLY", value: 2 } },
      { id: "blue", label: "+4 / FLOOR", color: "#3b9bff", initial_balls: 4, ball_radius: 7, on_floor_break: { op: "ADD", value: 4 } }
    ],
    pegs: { rows: 6, per_row: 5 }
  }
});

/** Concentric rotating rings, zero gravity. */
export const MAZE_RINGS_PRESET: ProjectConfig = make({
  seed: 4242,
  meta: { title: "5 Rings Maze Escape - 60s" },
  arc: { hook_text: "5 ROTATING RINGS. 1 ESCAPE ROUTE.\nCAN ALL BALLS BREAK FREE?", tension_curve: [[0, 0.15], [0.3, 0.4], [0.7, 0.75], [0.9, 1], [1, 0.3]] },
  physics: { gravity: [0, 0], speed_lock: 26, restitution_default: 1, bounce_kick: 0 },
  sound: { palette: "marimba_wood", scale: { root: "C4", mode: "pentatonic_minor", octaves: 3 } },
  scene: {
    type: "MAZE_ESCAPE",
    initial_balls: 12,
    ball_radius: 8,
    balls_to_escape: 80,
    spawn_on_escape: 1
  }
});

const arena = (
  title: string,
  algorithm: "FALLING_SAND" | "TSP_2OPT" | "BFS_LIGHTNING" | "BOIDS",
  palette: "kalimba_glow" | "glass_bell" | "water_drop" | "marimba_wood" | "synth_pluck" | "music_box" | "crystal_bowl" | "cosmic_laser",
  hook: string,
  extraLook?: Record<string, unknown>
): ProjectConfig =>
  make({
    seed: 99,
    meta: { title },
    arc: { hook_text: hook },
    sound: { palette, quantizer: { mode: "HARMONIC" } },
    look: extraLook ? (extraLook as any) : {},
    scene: { type: "ALGORITHM_ARENA", algorithm }
  });

export const SAND_PRESET = arena("Falling Sand Alchemist", "FALLING_SAND", "water_drop", "SAND + LAVA + WATER\nWHAT REACTIONS WILL OCCUR?");
export const TSP_PRESET = arena("TSP 2-Opt Untangling", "TSP_2OPT", "glass_bell", "SHORTEST CIRCUIT TOUR\nUNTANGLED IN 60 SECONDS");
export const LIGHTNING_PRESET = arena("BFS vs Fractal Lightning", "BFS_LIGHTNING", "kalimba_glow", "BREADTH-FIRST SEARCH vs LIGHTNING\nWHO REACHES THE TARGET FIRST?");
export const BOIDS_PRESET = arena("Boids Flocking vs Black Hole", "BOIDS", "glass_bell", "THOUSANDS OF FLOCKING BOIDS\nESCAPING THE SINGULARITY");

/** 8. Galton Board (Normal Distribution Bell Curve ASMR) */
export const GALTON_BOARD_PRESET: ProjectConfig = make({
  seed: 8888,
  meta: { title: "Galton Board - Normal Distribution", duration_sec: 60 },
  arc: { hook_text: "BALLS vs 108 HARMONIC PEGS\nFORMING A PERFECT BELL CURVE" },
  physics: { gravity: [0, 11.5], restitution_default: 0.95, bounce_kick: 3 },
  sound: {
    palette: "kalimba_glow",
    scale: { root: "D4", mode: "hirajoshi", octaves: 3 },
    reverb: { enabled: true, mix: 0.28, size: 0.8 }
  },
  look: {
    background: "#05060b",
    background_style: "radial_vignette",
    ball_style: "glow",
    floor_style: "neon_laser",
    glow: 1.6,
    vignette: 0.45
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: {
      mode: "manual",
      values: [15, 35, 80, 180, 400, 900, 2000, 4500, 10000, 22000]
    },
    lanes: [
      { id: "gold", label: "GOLD CASCADE", color: "#ffd166", initial_balls: 2, ball_radius: 8, on_floor_break: { op: "MULTIPLY", value: 1.8 } },
      { id: "cyan", label: "CYAN SHOWER", color: "#00e5ff", initial_balls: 4, ball_radius: 7, on_floor_break: { op: "ADD", value: 4 } },
      { id: "emerald", label: "EMERALD BELL", color: "#06d6a0", initial_balls: 3, ball_radius: 7.5, on_floor_break: { op: "ADD", value: 3 } }
    ],
    pegs: { enabled: true, rows: 12, per_row: 9, radius: 8, top: 0.12, bottom: 0.52 }
  }
});

/** 9. Black Hole Singularity Orbit (Concentric 8-Ring Vortex) */
export const BLACK_HOLE_SPIRAL_PRESET: ProjectConfig = make({
  seed: 1337,
  meta: { title: "Black Hole Singularity Orbit", duration_sec: 60 },
  arc: { hook_text: "8 COSMIC GRAVITY RINGS\nCAN THEY ESCAPE THE SINGULARITY?" },
  physics: { gravity: [0, 0], speed_lock: 34, restitution_default: 1.0, bounce_kick: 6 },
  sound: {
    palette: "synth_pluck",
    scale: { root: "E3", mode: "dorian", octaves: 4 },
    reverb: { enabled: true, mix: 0.35, size: 0.85 }
  },
  look: {
    background: "#030208",
    background_style: "deep_space_stars",
    ball_style: "neon_ring",
    glow: 1.8,
    chromatic_aberration: 6,
    vignette: 0.5
  },
  scene: {
    type: "MAZE_ESCAPE",
    initial_balls: 16,
    ball_radius: 7,
    color: "#00f0ff",
    ring_color: "#b026ff",
    balls_to_escape: 120,
    spawn_on_escape: 1,
    rings: [
      { radius: 80, thickness: 10, angular_speed: 2.4, gap_angle_deg: 32, durability: 0 },
      { radius: 140, thickness: 10, angular_speed: -1.9, gap_angle_deg: 30, durability: 0 },
      { radius: 200, thickness: 10, angular_speed: 2.6, gap_angle_deg: 28, durability: 0 },
      { radius: 260, thickness: 10, angular_speed: -2.1, gap_angle_deg: 34, durability: 0 },
      { radius: 320, thickness: 11, angular_speed: 1.7, gap_angle_deg: 30, durability: 0 },
      { radius: 380, thickness: 11, angular_speed: -1.4, gap_angle_deg: 32, durability: 0 },
      { radius: 440, thickness: 12, angular_speed: 1.1, gap_angle_deg: 36, durability: 0 },
      { radius: 500, thickness: 12, angular_speed: -0.8, gap_angle_deg: 38, durability: 0 }
    ]
  }
});

/** 10. Cyberpunk 4-Way Overdrive (Battle Royale) */
export const CYBERPUNK_ROYALE_PRESET: ProjectConfig = make({
  seed: 2099,
  meta: { title: "Cyberpunk 4-Way Overdrive", duration_sec: 50 },
  arc: { hook_text: "4 CYBER FACTIONS.\nWHO SURVIVES TO FLOOR 10?" },
  physics: { gravity: [0, 11], restitution_default: 1.0, bounce_kick: 5 },
  sound: {
    palette: "synth_pluck",
    scale: { root: "A2", mode: "dorian", octaves: 3 },
    quantizer: { mode: "GRID", bpm: 140, progression: ["i", "VI", "III", "VII"] },
    escalation: { drone: true, drone_gain_db: -10 }
  },
  look: {
    background: "#060611",
    background_style: "cyber_grid",
    ball_style: "glow",
    floor_style: "neon_laser",
    bloom: { enabled: true, intensity: 1.6, blur: 12 },
    chromatic_aberration: 4,
    vignette: 0.4
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: { mode: "exponential", base: 25, growth: 1.75, count: 10 },
    lanes: [
      { id: "cyan", label: "x2 CYBER", color: "#00f5d4", initial_balls: 2, ball_radius: 8, on_floor_break: { op: "MULTIPLY", value: 2 } },
      { id: "pink", label: "+5 NEON", color: "#f72585", initial_balls: 5, ball_radius: 7, on_floor_break: { op: "ADD", value: 5 } },
      { id: "yellow", label: "x1.8 ACID", color: "#fee440", initial_balls: 3, ball_radius: 7.5, on_floor_break: { op: "MULTIPLY", value: 1.8 } },
      { id: "purple", label: "+7 VOID", color: "#7209b7", initial_balls: 6, ball_radius: 6.5, on_floor_break: { op: "ADD", value: 7 } }
    ],
    pegs: { rows: 6, per_row: 4 }
  }
});

/** 11. Japanese Zen Water Garden (Hirajoshi Scale ASMR) */
export const ZEN_HIRAJOSHI_PRESET: ProjectConfig = make({
  seed: 108,
  meta: { title: "Japanese Zen Water (Hirajoshi)", duration_sec: 60 },
  arc: { hook_text: "ORGANIC WATER DROPS ASMR\nDEEP RELAXATION & PEACE" },
  physics: { gravity: [0, 8.5], restitution_default: 0.92, bounce_kick: 2 },
  sound: {
    palette: "water_drop",
    scale: { root: "C4", mode: "hirajoshi", octaves: 3 },
    spatial: { pan: true, y_filter: true, lowpass_min_hz: 800, lowpass_max_hz: 12000 },
    reverb: { enabled: true, mix: 0.38, size: 0.9 },
    cooldown_ms: 50
  },
  look: {
    background: "#03080d",
    background_style: "aurora_gradient",
    ball_style: "shaded_sphere",
    floor_style: "neon_laser",
    vignette: 0.5
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: { mode: "manual", values: [12, 30, 75, 180, 450, 1100, 2600, 6000] },
    lanes: [
      { id: "turquoise", label: "MORNING DEW", color: "#00f2fe", initial_balls: 1, ball_radius: 9, on_floor_break: { op: "ADD", value: 1 } },
      { id: "bamboo", label: "ZEN BAMBOO", color: "#4facfe", initial_balls: 2, ball_radius: 8, on_floor_break: { op: "ADD", value: 2 } }
    ],
    pegs: { rows: 7, per_row: 5, radius: 9, top: 0.16, bottom: 0.42 }
  }
});

/** 12. Antique Music Box Labyrinth */
export const MUSIC_BOX_PRESET: ProjectConfig = make({
  seed: 31415,
  meta: { title: "Antique Music Box Labyrinth", duration_sec: 55 },
  arc: { hook_text: "ANTIQUE MECHANICAL MUSIC BOX\nGOLDEN SPHERES ESCAPING" },
  physics: { gravity: [0, 0], speed_lock: 24, restitution_default: 1.0, bounce_kick: 1 },
  sound: {
    palette: "music_box",
    scale: { root: "G4", mode: "lydian", octaves: 3 },
    quantizer: { mode: "HARMONIC", bpm: 108 },
    reverb: { enabled: true, mix: 0.32, size: 0.8 }
  },
  look: {
    background: "#0c0a07",
    background_style: "radial_vignette",
    ball_style: "sparkle_particle",
    glow: 1.5,
    vignette: 0.45
  },
  scene: {
    type: "MAZE_ESCAPE",
    initial_balls: 14,
    ball_radius: 7,
    color: "#ffdf7e",
    ring_color: "#c69255",
    balls_to_escape: 80,
    spawn_on_escape: 1,
    rings: [
      { radius: 100, thickness: 11, angular_speed: 1.1, gap_angle_deg: 44, durability: 0 },
      { radius: 180, thickness: 11, angular_speed: -0.85, gap_angle_deg: 42, durability: 0 },
      { radius: 260, thickness: 11, angular_speed: 1.25, gap_angle_deg: 40, durability: 0 },
      { radius: 340, thickness: 12, angular_speed: -0.95, gap_angle_deg: 38, durability: 0 },
      { radius: 420, thickness: 12, angular_speed: 0.75, gap_angle_deg: 36, durability: 0 },
      { radius: 490, thickness: 12, angular_speed: -0.6, gap_angle_deg: 34, durability: 0 }
    ]
  }
});

/** 13. Mechanical Pachinko Frenzy */
export const PACHINKO_THOCK_PRESET: ProjectConfig = make({
  seed: 5050,
  meta: { title: "Mechanical Pachinko Frenzy", duration_sec: 45 },
  arc: { hook_text: "THOCKY MECHANICAL KEYBOARD ASMR\nULTRA SATISFYING CLICK RHYTHM" },
  physics: { gravity: [0, 13], restitution_default: 1.02, bounce_kick: 6, bounce_min_speed: 12 },
  sound: {
    palette: "thocky_keys",
    scale: { root: "F3", mode: "blues", octaves: 3 },
    wall_ticks: true
  },
  look: {
    background: "#09090b",
    background_style: "solid",
    ball_style: "shaded_sphere",
    floor_style: "striped_warning",
    vignette: 0.35
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: { mode: "manual", values: [20, 50, 120, 280, 650, 1500, 3500, 8000] },
    lanes: [
      { id: "ivory", label: "GATERON INK", color: "#f4ede4", initial_balls: 2, ball_radius: 8.5, on_floor_break: { op: "MULTIPLY", value: 1.8 } },
      { id: "teal", label: "TEALIO V2", color: "#2ec4b6", initial_balls: 4, ball_radius: 7.5, on_floor_break: { op: "ADD", value: 4 } },
      { id: "coral", label: "HOLY PANDA", color: "#e71d36", initial_balls: 3, ball_radius: 8, on_floor_break: { op: "MULTIPLY", value: 1.6 } }
    ],
    pegs: { rows: 9, per_row: 6, radius: 10, top: 0.12, bottom: 0.44 }
  }
});

/** 14. Tibetan Crystal Singing Bowl (Deep Meditation) */
export const SINGING_BOWL_PRESET: ProjectConfig = make({
  seed: 432,
  meta: { title: "Tibetan Crystal Singing Bowl", duration_sec: 60 },
  arc: { hook_text: "432 Hz HEALING VIBRATION\nRELEASE STRESS IN 60 SECONDS" },
  physics: { gravity: [0, 0], speed_lock: 20, restitution_default: 0.98, bounce_kick: 1 },
  sound: {
    palette: "crystal_bowl",
    scale: { root: "A3", mode: "whole_tone", octaves: 3 },
    reverb: { enabled: true, mix: 0.45, size: 0.92 }
  },
  look: {
    background: "#030209",
    background_style: "deep_space_stars",
    ball_style: "glow",
    bloom: { enabled: true, intensity: 1.8, blur: 14 },
    vignette: 0.55
  },
  scene: {
    type: "MAZE_ESCAPE",
    initial_balls: 8,
    ball_radius: 9,
    color: "#e2b8ff",
    ring_color: "#6b3ba6",
    balls_to_escape: 60,
    spawn_on_escape: 1,
    rings: [
      { radius: 130, thickness: 16, angular_speed: 0.45, gap_angle_deg: 50, durability: 0 },
      { radius: 240, thickness: 16, angular_speed: -0.35, gap_angle_deg: 46, durability: 0 },
      { radius: 350, thickness: 18, angular_speed: 0.5, gap_angle_deg: 42, durability: 0 },
      { radius: 460, thickness: 18, angular_speed: -0.28, gap_angle_deg: 38, durability: 0 }
    ]
  }
});

/** 15. Speedrun 25 Floors Sudden Death */
export const SPEEDRUN_FLOORS_PRESET: ProjectConfig = make({
  seed: 9999,
  meta: { title: "Speedrun 25 Glass Floors", duration_sec: 45 },
  arc: { hook_text: "25 GLASS FLOORS. 45 SECONDS.\nWILL ANY BALL SURVIVE?" },
  physics: { gravity: [0, 16], restitution_default: 1.02, bounce_min_speed: 18, bounce_kick: 6 },
  sound: {
    palette: "marimba_wood",
    scale: { root: "C3", mode: "gypsy_minor", octaves: 4 },
    quantizer: { mode: "GRID", bpm: 160 }
  },
  look: {
    background: "#080612",
    background_style: "cyber_grid",
    ball_style: "glow",
    floor_style: "glass_brick",
    chromatic_aberration: 7,
    vignette: 0.4
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: { mode: "exponential", base: 10, growth: 1.2, count: 25 },
    lanes: [
      { id: "rush", label: "HYPER RUSH", color: "#ff0055", initial_balls: 2, ball_radius: 8.5, on_floor_break: { op: "MULTIPLY", value: 1.4 } }
    ],
    pegs: { rows: 5, per_row: 5, radius: 9 }
  }
});

/** 16. Cosmic Laser Superstorm */
export const COSMIC_LASER_PRESET: ProjectConfig = arena(
  "Cosmic Laser Superstorm",
  "BOIDS",
  "cosmic_laser",
  "8,000 COSMIC PARTICLES & LASERS\nESCAPING THE BLACK HOLE",
  {
    background: "#020108",
    background_style: "deep_space_stars",
    scanlines: 0.35,
    bloom: { enabled: true, intensity: 1.5, blur: 10 }
  }
);

/** 17. One Ball to One Million (60s Signature Journey) */
export const ONE_BALL_JOURNEY_PRESET: ProjectConfig = make({
  seed: 20261110,
  meta: { title: "One Ball to 1,000,000 (60s Journey)", duration_sec: 60 },
  arc: {
    hook_text: "1 BALL. 8 FLOORS. 60 SECONDS.\nCAN 1 BALL ESCALATE TO 1,000,000?",
    hook_duration_sec: 4,
    calm_outro_sec: 3.0,
    tension_curve: [
      [0, 0.15],
      [0.2, 0.3],
      [0.5, 0.55],
      [0.85, 1.0],
      [1, 0.2]
    ]
  },
  physics: { gravity: [0, 10.5], restitution_default: 0.98, bounce_kick: 3.5, bounce_min_speed: 10 },
  sound: {
    palette: "kalimba_glow",
    scale: { root: "C4", mode: "hirajoshi", octaves: 4 },
    note_mapping: "melodic_step",
    spatial: { pan: true, y_filter: true },
    reverb: { enabled: true, mix: 0.32, size: 0.85 }
  },
  look: {
    background: "#060710",
    background_style: "radial_vignette",
    ball_style: "glow",
    floor_style: "neon_laser",
    glow: 1.8,
    vignette: 0.45
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: {
      mode: "manual",
      values: [10, 26, 60, 180, 520, 1400, 3800, 9500]
    },
    lanes: [
      {
        id: "hero",
        label: "1 BALL ESCALATION",
        color: "#00e5ff",
        initial_balls: 1,
        ball_radius: 8.5,
        on_floor_break: { op: "FOUNTAIN", value: 3 },
        floor_actions: [
          { op: "ADD", value: 1 },
          { op: "MULTIPLY", value: 2 },
          { op: "FOUNTAIN", value: 3 },
          { op: "SCALE_SPEED", value: 1.15 },
          { op: "EXPLODE", value: 3 },
          { op: "FOUNTAIN", value: 3 },
          { op: "GRAVITY_PULSE", value: 2.2 },
          { op: "EXPLODE", value: 4 }
        ]
      }
    ],
    pegs: { enabled: true, rows: 8, per_row: 6, radius: 9, top: 0.14, bottom: 0.46 }
  }
});

/** 18. The 60s Solitary Duel: Red vs Blue */
export const SOLITARY_DUEL_60S_PRESET: ProjectConfig = make({
  seed: 7777,
  meta: { title: "The 60s Solitary Duel: Red vs Blue", duration_sec: 60 },
  arc: {
    hook_text: "1 VS 1 SOLITARY BALL DUEL\nWHO CRACKS FLOOR 8 AT 60 SECONDS?",
    hook_duration_sec: 4,
    calm_outro_sec: 3.0,
    tension_curve: [
      [0, 0.2],
      [0.25, 0.35],
      [0.6, 0.65],
      [0.88, 1.0],
      [1, 0.3]
    ]
  },
  physics: { gravity: [0, 11], restitution_default: 0.99, bounce_kick: 4 },
  sound: {
    palette: "glass_bell",
    scale: { root: "D4", mode: "dorian", octaves: 4 },
    spatial: { pan: true, y_filter: true },
    reverb: { enabled: true, mix: 0.3, size: 0.8 }
  },
  look: {
    background: "#08060f",
    background_style: "cyber_grid",
    ball_style: "glow",
    floor_style: "neon_laser",
    glow: 1.9,
    chromatic_aberration: 4,
    vignette: 0.4
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: {
      mode: "manual",
      values: [12, 30, 70, 210, 600, 1600, 4200, 11000]
    },
    lanes: [
      {
        id: "red",
        label: "RED FOUNTAIN",
        color: "#ff0055",
        initial_balls: 1,
        ball_radius: 8.5,
        on_floor_break: { op: "FOUNTAIN", value: 2.2 }
      },
      {
        id: "blue",
        label: "BLUE SHOCKWAVE",
        color: "#00d4ff",
        initial_balls: 1,
        ball_radius: 8.5,
        on_floor_break: { op: "EXPLODE", value: 2.2 }
      }
    ],
    pegs: { enabled: true, rows: 7, per_row: 5, radius: 9, top: 0.15, bottom: 0.45 }
  }
});

/** 19. Zen Droplet to Harmonic Symphony (60s ASMR) */
export const ZEN_DROPLET_60S_PRESET: ProjectConfig = make({
  seed: 4321,
  meta: { title: "Zen Droplet Symphony (60s ASMR)", duration_sec: 60 },
  arc: {
    hook_text: "1 WATER DROP. 60 SECONDS.\nMEDITATIVE HEALING FREQUENCY",
    hook_duration_sec: 4,
    calm_outro_sec: 3.0
  },
  physics: { gravity: [0, 9.2], restitution_default: 0.94, bounce_kick: 2 },
  sound: {
    palette: "water_drop",
    scale: { root: "C4", mode: "hirajoshi", octaves: 3 },
    reverb: { enabled: true, mix: 0.42, size: 0.92 },
    cooldown_ms: 30
  },
  look: {
    background: "#02070e",
    background_style: "aurora_gradient",
    ball_style: "shaded_sphere",
    floor_style: "glass_brick",
    glow: 1.4,
    vignette: 0.5
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: {
      mode: "manual",
      values: [10, 24, 55, 150, 420, 1100, 2800]
    },
    lanes: [
      {
        id: "zen",
        label: "SOLITARY DROPLET",
        color: "#00e5ff",
        initial_balls: 1,
        ball_radius: 9,
        on_floor_break: { op: "FOUNTAIN", value: 2.5 }
      }
    ],
    pegs: { enabled: true, rows: 8, per_row: 6, radius: 9, top: 0.15, bottom: 0.45 }
  }
});

/** 20. Mechanical Pachinko 1-Ball Avalanche (60s) */
export const PACHINKO_1BALL_60S_PRESET: ProjectConfig = make({
  seed: 9876,
  meta: { title: "Mechanical Pachinko 1-Ball Avalanche", duration_sec: 60 },
  arc: {
    hook_text: "1 BALL STARTS AN AVALANCHE\n10,000 THOCK CLICKS IN 60s",
    hook_duration_sec: 4,
    calm_outro_sec: 3.0
  },
  physics: { gravity: [0, 12.5], restitution_default: 1.0, bounce_kick: 5, bounce_min_speed: 11 },
  sound: {
    palette: "thocky_keys",
    scale: { root: "F3", mode: "blues", octaves: 3 },
    wall_ticks: true
  },
  look: {
    background: "#08080a",
    background_style: "radial_vignette",
    ball_style: "shaded_sphere",
    floor_style: "striped_warning",
    vignette: 0.4
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: {
      mode: "manual",
      values: [12, 28, 65, 190, 540, 1500, 4000, 10500]
    },
    lanes: [
      {
        id: "pachinko",
        label: "1-BALL AVALANCHE",
        color: "#ffd166",
        initial_balls: 1,
        ball_radius: 8.5,
        on_floor_break: { op: "EXPLODE", value: 2.5 }
      }
    ],
    pegs: { enabled: true, rows: 12, per_row: 8, radius: 9.5, top: 0.12, bottom: 0.48 }
  }
});

export interface PresetItem {
  label: string;
  category: "Satisfying & ASMR" | "High Tension & Battle" | "Sci-Fi & Cosmic" | "Algorithm & Arena";
  description: string;
  config: ProjectConfig;
}

export const PRESETS: Record<string, PresetItem> = {
  // Satisfying & ASMR
  one_ball_journey: {
    label: "One Ball to 1,000,000 (60s Journey)",
    category: "Satisfying & ASMR",
    description: "Starts with 1 solitary ball and finishes at 60s: progressive fountain bursts, explosive shockwaves, and harmonic escalation",
    config: ONE_BALL_JOURNEY_PRESET
  },
  zen_droplet_60s: {
    label: "Zen Droplet Symphony (60s ASMR)",
    category: "Satisfying & ASMR",
    description: "1 pure water droplet multiplying through 7 glass barriers into an orchestral water harp symphony at 60s",
    config: ZEN_DROPLET_60S_PRESET
  },
  galton_board: {
    label: "Galton Board Bell Curve",
    category: "Satisfying & ASMR",
    description: "Balls cascade through 108 tuned pegs to form a Gaussian distribution with Hirajoshi scale",
    config: GALTON_BOARD_PRESET
  },
  zen_hirajoshi: {
    label: "Japanese Zen Water",
    category: "Satisfying & ASMR",
    description: "Soothing natural water drops chiming along the traditional Japanese Hirajoshi pentatonic scale",
    config: ZEN_HIRAJOSHI_PRESET
  },
  vintage_music_box: {
    label: "Antique Music Box",
    category: "Satisfying & ASMR",
    description: "Nostalgic mechanical music box tines ringing inside a concentric golden ring labyrinth",
    config: MUSIC_BOX_PRESET
  },
  tibetan_crystal_bowl: {
    label: "Tibetan Crystal Singing Bowl",
    category: "Satisfying & ASMR",
    description: "Deep 432 Hz healing vibrations with meditative whole-tone harmonic waves",
    config: SINGING_BOWL_PRESET
  },
  classic_3_towers: {
    label: "3 Towers Classic",
    category: "Satisfying & ASMR",
    description: "Three parallel floor-breaker towers with kalimba glow and gentle multiplier progression",
    config: CLASSIC_3_TOWERS_PRESET
  },

  // High Tension & Battle
  solitary_duel_60s: {
    label: "The 60s Solitary Duel: Red vs Blue",
    category: "High Tension & Battle",
    description: "1 vs 1 solitary ball race: Red fountain vs Blue shockwave racing floor-by-floor to a photo-finish at 60s",
    config: SOLITARY_DUEL_60S_PRESET
  },
  pachinko_1ball_60s: {
    label: "Mechanical Pachinko 1-Ball Avalanche",
    category: "High Tension & Battle",
    description: "1 solitary ball triggers a 10,000-thock keyboard cascade through 12 rows of pegs, finishing floor 8 at 60s",
    config: PACHINKO_1BALL_60S_PRESET
  },
  cyberpunk_royale: {
    label: "Cyberpunk 4-Way Overdrive",
    category: "High Tension & Battle",
    description: "4-faction cyberpunk battle royale with neon floor lasers and punchy synth plucks",
    config: CYBERPUNK_ROYALE_PRESET
  },
  duel_2_lanes: {
    label: "Duel 2 Lanes Extreme",
    category: "High Tension & Battle",
    description: "High-stakes 2-lane duel with exponential HP floors and shimmering crystal bells",
    config: DUEL_2_LANES_PRESET
  },
  pachinko_thock: {
    label: "Mechanical Pachinko Frenzy",
    category: "High Tension & Battle",
    description: "Satisfying deep thock mechanical keyboard switches with fast pachinko pin physics",
    config: PACHINKO_THOCK_PRESET
  },
  speedrun_floors: {
    label: "Speedrun 25 Floors",
    category: "High Tension & Battle",
    description: "25 consecutive glass floors under extreme gravity with rapid marimba cadence",
    config: SPEEDRUN_FLOORS_PRESET
  },

  // Sci-Fi & Cosmic
  black_hole_spiral: {
    label: "Black Hole Singularity Orbit",
    category: "Sci-Fi & Cosmic",
    description: "8 concentric rings orbiting a cosmic black hole singularity with laser glow effects",
    config: BLACK_HOLE_SPIRAL_PRESET
  },
  maze_rings: {
    label: "5 Rings Maze Escape",
    category: "Sci-Fi & Cosmic",
    description: "Concentric rings rotating with tangential velocity physics and marimba strikes",
    config: MAZE_RINGS_PRESET
  },
  cosmic_laser: {
    label: "Cosmic Laser Superstorm",
    category: "Sci-Fi & Cosmic",
    description: "High-speed boid particle swarm with retro arcade sci-fi laser pulses",
    config: COSMIC_LASER_PRESET
  },

  // Algorithm & Arena
  falling_sand: {
    label: "Falling Sand Alchemist",
    category: "Algorithm & Arena",
    description: "Cellular automata physics simulating sand, water, lava, ice, and chemical reactions",
    config: SAND_PRESET
  },
  tsp_2opt: {
    label: "TSP 2-Opt Untangling",
    category: "Algorithm & Arena",
    description: "Tangled 400-node graph iteratively untangles into an optimal geometric loop",
    config: TSP_PRESET
  },
  bfs_lightning: {
    label: "BFS vs Fractal Lightning",
    category: "Algorithm & Arena",
    description: "Speed duel between uniform Breadth-First Search and stochastic Laplacian lightning",
    config: LIGHTNING_PRESET
  },
  boids: {
    label: "Boids vs Black Hole",
    category: "Algorithm & Arena",
    description: "Thousands of flocking boid agents struggling against gravitational singularity pull",
    config: BOIDS_PRESET
  }
};
