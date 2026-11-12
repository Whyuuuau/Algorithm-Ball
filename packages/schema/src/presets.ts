import { ProjectConfig, ProjectConfigInput, ProjectConfigSchema } from "./schema.js";

const make = (input: ProjectConfigInput): ProjectConfig => ProjectConfigSchema.parse(input);

/* ============================================================================
 * 17 UNIQUE, NON-DUPLICATE FLAGSHIP CONTENT PRESETS ACROSS 9 ENGINES
 * Zero clones · Zero copied captions · 9:16 Safe-Zone Calibrated
 * ========================================================================== */

/** 1. Harmonic Pendulum Wave Harp (Seamless 60s Phase Cycle + Liquid Ribbon) */
export const PENDULUM_WAVE_PRESET: ProjectConfig = make({
  seed: 2025,
  meta: { title: "Harmonic Pendulum Wave Harp", duration_sec: 60 },
  arc: {
    hook_text: "18 TUNED STRINGS\nWAIT FOR THE 60s RE-ALIGNMENT",
    hook_duration_sec: 12,
    calm_outro_sec: 3.0
  },
  physics: { gravity: [0, 0], restitution_default: 1.0, bounce_kick: 0 },
  sound: {
    palette: "kalimba_glow",
    scale: { root: "F4", mode: "pentatonic_major", octaves: 4 },
    note_mapping: "index_degree",
    reverb: { enabled: true, mix: 0.42, size: 0.88 }
  },
  look: {
    background: "#040711",
    background_style: "radial_vignette",
    ball_style: "shaded_sphere",
    color_mode: "rainbow",
    trail: { enabled: true, fade_alpha: 0.18 },
    glow: 1.5,
    vignette: 0.45,
    hud: { hook_y: 205, hook_size: 46, timer_y: 310, timer_size: 52, accent: "#38bdf8", show_timer: false }
  },
  scene: {
    type: "PENDULUM_WAVE",
    count: 18,
    base_cycles: 24,
    cycle_step: 1,
    amplitude_px: 370,
    pivot_y: 340,
    string_length_px: 960,
    bob_radius: 13,
    trigger: "center",
    show_strings: true,
    show_rest_marks: true,
    wave_ribbon: true
  }
});

/** 2. Chromatic Prism Chamber (Breathing Heptagon Acoustic Refracting Polygon) */
export const PRISM_CHAMBER_PRESET: ProjectConfig = make({
  seed: 4040,
  meta: { title: "Chromatic Prism Chamber", duration_sec: 55 },
  arc: {
    hook_text: "7 TUNED GLASS WALLS\nEVERY 4 BOUNCES REFRACTS LIGHT",
    hook_duration_sec: 14,
    calm_outro_sec: 2.5
  },
  physics: {
    gravity: [0, 0.25],
    restitution_default: 1.0,
    bounce_kick: 0.08,
    speed_lock: 22,
    max_speed: 38
  },
  sound: {
    palette: "crystal_bowl",
    scale: { root: "E4", mode: "hirajoshi", octaves: 3 },
    note_mapping: "index_degree",
    reverb: { enabled: true, mix: 0.40, size: 0.88 }
  },
  look: {
    background: "#060813",
    background_style: "radial_vignette",
    ball_style: "neon_ring",
    color_mode: "rainbow",
    trail: { enabled: true, fade_alpha: 0.20 },
    glow: 1.55,
    vignette: 0.4,
    hud: { hook_y: 235, accent: "#22d3ee", show_timer: false }
  },
  scene: {
    type: "PRISM_CHAMBER",
    sides: 7,
    radius: 410,
    spin: 0.45,
    breathe_amp: 0.12,
    breathe_speed: 1.4,
    initial_balls: 3,
    ball_radius: 11,
    hits_per_split: 4,
    max_balls: 160,
    inherit_color: true
  }
});

/** 3. Precessing Vesica Caustic Mandala (Rotating Specular Optical Lens) */
export const OPTICAL_MIRRORS_PRESET: ProjectConfig = make({
  seed: 1616,
  meta: { title: "Sacred Lens Caustic Mandala", duration_sec: 50 },
  arc: {
    hook_text: "24 PRISMATIC LIGHT RAYS\nTRAPPED IN A PRECESSING LENS",
    hook_duration_sec: 50,
    calm_outro_sec: 2.5
  },
  physics: { gravity: [0, 0], restitution_default: 1.0, bounce_kick: 0 },
  sound: {
    palette: "celesta_chime",
    scale: { root: "G4", mode: "lydian", octaves: 3 },
    note_mapping: "index_degree",
    reverb: { enabled: true, mix: 0.38, size: 0.86 }
  },
  look: {
    background: "#04060c",
    background_style: "radial_vignette",
    ball_style: "sparkle_particle",
    color_mode: "rainbow",
    trail: { enabled: true, fade_alpha: 0.14 },
    glow: 1.65,
    vignette: 0.4,
    hud: { hook_y: 215, hook_size: 46, show_timer: false, accent: "#38bdf8" }
  },
  scene: {
    type: "OPTICAL_MIRRORS",
    mirror_shape: "vesica_piscis",
    mirror_spin: 0.14,
    width_px: 680,
    height_px: 1060,
    ball_count: 24,
    ball_radius: 7.5,
    ball_speed: 22,
    origin_offset_y: 0,
    spread_deg: 360,
    show_rays: true,
    show_grid: true,
    mirror_color: "#22d3ee"
  }
});

/** 4. Chrono-Pendulum Goblet Surge (Overflow Bowl Reimagined as Chalice Vessel) */
export const OVERFLOW_BOWL_PRESET: ProjectConfig = make({
  seed: 747,
  meta: { title: "Chrono-Pendulum Goblet Surge", duration_sec: 50 },
  arc: {
    hook_text: "ONE PENDULUM CHALICE\nHOW LONG UNTIL IT SURGES OVER?",
    hook_duration_sec: 50,
    calm_outro_sec: 2.5
  },
  physics: { gravity: [0, 12], restitution_default: 0.92, max_speed: 55 },
  sound: {
    palette: "water_drop",
    scale: { root: "C4", mode: "pentatonic_major", octaves: 4 },
    reverb: { enabled: true, mix: 0.34, size: 0.85 }
  },
  look: {
    background: "#04080f",
    background_style: "aurora_gradient",
    ball_style: "shaded_sphere",
    color_mode: "rainbow",
    glow: 1.25,
    vignette: 0.35,
    hud: { hook_y: 230, show_timer: false, accent: "#38bdf8" }
  },
  scene: {
    type: "OVERFLOW_BOWL",
    bowl_shape: "goblet_funnel",
    bowl_radius: 400,
    rim_angle_deg: 82,
    wedge_angle_deg: 20,
    swing_amplitude_deg: 54,
    swing_speed: 2.05,
    initial_balls: 2,
    ball_radius: 8.5,
    split_on_hit: true,
    split_cooldown_ms: 210,
    bowl_color: "#7dd3fc",
    wedge_color: "#e2e8f0"
  }
});

/** 5. Galton Probability Bell Curve (Funnel Pin Matrix + Hirajoshi Kalimba) */
export const GALTON_BOARD_PRESET: ProjectConfig = make({
  seed: 8888,
  meta: { title: "Galton Probability Bell Curve", duration_sec: 60 },
  arc: { hook_text: "HARMONIC FUNNEL PINS\nSCULPTING A NORMAL BELL CURVE" },
  physics: { gravity: [0, 11.5], restitution_default: 0.95, bounce_kick: 3 },
  sound: {
    palette: "kalimba_glow",
    scale: { root: "D4", mode: "hirajoshi", octaves: 3 },
    reverb: { enabled: true, mix: 0.30, size: 0.82 }
  },
  look: {
    background: "#05060b",
    background_style: "radial_vignette",
    ball_style: "glow",
    floor_style: "neon_laser",
    glow: 1.55,
    vignette: 0.45,
    hud: { hook_y: 195, hook_size: 44, timer_y: 300, timer_size: 52 }
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: { mode: "manual", values: [15, 35, 80, 180, 400, 900, 2000, 4500, 10000, 22000] },
    lanes: [
      { id: "gold", label: "AMBER ×1.8", color: "#ffd166", initial_balls: 2, ball_radius: 8, on_floor_break: { op: "MULTIPLY", value: 1.8 } },
      { id: "cyan", label: "AQUA +4", color: "#00e5ff", initial_balls: 4, ball_radius: 7, on_floor_break: { op: "ADD", value: 4 } },
      { id: "emerald", label: "MINT +3", color: "#06d6a0", initial_balls: 3, ball_radius: 7.5, on_floor_break: { op: "ADD", value: 3 } }
    ],
    pegs: { enabled: true, pattern: "funnel", rows: 8, per_row: 7, radius: 8, top: 0.20, bottom: 0.36 }
  }
});

/** 6. The Exponential Gambit: 1 Orb (×8) vs 512 Orbs (×2) */
export const DUEL_1_VS_1000_PRESET: ProjectConfig = make({
  seed: 10001,
  meta: { title: "The Exponential Gambit: 1 vs 512", duration_sec: 48 },
  arc: {
    hook_text: "1 ORB (×8) VS 512 ORBS (×2)\nWHICH POWER CURVE CONQUERS FLOOR 8?",
    hook_duration_sec: 48,
    calm_outro_sec: 2.5
  },
  physics: { gravity: [0, 12], restitution_default: 0.99, bounce_kick: 4, bounce_min_speed: 12 },
  sound: {
    palette: "marimba_wood",
    scale: { root: "D4", mode: "pentatonic_major", octaves: 3 },
    reverb: { enabled: true, mix: 0.24, size: 0.72 }
  },
  look: {
    background: "#05070b",
    background_style: "solid",
    ball_style: "glow",
    tower_hud_style: "duel_cards",
    glow: 1.35,
    vignette: 0.28,
    hud: { hook_y: 220, timer_y: 320, timer_size: 44, hook_size: 48, show_timer: false }
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: {
      mode: "manual",
      values: [16, 64, 256, 1024, 4096, 16384, 65536, 262144]
    },
    lanes: [
      { id: "swarm", label: "×2 SWARM", color: "#2dd4bf", initial_balls: 512, ball_radius: 5.5, on_floor_break: { op: "MULTIPLY", value: 2 } },
      { id: "solo", label: "×8 SOLO", color: "#fb7185", initial_balls: 1, ball_radius: 9, on_floor_break: { op: "MULTIPLY", value: 8 } }
    ],
    pegs: { enabled: false },
    floor_thickness: 14
  }
});

/** 7. Hexagonal Quantum Centrifuge (Reimagined Cube Arena) */
export const CUBE_ARENA_PRESET: ProjectConfig = make({
  seed: 2026,
  meta: { title: "Hexagonal Quantum Centrifuge", duration_sec: 50 },
  arc: {
    hook_text: "QUANTUM CUBES INSIDE A HEX VAULT\nEVERY ESCAPE SPLITS +2 MORE",
    hook_duration_sec: 50,
    calm_outro_sec: 2.5
  },
  physics: { gravity: [0, 7.2], restitution_default: 0.99, max_speed: 44 },
  sound: {
    palette: "glass_bell",
    scale: { root: "E4", mode: "hirajoshi", octaves: 3 },
    reverb: { enabled: true, mix: 0.32, size: 0.82 }
  },
  look: {
    background: "#04050a",
    background_style: "radial_vignette",
    ball_style: "neon_cube",
    color_mode: "rainbow",
    glow: 1.4,
    vignette: 0.38,
    hud: { hook_y: 230, show_timer: false, accent: "#22d3ee" }
  },
  scene: {
    type: "CUBE_ARENA",
    chamber_shape: "hexagon",
    outer_radius: 440,
    cross_blades: 6,
    cross_speed: 0.72,
    cage_enabled: true,
    cage_size: 138,
    cage_speed: -1.05,
    initial_cubes: 16,
    cube_size: 13,
    split_on_escape: 2,
    split_on_blade: 0,
    wall_color: "#38bdf8",
    cage_color: "#f8fafc",
    max_cubes: 420
  }
});

/** 8. Cyberpunk 4-Faction Cathedral Siege */
export const CYBERPUNK_ROYALE_PRESET: ProjectConfig = make({
  seed: 2099,
  meta: { title: "4-Faction Cyber Laser Siege", duration_sec: 50 },
  arc: { hook_text: "4 CYBER FACTIONS vs CATHEDRAL PINS\nWHO BREACHES SECTOR 10?" },
  physics: { gravity: [0, 11], restitution_default: 1.0, bounce_kick: 5 },
  sound: {
    palette: "synth_pluck",
    scale: { root: "A2", mode: "dorian", octaves: 3 },
    quantizer: { mode: "GRID", bpm: 136, progression: ["i", "VI", "III", "VII"] },
    escalation: { drone: true, drone_gain_db: -11 }
  },
  look: {
    background: "#060611",
    background_style: "cyber_grid",
    ball_style: "glow",
    floor_style: "neon_laser",
    bloom: { enabled: true, intensity: 1.55, blur: 12 },
    chromatic_aberration: 4,
    vignette: 0.4,
    hud: { hook_y: 195, hook_size: 44, timer_y: 300, timer_size: 52 }
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: { mode: "exponential", base: 24, growth: 1.72, count: 10 },
    lanes: [
      { id: "cyan", label: "×2 CYBER", color: "#00f5d4", initial_balls: 2, ball_radius: 8, on_floor_break: { op: "MULTIPLY", value: 2 } },
      { id: "pink", label: "+5 NEON", color: "#f72585", initial_balls: 5, ball_radius: 7, on_floor_break: { op: "ADD", value: 5 } },
      { id: "yellow", label: "×1.8 ACID", color: "#fee440", initial_balls: 3, ball_radius: 7.5, on_floor_break: { op: "MULTIPLY", value: 1.8 } },
      { id: "purple", label: "+7 VOID", color: "#a855f7", initial_balls: 6, ball_radius: 6.5, on_floor_break: { op: "ADD", value: 7 } }
    ],
    pegs: { enabled: true, pattern: "cathedral", rows: 6, per_row: 4, top: 0.20, bottom: 0.36 }
  }
});

/** 9. Mechanical Keyswitch Pachinko Cascade (1-Ball Thock Avalanche) */
export const PACHINKO_THOCK_PRESET: ProjectConfig = make({
  seed: 9876,
  meta: { title: "Custom Keyswitch Pachinko ASMR", duration_sec: 60 },
  arc: {
    hook_text: "1 THOCKY BALL TRIGGERS A CASCADE\nPURE MECHANICAL SWITCH ACOUSTICS",
    hook_duration_sec: 10,
    calm_outro_sec: 3.0
  },
  physics: { gravity: [0, 12.2], restitution_default: 1.0, bounce_kick: 5, bounce_min_speed: 11 },
  sound: {
    palette: "thocky_keys",
    scale: { root: "F3", mode: "blues", octaves: 3 },
    wall_ticks: true
  },
  look: {
    background: "#08080b",
    background_style: "radial_vignette",
    ball_style: "shaded_sphere",
    floor_style: "striped_warning",
    vignette: 0.4,
    hud: { hook_y: 195, hook_size: 44, timer_y: 300, timer_size: 52 }
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: { mode: "manual", values: [12, 28, 65, 190, 540, 1500, 4000, 10500] },
    lanes: [
      { id: "pachinko", label: "1-BALL AVALANCHE", color: "#ffd166", initial_balls: 1, ball_radius: 8.5, on_floor_break: { op: "EXPLODE", value: 2.5 } }
    ],
    pegs: { enabled: true, pattern: "staggered", rows: 9, per_row: 8, radius: 9.5, top: 0.20, bottom: 0.36 }
  }
});

/** 10. 1-Orb Evolution Trial (Progressive Mutating Power-Ups to 1,000,000) */
export const ONE_BALL_JOURNEY_PRESET: ProjectConfig = make({
  seed: 20261110,
  meta: { title: "1-Orb Evolution to 1,000,000 (60s)", duration_sec: 60 },
  arc: {
    hook_text: "1 SOLITARY ORB MUTATES EVERY FLOOR\nCAN IT REACH 1,000,000 IN 60s?",
    hook_duration_sec: 10,
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
    palette: "handpan_steel",
    scale: { root: "C4", mode: "hirajoshi", octaves: 4 },
    note_mapping: "melodic_step",
    spatial: { pan: true, y_filter: true },
    reverb: { enabled: true, mix: 0.34, size: 0.85 }
  },
  look: {
    background: "#050711",
    background_style: "radial_vignette",
    ball_style: "glow",
    floor_style: "neon_laser",
    glow: 1.75,
    vignette: 0.45,
    hud: { hook_y: 195, hook_size: 44, timer_y: 300, timer_size: 52 }
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: { mode: "manual", values: [10, 26, 60, 180, 520, 1400, 3800, 9500] },
    lanes: [
      {
        id: "hero",
        label: "EVOLVING ORB",
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
    pegs: { enabled: true, pattern: "diamond", rows: 7, per_row: 6, radius: 9, top: 0.20, bottom: 0.36 }
  }
});

/** 11. Celestial Polyrhythm Astrarium (16 Concentric Orbits + Constellation Links) */
export const POLY_ORBIT_PRESET: ProjectConfig = make({
  seed: 3030,
  meta: { title: "Celestial Polyrhythm Astrarium", duration_sec: 60 },
  arc: {
    hook_text: "16 ORBITAL HARMONIC RINGS\nALL PLANETS CONVERGE AT 60s",
    hook_duration_sec: 12,
    calm_outro_sec: 3.0
  },
  physics: { gravity: [0, 0], restitution_default: 1.0, bounce_kick: 0 },
  sound: {
    palette: "celesta_chime",
    scale: { root: "D4", mode: "dorian", octaves: 4 },
    note_mapping: "index_degree",
    reverb: { enabled: true, mix: 0.45, size: 0.90 }
  },
  look: {
    background: "#05040d",
    background_style: "deep_space_stars",
    ball_style: "glow",
    color_mode: "rainbow",
    trail: { enabled: true, fade_alpha: 0.15 },
    glow: 1.65,
    vignette: 0.45,
    hud: { hook_y: 230, accent: "#c084fc", show_timer: false }
  },
  scene: {
    type: "POLY_ORBIT",
    orbits: 16,
    inner_radius: 85,
    outer_radius: 445,
    first_ratio: 10,
    ratio_step: 1,
    gates: 2,
    planet_radius: 11,
    direction_mode: "same",
    show_gates: true,
    constellation_links: true
  }
});

/** 12. Handpan Ring Break Sanctuary (Fragile Concentric Rings with Steel Tongue Drum) */
export const MAZE_RINGS_PRESET: ProjectConfig = make({
  seed: 4242,
  meta: { title: "Solar Handpan Gravity Vault", duration_sec: 60 },
  arc: {
    hook_text: "5 SHATTERING ORBIT LOCKS\nHANDPAN STEEL ACOUSTIC ESCAPE",
    tension_curve: [[0, 0.15], [0.3, 0.4], [0.7, 0.75], [0.9, 1], [1, 0.3]]
  },
  physics: { gravity: [0, 0], speed_lock: 26, restitution_default: 1, bounce_kick: 0 },
  sound: {
    palette: "handpan_steel",
    scale: { root: "C4", mode: "pentatonic_minor", octaves: 3 },
    reverb: { enabled: true, mix: 0.38, size: 0.86 }
  },
  look: {
    background: "#05070e",
    background_style: "radial_vignette",
    ball_style: "neon_ring",
    glow: 1.5,
    hud: { hook_y: 230, timer_y: 350, timer_size: 56 }
  },
  scene: {
    type: "MAZE_ESCAPE",
    initial_balls: 12,
    ball_radius: 8,
    balls_to_escape: 80,
    spawn_on_escape: 1,
    rings: [
      { radius: 110, thickness: 12, angular_speed: 1.35, gap_angle_deg: 52, durability: 20, color: "#38bdf8" },
      { radius: 195, thickness: 12, angular_speed: -1.05, gap_angle_deg: 48, durability: 26, color: "#818cf8" },
      { radius: 280, thickness: 13, angular_speed: 1.55, gap_angle_deg: 44, durability: 34, color: "#c084fc" },
      { radius: 365, thickness: 13, angular_speed: -1.2, gap_angle_deg: 40, durability: 42, color: "#f472b6" },
      { radius: 450, thickness: 14, angular_speed: 0.9, gap_angle_deg: 36, durability: 0, color: "#fb7185" }
    ]
  }
});

/** 13. 432 Hz Tibetan Crystal Aurora Vortex (Slow Deep Meditative Escape) */
export const SINGING_BOWL_PRESET: ProjectConfig = make({
  seed: 432,
  meta: { title: "432 Hz Aurora Crystal Sanctuary", duration_sec: 60 },
  arc: { hook_text: "432 Hz SINGING BOWLS\nSLOW DREAMSCAPE MEDITATION" },
  physics: { gravity: [0, 0], speed_lock: 19, restitution_default: 0.98, bounce_kick: 1 },
  sound: {
    palette: "crystal_bowl",
    scale: { root: "A3", mode: "whole_tone", octaves: 3 },
    reverb: { enabled: true, mix: 0.48, size: 0.94 }
  },
  look: {
    background: "#03020a",
    background_style: "aurora_gradient",
    ball_style: "glow",
    bloom: { enabled: true, intensity: 1.8, blur: 14 },
    vignette: 0.55,
    hud: { hook_y: 230, timer_y: 350, timer_size: 56 }
  },
  scene: {
    type: "MAZE_ESCAPE",
    initial_balls: 8,
    ball_radius: 9,
    color: "#e2b8ff",
    ring_color: "#7c3aed",
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

/** 14–17. Algorithm Arena Quartet (4 Zero-Overlap Scientific Arenas) */
const arena = (
  title: string,
  algorithm: "FALLING_SAND" | "TSP_2OPT" | "BFS_LIGHTNING" | "BOIDS",
  palette: "kalimba_glow" | "glass_bell" | "water_drop" | "marimba_wood" | "synth_pluck" | "music_box" | "crystal_bowl" | "cosmic_laser" | "handpan_steel" | "celesta_chime",
  hook: string,
  extraLook?: Record<string, unknown>
): ProjectConfig =>
  make({
    seed: 99,
    meta: { title },
    arc: { hook_text: hook },
    sound: { palette, quantizer: { mode: "HARMONIC" } },
    look: { hud: { hook_y: 230, timer_y: 350, timer_size: 56 }, ...(extraLook ?? {}) } as any,
    scene: { type: "ALGORITHM_ARENA", algorithm }
  });

export const SAND_PRESET = arena("Falling Sand Alchemist", "FALLING_SAND", "water_drop", "SAND + LAVA + WATER + ICE\nTHERMODYNAMIC CHAIN REACTIONS");
export const TSP_PRESET = arena("TSP 2-Opt Geometric Untangler", "TSP_2OPT", "music_box", "400 ENTANGLED NODES\nUNTANGLING INTO THE SHORTEST LOOP");
export const LIGHTNING_PRESET = arena("BFS vs Fractal Lightning", "BFS_LIGHTNING", "kalimba_glow", "UNIFORM BFS vs FRACTAL LIGHTNING\nWHICH ALGORITHM STRIKES FIRST?");
export const BOIDS_PRESET = arena("Cosmic Boids vs Singularity", "BOIDS", "cosmic_laser", "8,000 FLOCKING STARLINGS\nBATTLING A BLACK HOLE WELL", {
  background: "#020108",
  background_style: "deep_space_stars",
  scanlines: 0.3,
  bloom: { enabled: true, intensity: 1.5, blur: 10 }
});

/** Backward-compatible test & default references (not duplicated in gallery) */
export const CLASSIC_3_TOWERS_PRESET: ProjectConfig = GALTON_BOARD_PRESET;

export interface PresetItem {
  label: string;
  category: "Satisfying & ASMR" | "High Tension & Battle" | "Sci-Fi & Cosmic" | "Algorithm & Arena";
  description: string;
  config: ProjectConfig;
}

export const PRESETS: Record<string, PresetItem> = {
  // Satisfying & ASMR (5 unique archetypes)
  pendulum_wave: {
    label: "Harmonic Pendulum Wave Harp",
    category: "Satisfying & ASMR",
    description: "18 phase-locked strings with a glowing silk ribbon braiding into spirals and aligning perfectly at 60s",
    config: PENDULUM_WAVE_PRESET
  },
  prism_chamber: {
    label: "Chromatic Prism Chamber",
    category: "Satisfying & ASMR",
    description: "Breathing 7-sided acoustic prism where walls sing in Hirajoshi scale, transfer hue, and refract orbs",
    config: PRISM_CHAMBER_PRESET
  },
  optical_mirrors: {
    label: "Sacred Lens Caustic Mandala",
    category: "Satisfying & ASMR",
    description: "24 prismatic light rays inside a gently rotating Vesica Piscis optical lens paired with celesta chimes",
    config: OPTICAL_MIRRORS_PRESET
  },
  overflow_bowl: {
    label: "Chrono-Pendulum Goblet Surge",
    category: "Satisfying & ASMR",
    description: "Chalice vessel with live fill gauge & sweeping pendulum where bouncing droplets multiply until overflow",
    config: OVERFLOW_BOWL_PRESET
  },
  galton_board: {
    label: "Galton Probability Bell Curve",
    category: "Satisfying & ASMR",
    description: "Inverted funnel peg matrix sculpting chaotic marbles into a musical Gaussian bell curve",
    config: GALTON_BOARD_PRESET
  },

  // High Tension & Battle (5 unique archetypes)
  duel_1_vs_1000: {
    label: "The Exponential Gambit: 1 vs 512",
    category: "High Tension & Battle",
    description: "Broadcast Duel HUD pitting 1 solo ×8 orb against a 512-orb ×2 swarm across 8 power-of-4 floors",
    config: DUEL_1_VS_1000_PRESET
  },
  cube_arena: {
    label: "Hexagonal Quantum Centrifuge",
    category: "High Tension & Battle",
    description: "Spinning hexagonal chamber + counter-rotating vault cage trapping neon cubes that split on every escape",
    config: CUBE_ARENA_PRESET
  },
  cyberpunk_royale: {
    label: "4-Faction Cyber Laser Siege",
    category: "High Tension & Battle",
    description: "4 asymmetric factions battling through cathedral pins and laser barriers locked to a 136 BPM synth pulse",
    config: CYBERPUNK_ROYALE_PRESET
  },
  pachinko_thock: {
    label: "Custom Keyswitch Pachinko ASMR",
    category: "High Tension & Battle",
    description: "Single-ball avalanche cascading through dense pachinko pins with creamy lubed keyboard thock acoustics",
    config: PACHINKO_THOCK_PRESET
  },
  one_ball_journey: {
    label: "1-Orb Evolution to 1,000,000",
    category: "High Tension & Battle",
    description: "Solo hero orb mutating through diamond pins with Handpan steel overtones toward a 60s finale",
    config: ONE_BALL_JOURNEY_PRESET
  },

  // Sci-Fi & Cosmic (3 unique archetypes)
  poly_orbit: {
    label: "Celestial Polyrhythm Astrarium",
    category: "Sci-Fi & Cosmic",
    description: "16 concentric orbits connected by luminous constellation threads striking celesta chords on radial gates",
    config: POLY_ORBIT_PRESET
  },
  maze_rings: {
    label: "Solar Handpan Gravity Vault",
    category: "Sci-Fi & Cosmic",
    description: "5 concentric rotating vault rings with shatter durability and resonant metallic handpan harmonics",
    config: MAZE_RINGS_PRESET
  },
  tibetan_crystal_bowl: {
    label: "432 Hz Aurora Crystal Sanctuary",
    category: "Sci-Fi & Cosmic",
    description: "Ultra-calm slow orbit escape tuned to whole-tone 432 Hz crystal bowls with deep aurora bloom",
    config: SINGING_BOWL_PRESET
  },

  // Algorithm & Arena (4 unique archetypes)
  falling_sand: {
    label: "Falling Sand Alchemist",
    category: "Algorithm & Arena",
    description: "Cellular automata thermodynamics simulating reactive sand, water, lava, obsidian, and steam",
    config: SAND_PRESET
  },
  tsp_2opt: {
    label: "TSP 2-Opt Geometric Untangler",
    category: "Algorithm & Arena",
    description: "Real-time 400-node Traveling Salesperson optimization untangling into a music-box geometric circuit",
    config: TSP_PRESET
  },
  bfs_lightning: {
    label: "BFS Wavefront vs Fractal Lightning",
    category: "Algorithm & Arena",
    description: "Algorithm race between uniform Breadth-First Search and stochastic Laplacian lightning discharge",
    config: LIGHTNING_PRESET
  },
  boids: {
    label: "Cosmic Boids vs Singularity",
    category: "Algorithm & Arena",
    description: "8,000 flocking cosmic agents battling a central black hole singularity with retro sci-fi laser sweeps",
    config: BOIDS_PRESET
  }
};
