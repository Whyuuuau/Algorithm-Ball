import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color format must be #RRGGBB");
export const TensionPointSchema = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);

/* ------------------------------------------------------------------ */
/* Meta / Arc / Physics / Feel                                         */
/* ------------------------------------------------------------------ */
export const MetaConfigSchema = z.object({
  title: z.string().default("ASMR Video"),
  duration_sec: z.number().min(5).max(180).default(60),
  fps: z.union([z.literal(30), z.literal(60)]).default(60),
  width: z.literal(1080).default(1080),
  height: z.literal(1920).default(1920)
});

export const ArcConfigSchema = z.object({
  hook_text: z.string().default("1 MINUTE. 3 TOWERS.\nWHO BREAKS FLOOR 10 FIRST?"),
  hook_duration_sec: z.number().min(0).max(180).default(3.5),
  tension_curve: z.array(TensionPointSchema).min(2).max(12).default([
    [0, 0.2],
    [0.1, 0.35],
    [0.55, 0.6],
    [0.85, 1.0],
    [1, 0.4]
  ]),
  loop_outro_sec: z.number().min(0).max(3).default(0.6),
  /** Quiet outro grace period (sec): disables screen shake, flashes, and hit-stops near the end */
  calm_outro_sec: z.number().min(0).max(10).default(3.0)
});

export const PhysicsConfigSchema = z.object({
  pixels_per_meter: z.number().min(5).max(80).default(20),
  /** m/s^2 – multiplied by pixels_per_meter internally. */
  gravity: z.tuple([z.number(), z.number()]).default([0, 9.81]),
  substeps: z.number().int().min(1).max(8).default(4),
  /** m/s */
  max_speed: z.number().min(5).max(200).default(60),
  restitution_default: z.number().min(0).max(1.2).default(0.98),
  /** Minimum rebound speed (m/s) after hitting a floor, keeps the action alive. */
  bounce_min_speed: z.number().min(0).max(60).default(11),
  /** Random sideways kick (m/s) applied on every floor hit. */
  bounce_kick: z.number().min(0).max(30).default(4),
  /** If > 0 every ball is forced to this speed (m/s). Useful for zero-g mazes. */
  speed_lock: z.number().min(0).max(120).default(0),
  physical_cap: z.number().int().min(100).max(8000).default(3000),
  air_drag: z.number().min(0).max(0.1).default(0),
  gravity_oscillation: z.number().min(0).max(10).default(0)
});

export const FeelConfigSchema = z.object({
  hit_stop_frames: z.number().int().min(0).max(12).default(2),
  /** Floors with at least this many seconds of "weight" trigger hit-stop. Simple on/off per floor break. */
  hit_stop_on_break: z.boolean().default(true),
  shake_tension: z.number().min(0).max(1).default(0.9),
  shake_amount: z.number().min(0).max(60).default(14),
  squash_stretch: z.boolean().default(true),
  flash_on_break: z.boolean().default(true)
});

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */
export const TowerFloorActionSchema = z.object({
  op: z
    .enum([
      "NONE",
      "ADD",
      "MULTIPLY",
      "FOUNTAIN",
      "EXPLODE",
      "SCALE_SIZE",
      "SCALE_SPEED",
      "GRAVITY_PULSE"
    ])
    .default("NONE"),
  value: z.number().default(1)
});

export const TowerLaneSchema = z.object({
  id: z.string().min(1),
  label: z.string().default(""),
  color: hexColor.default("#00e5ff"),
  initial_balls: z.number().int().min(1).max(10_000_000).default(1),
  /** radius in px on the 1080x1920 canvas */
  ball_radius: z.number().min(2).max(40).default(7),
  on_floor_break: TowerFloorActionSchema.default({ op: "MULTIPLY", value: 2 }),
  /** Optional progressive per-floor action sequence [Floor 0, Floor 1, ...] */
  floor_actions: z.array(TowerFloorActionSchema).optional(),
  /** Optional per-lane override of floor HP. */
  floors_hp: z.array(z.number().positive()).optional()
});

export const FloorHpSchema = z.object({
  mode: z.enum(["manual", "exponential"]).default("manual"),
  values: z.array(z.number().positive()).min(1).max(40).default([40, 120, 300, 700, 1500, 3000, 6000, 12000, 24000, 48000]),
  /** exponential: HP[n] = round(base * growth^n) */
  base: z.number().positive().default(40),
  growth: z.number().min(1).max(10).default(2.1),
  count: z.number().int().min(1).max(40).default(10)
});

export const PegsSchema = z.object({
  enabled: z.boolean().default(true),
  pattern: z.enum(["staggered", "funnel", "diamond", "cathedral"]).default("staggered"),
  rows: z.number().int().min(1).max(14).default(5),
  per_row: z.number().int().min(1).max(12).default(4),
  /** px */
  radius: z.number().min(2).max(30).default(10),
  top: z.number().min(0.05).max(0.5).default(0.18),
  bottom: z.number().min(0.1).max(0.6).default(0.34)
});

export const TowerBreakerSceneSchema = z.object({
  type: z.literal("TOWER_BREAKER"),
  floors_hp: FloorHpSchema.default({}),
  lanes: z
    .array(TowerLaneSchema)
    .min(1)
    .max(4)
    .default([
      { id: "a", label: "x2 / FLOOR", color: "#00e5ff", initial_balls: 1, ball_radius: 8, on_floor_break: { op: "MULTIPLY", value: 2 } },
      { id: "b", label: "+3 / FLOOR", color: "#ff00aa", initial_balls: 3, ball_radius: 7, on_floor_break: { op: "ADD", value: 3 } },
      { id: "c", label: "+5 / FLOOR", color: "#d4ff00", initial_balls: 5, ball_radius: 6, on_floor_break: { op: "ADD", value: 5 } }
    ]),
  pegs: PegsSchema.default({}),
  /** seconds without a break before damage doubles (sudden death) */
  anti_stalemate_sec: z.number().min(2).max(60).default(8),
  spawn_speed: z.number().min(0).max(40).default(4),
  floor_thickness: z.number().min(4).max(40).default(16)
});

export const MazeRingSchema = z.object({
  /** px from arena centre */
  radius: z.number().min(30).max(900),
  thickness: z.number().min(2).max(60).default(12),
  /** rad/s */
  angular_speed: z.number().min(-12).max(12).default(1.0),
  gap_angle_deg: z.number().min(5).max(300).default(45),
  /** how many balls may pass the gap before the ring shatters (0 = indestructible) */
  durability: z.number().int().min(0).max(100000).default(0),
  color: hexColor.optional()
});

export const MazeEscapeSceneSchema = z.object({
  type: z.literal("MAZE_ESCAPE"),
  rings: z
    .array(MazeRingSchema)
    .min(1)
    .max(24)
    .default([
      { radius: 110, thickness: 12, angular_speed: 1.2, gap_angle_deg: 55, durability: 0 },
      { radius: 200, thickness: 12, angular_speed: -0.9, gap_angle_deg: 50, durability: 0 },
      { radius: 290, thickness: 12, angular_speed: 1.5, gap_angle_deg: 45, durability: 0 },
      { radius: 380, thickness: 12, angular_speed: -1.1, gap_angle_deg: 40, durability: 0 },
      { radius: 470, thickness: 12, angular_speed: 0.8, gap_angle_deg: 36, durability: 0 }
    ]),
  initial_balls: z.number().int().min(1).max(100000).default(30),
  ball_radius: z.number().min(2).max(30).default(7),
  color: hexColor.default("#00e5ff"),
  ring_color: hexColor.default("#7c5cff"),
  /** how many escaped balls (weighted) end the challenge */
  balls_to_escape: z.number().int().min(1).max(10_000_000).default(200),
  /** each escape adds this many virtual balls back (0 = recycle only) */
  spawn_on_escape: z.number().int().min(0).max(100000).default(2)
});

export const AlgorithmArenaSchema = z.object({
  type: z.literal("ALGORITHM_ARENA"),
  algorithm: z.enum(["FALLING_SAND", "TSP_2OPT", "BFS_LIGHTNING", "BOIDS"]).default("FALLING_SAND"),
  /** grid width in cells; height = round(width * 16/9) */
  grid_width: z.number().int().min(100).max(540).default(270),
  ops_per_frame: z.number().int().min(500).max(200000).default(12000),
  params: z.record(z.string(), z.number()).default({})
});

export const CubeArenaSceneSchema = z.object({
  type: z.literal("CUBE_ARENA"),
  chamber_shape: z.enum(["circle", "hexagon", "diamond"]).default("circle"),
  outer_radius: z.number().min(200).max(510).default(440),
  cross_blades: z.number().int().min(0).max(8).default(4),
  cross_speed: z.number().min(-6).max(6).default(0.85),
  cage_enabled: z.boolean().default(true),
  cage_size: z.number().min(60).max(260).default(135),
  cage_speed: z.number().min(-6).max(6).default(-0.85),
  initial_cubes: z.number().int().min(1).max(500).default(16),
  cube_size: z.number().min(4).max(32).default(14),
  split_on_escape: z.number().int().min(0).max(6).default(2),
  split_on_blade: z.number().int().min(0).max(4).default(0),
  wall_color: hexColor.default("#ffffff"),
  cage_color: hexColor.default("#cbd5e1"),
  max_cubes: z.number().int().min(10).max(3000).default(600)
});

export const OverflowBowlSceneSchema = z.object({
  type: z.literal("OVERFLOW_BOWL"),
  bowl_shape: z.enum(["u_bowl", "goblet_funnel"]).default("u_bowl"),
  bowl_radius: z.number().min(200).max(500).default(420),
  rim_angle_deg: z.number().min(30).max(165).default(85),
  wedge_angle_deg: z.number().min(4).max(60).default(22),
  swing_amplitude_deg: z.number().min(5).max(80).default(52),
  swing_speed: z.number().min(0.2).max(8).default(2.1),
  initial_balls: z.number().int().min(1).max(200).default(2),
  ball_radius: z.number().min(3).max(24).default(9),
  split_on_hit: z.boolean().default(true),
  split_cooldown_ms: z.number().min(20).max(1000).default(180),
  bowl_color: hexColor.default("#94a3b8"),
  wedge_color: hexColor.default("#cbd5e1")
});

export const OpticalMirrorsSceneSchema = z.object({
  type: z.literal("OPTICAL_MIRRORS"),
  mirror_shape: z.enum(["vesica_piscis", "ellipse", "circle"]).default("vesica_piscis"),
  mirror_spin: z.number().min(-2).max(2).default(0),
  width_px: z.number().min(300).max(1040).default(760),
  height_px: z.number().min(400).max(1600).default(1340),
  ball_count: z.number().int().min(1).max(128).default(16),
  ball_radius: z.number().min(3).max(24).default(9),
  ball_speed: z.number().min(4).max(60).default(24),
  origin_offset_y: z.number().min(-400).max(400).default(0),
  spread_deg: z.number().min(1).max(360).default(360),
  show_rays: z.boolean().default(true),
  show_grid: z.boolean().default(true),
  mirror_color: hexColor.default("#00e5ff")
});

/**
 * Harmonic Pendulum Wave: a row of pendulums whose oscillation counts differ by a fixed step,
 * so the whole row drifts through braids, travelling waves and snaps back into perfect alignment
 * exactly once per loop (analytic motion => frame-perfect seamless loops).
 */
export const PendulumWaveSceneSchema = z.object({
  type: z.literal("PENDULUM_WAVE"),
  count: z.number().int().min(3).max(32).default(18),
  /** oscillations the slowest pendulum completes per loop */
  base_cycles: z.number().int().min(2).max(80).default(20),
  /** extra oscillations per loop added for every following pendulum */
  cycle_step: z.number().min(0.5).max(4).default(1),
  /** loop length in seconds; 0 = project duration */
  loop_sec: z.number().min(0).max(180).default(0),
  /** lateral swing distance in px (same for every bob so strings stay readable) */
  amplitude_px: z.number().min(10).max(460).default(64),
  string_length_px: z.number().min(300).max(1500).default(960),
  spread_px: z.number().min(300).max(1040).default(900),
  pivot_y: z.number().min(40).max(600).default(340),
  bob_radius: z.number().min(4).max(30).default(13),
  /** when a note is struck */
  trigger: z.enum(["center", "extremes", "both"]).default("center"),
  show_strings: z.boolean().default(true),
  show_rest_marks: z.boolean().default(true),
  wave_ribbon: z.boolean().default(true),
  string_color: hexColor.default("#9bdcff")
});

/**
 * Orbital Polyrhythm Clock: planets on concentric rings revolve at integer ratios.
 * Every time a planet crosses a gate it strikes its own note; at loop start all planets
 * align on the gate and resolve into a full chord.
 */
export const PolyOrbitSceneSchema = z.object({
  type: z.literal("POLY_ORBIT"),
  orbits: z.number().int().min(2).max(24).default(7),
  first_ratio: z.number().int().min(1).max(40).default(1),
  ratio_step: z.number().min(0.5).max(5).default(1),
  loop_sec: z.number().min(0).max(180).default(0),
  gates: z.number().int().min(1).max(8).default(1),
  gate_angle_deg: z.number().min(-180).max(180).default(-90),
  inner_radius: z.number().min(40).max(300).default(110),
  outer_radius: z.number().min(200).max(520).default(440),
  planet_radius: z.number().min(4).max(26).default(12),
  direction_mode: z.enum(["same", "alternate"]).default("alternate"),
  ring_color: hexColor.default("#8ecbff"),
  show_gates: z.boolean().default(true),
  constellation_links: z.boolean().default(true)
});

/**
 * Prism Chamber: balls bounce inside a slowly spinning, breathing regular polygon.
 * Every side is tuned to its own scale degree and glows its own hue; balls inherit the hue
 * of the last wall they touched, and a side that is struck often enough "refracts" a new ball.
 */
export const PrismChamberSceneSchema = z.object({
  type: z.literal("PRISM_CHAMBER"),
  sides: z.number().int().min(3).max(12).default(6),
  radius: z.number().min(180).max(500).default(400),
  spin: z.number().min(-4).max(4).default(0.35),
  breathe_amp: z.number().min(0).max(0.35).default(0.1),
  breathe_speed: z.number().min(0).max(4).default(0.6),
  initial_balls: z.number().int().min(1).max(60).default(3),
  ball_radius: z.number().min(3).max(24).default(9),
  hits_per_split: z.number().int().min(1).max(30).default(4),
  max_balls: z.number().int().min(4).max(600).default(160),
  inherit_color: z.boolean().default(true),
  wall_thickness: z.number().min(2).max(30).default(10)
});

export const SceneConfigSchema = z.discriminatedUnion("type", [
  TowerBreakerSceneSchema,
  MazeEscapeSceneSchema,
  AlgorithmArenaSchema,
  CubeArenaSceneSchema,
  OverflowBowlSceneSchema,
  OpticalMirrorsSceneSchema,
  PendulumWaveSceneSchema,
  PolyOrbitSceneSchema,
  PrismChamberSceneSchema
]);

/* ------------------------------------------------------------------ */
/* Sound                                                               */
/* ------------------------------------------------------------------ */
export const PaletteNameSchema = z.enum([
  "kalimba_glow",
  "glass_bell",
  "marimba_wood",
  "thocky_keys",
  "water_drop",
  "synth_pluck",
  "music_box",
  "crystal_bowl",
  "cosmic_laser",
  "handpan_steel",
  "celesta_chime"
]);

export const SoundConfigSchema = z.object({
  palette: PaletteNameSchema.default("kalimba_glow"),
  volume: z.number().min(0).max(1).default(0.9),
  scale: z
    .object({
      root: z.string().regex(/^[A-Ga-g]#?-?\d$/).default("C4"),
      mode: z
        .enum([
          "pentatonic_major",
          "pentatonic_minor",
          "dorian",
          "lydian",
          "major",
          "minor",
          "hirajoshi",
          "insen",
          "gypsy_minor",
          "whole_tone",
          "blues"
        ])
        .default("pentatonic_major"),
      octaves: z.number().int().min(1).max(5).default(3)
    })
    .default({}),
  /** how the pitch of a hit is picked */
  note_mapping: z
    .enum(["melodic_step", "floor_level", "x_position", "lane_floor", "random", "index_degree"])
    .default("melodic_step"),
  quantizer: z
    .object({
      mode: z.enum(["FREE", "HARMONIC", "GRID"]).default("HARMONIC"),
      bpm: z.number().min(40).max(220).default(120),
      progression: z.array(z.string()).min(1).default(["I", "V", "vi", "IV"]),
      snap_ms: z.number().min(0).max(120).default(30)
    })
    .default({}),
  chord_on_density: z
    .object({
      enabled: z.boolean().default(true),
      window_ms: z.number().min(5).max(200).default(30),
      min_hits: z.number().int().min(2).max(100).default(6)
    })
    .default({}),
  cooldown_ms: z.number().min(0).max(200).default(36),
  polyphony: z.number().int().min(4).max(128).default(48),
  max_events_per_frame: z.number().int().min(1).max(32).default(8),
  wall_ticks: z.boolean().default(false),
  spatial: z
    .object({
      pan: z.boolean().default(true),
      y_filter: z.boolean().default(true),
      lowpass_min_hz: z.number().min(200).max(8000).default(1400),
      lowpass_max_hz: z.number().min(2000).max(20000).default(14000)
    })
    .default({}),
  reverb: z
    .object({
      enabled: z.boolean().default(true),
      mix: z.number().min(0).max(1).default(0.22),
      size: z.number().min(0.2).max(1).default(0.7)
    })
    .default({}),
  escalation: z
    .object({
      /** semitones added per floor / per progress step */
      pitch_semitones_per_floor: z.number().min(0).max(4).default(0.5),
      /** semitones added at tension = 1 */
      tension_semitones: z.number().min(0).max(24).default(12),
      drone: z.boolean().default(true),
      drone_gain_db: z.number().min(-40).max(0).default(-14),
      riser_sec: z.number().min(0).max(10).default(3.5)
    })
    .default({}),
  limiter: z
    .object({
      lookahead_ms: z.number().min(1).max(20).default(5),
      ceiling_db: z.number().min(-12).max(0).default(-1)
    })
    .default({})
});

/* ------------------------------------------------------------------ */
/* Look                                                                */
/* ------------------------------------------------------------------ */
export const BackgroundStyleSchema = z.enum([
  "solid",
  "radial_vignette",
  "deep_space_stars",
  "cyber_grid",
  "aurora_gradient"
]);
export const BallStyleSchema = z.enum([
  "glow",
  "neon_ring",
  "shaded_sphere",
  "sparkle_particle",
  "neon_cube",
  "solid_cube"
]);
export const BallColorModeSchema = z.enum(["lane", "rainbow", "velocity"]);
export const TowerHudStyleSchema = z.enum(["classic", "duel_cards"]);
export const FloorStyleSchema = z.enum(["solid", "neon_laser", "glass_brick", "striped_warning"]);

export const LookConfigSchema = z.object({
  background: hexColor.default("#060609"),
  background_style: BackgroundStyleSchema.default("solid"),
  ball_style: BallStyleSchema.default("glow"),
  color_mode: BallColorModeSchema.default("lane"),
  tower_hud_style: TowerHudStyleSchema.default("classic"),
  floor_style: FloorStyleSchema.default("solid"),
  vignette: z.number().min(0).max(1).default(0.35),
  chromatic_aberration: z.number().min(0).max(20).default(0),
  scanlines: z.number().min(0).max(1).default(0),
  bloom: z
    .object({
      enabled: z.boolean().default(true),
      intensity: z.number().min(0).max(3).default(0.9),
      blur: z.number().min(1).max(40).default(10)
    })
    .default({}),
  trail: z
    .object({
      enabled: z.boolean().default(true),
      /** background alpha laid over the trail every frame; lower = longer trails */
      fade_alpha: z.number().min(0.02).max(1).default(0.22)
    })
    .default({}),
  pitch_hue: z.boolean().default(true),
  safe_flash: z.boolean().default(true),
  glow: z.number().min(0).max(3).default(1.4),
  floor_labels: z.boolean().default(true),
  hud: z
    .object({
      show_timer: z.boolean().default(true),
      show_lane_counts: z.boolean().default(true),
      hook_size: z.number().min(16).max(120).default(52),
      timer_size: z.number().min(16).max(160).default(88),
      timer_y: z.number().min(60).max(900).default(430),
      hook_y: z.number().min(40).max(900).default(250),
      show_safe_zones: z.boolean().default(false),
      accent: hexColor.default("#00e5ff")
    })
    .default({})
});

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */
export const RuleGuardSchema = z.object({
  max_fires: z.number().int().min(0).default(500),
  cooldown_ms: z.number().min(0).default(0),
  budget_per_frame: z.number().int().min(1).default(200),
  depth_limit: z.number().int().min(0).max(10).default(3)
});

export const RuleActionSchema = z.object({
  type: z.enum([
    "SPAWN",
    "SCALE_BALL",
    "SET_GRAVITY",
    "ROTATE_ARENA",
    "DAMAGE_WALL",
    "PLAY_SFX",
    "SHIFT_PITCH",
    "SHAKE",
    "FLASH",
    "TOGGLE_RULE"
  ]),
  /** lane id (tower) – empty = lane that triggered the rule */
  at: z.string().optional(),
  count: z.number().optional(),
  value: z.number().optional(),
  value2: z.number().optional(),
  target_rule: z.string().optional()
});

export const RuleConfigSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().default(true),
  trigger: z.enum(["ON_FLOOR_BREAK", "ON_EXIT_ENTER", "ON_RING_BREAK", "ON_TIMER", "ON_COUNT_REACHED", "ON_BEAT"]),
  /** ON_TIMER: fire every N seconds (or once at `at_sec` if every_sec = 0). ON_COUNT_REACHED: virtual ball threshold. ON_FLOOR_BREAK: min floor index. */
  every_sec: z.number().min(0).default(0),
  at_sec: z.number().min(0).default(0),
  threshold: z.number().min(0).default(0),
  /** restrict to a lane id (tower) */
  lane: z.string().optional(),
  /** tension window */
  min_tension: z.number().min(0).max(1).default(0),
  guard: RuleGuardSchema.default({}),
  actions: z.array(RuleActionSchema).default([])
});

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */
export const ExportConfigSchema = z.object({
  video_mbps: z.number().min(2).max(40).default(14),
  audio_kbps: z.number().min(96).max(320).default(192),
  filename: z.string().default("")
});

/* ------------------------------------------------------------------ */
/* Project                                                             */
/* ------------------------------------------------------------------ */
export const ProjectConfigSchema = z.object({
  version: z.literal("2.0").default("2.0"),
  seed: z.number().int().min(0).max(4294967295).default(20261110),
  meta: MetaConfigSchema.default({}),
  arc: ArcConfigSchema.default({}),
  physics: PhysicsConfigSchema.default({}),
  feel: FeelConfigSchema.default({}),
  scene: SceneConfigSchema,
  sound: SoundConfigSchema.default({}),
  look: LookConfigSchema.default({}),
  rules: z.array(RuleConfigSchema).default([]),
  export: ExportConfigSchema.default({})
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type ProjectConfigInput = z.input<typeof ProjectConfigSchema>;
export type SceneConfig = z.infer<typeof SceneConfigSchema>;
export type TowerBreakerSceneConfig = z.infer<typeof TowerBreakerSceneSchema>;
export type MazeEscapeSceneConfig = z.infer<typeof MazeEscapeSceneSchema>;
export type AlgorithmArenaConfig = z.infer<typeof AlgorithmArenaSchema>;
export type CubeArenaSceneConfig = z.infer<typeof CubeArenaSceneSchema>;
export type OverflowBowlSceneConfig = z.infer<typeof OverflowBowlSceneSchema>;
export type OpticalMirrorsSceneConfig = z.infer<typeof OpticalMirrorsSceneSchema>;
export type PendulumWaveSceneConfig = z.infer<typeof PendulumWaveSceneSchema>;
export type PolyOrbitSceneConfig = z.infer<typeof PolyOrbitSceneSchema>;
export type PrismChamberSceneConfig = z.infer<typeof PrismChamberSceneSchema>;
export type TowerLane = z.infer<typeof TowerLaneSchema>;
export type MazeRing = z.infer<typeof MazeRingSchema>;
export type SoundConfig = z.infer<typeof SoundConfigSchema>;
export type LookConfig = z.infer<typeof LookConfigSchema>;
export type RuleConfig = z.infer<typeof RuleConfigSchema>;
export type RuleAction = z.infer<typeof RuleActionSchema>;
export type PaletteName = z.infer<typeof PaletteNameSchema>;
export type BackgroundStyle = z.infer<typeof BackgroundStyleSchema>;
export type BallStyle = z.infer<typeof BallStyleSchema>;
export type BallColorMode = z.infer<typeof BallColorModeSchema>;
export type TowerHudStyle = z.infer<typeof TowerHudStyleSchema>;
export type FloorStyle = z.infer<typeof FloorStyleSchema>;

/** Resolve the HP list of one lane (lane override > scene formula). */
export function resolveFloorHp(scene: TowerBreakerSceneConfig, lane: TowerLane): number[] {
  if (lane.floors_hp && lane.floors_hp.length > 0) return lane.floors_hp;
  const f = scene.floors_hp;
  if (f.mode === "exponential") {
    const out: number[] = [];
    for (let n = 0; n < f.count; n++) out.push(Math.max(1, Math.round(f.base * Math.pow(f.growth, n))));
    return out;
  }
  return f.values;
}

export function parseProjectConfig(input: unknown): ProjectConfig {
  return ProjectConfigSchema.parse(input);
}
