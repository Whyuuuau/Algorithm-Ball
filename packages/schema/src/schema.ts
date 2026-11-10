import { z } from "zod";

export const TensionPointSchema = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);

export const MetaConfigSchema = z.object({
  title: z.string().default("ASMR Video"),
  duration_sec: z.number().min(5).max(180).default(60),
  fps: z.union([z.literal(30), z.literal(60)]).default(60),
  width: z.number().default(1080),
  height: z.number().default(1920)
});

export const ArcConfigSchema = z.object({
  hook_text: z.string().default("1 MENIT. 3 TOWER.\nSIAPA PECAHKAN LANTAI 10?"),
  tension_curve: z.array(TensionPointSchema).default([
    [0, 0.2],
    [0.1, 0.35],
    [0.55, 0.6],
    [0.85, 1.0],
    [1, 0.4]
  ]),
  loop_outro_sec: z.number().default(0.6)
});

export const PhysicsConfigSchema = z.object({
  pixels_per_meter: z.number().default(20),
  gravity: z.tuple([z.number(), z.number()]).default([0, 9.81]),
  substeps: z.number().default(4),
  max_speed: z.number().default(60),
  restitution_default: z.number().default(0.98),
  ball_ball_collision: z.boolean().default(false),
  physical_cap: z.number().default(3000)
});

export const TowerFloorActionSchema = z.object({
  op: z.enum(["ADD", "MULTIPLY", "SCALE_SIZE", "SCALE_SPEED"]),
  value: z.number()
});

export const TowerLaneSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
  initial_balls: z.number().default(1),
  ball_radius: z.number().default(6),
  on_floor_break: TowerFloorActionSchema
});

export const TowerBreakerSceneSchema = z.object({
  type: z.literal("TOWER_BREAKER"),
  floors_hp: z.object({
    mode: z.enum(["manual", "exponential"]).default("manual"),
    values: z.array(z.number()).default([76, 900, 3000, 4500, 7500, 12000, 18000, 24000, 30000, 45000]),
    base: z.number().optional(),
    growth: z.number().optional()
  }),
  lanes: z.array(TowerLaneSchema),
  anti_stalemate_sec: z.number().default(8)
});

export const MazeRingSchema = z.object({
  radius: z.number(),
  segments: z.number().default(1),
  thickness: z.number().default(10),
  angular_speed: z.number().default(1.0), // rad/s
  gap_angle_deg: z.number().default(40),
  durability: z.number().default(0) // 0 = indestructible
});

export const MazeEscapeSceneSchema = z.object({
  type: z.literal("MAZE_ESCAPE"),
  container_shape: z.enum(["CIRCLE", "POLYGON", "RINGS"]).default("RINGS"),
  rings: z.array(MazeRingSchema).default([]),
  initial_balls: z.number().default(20),
  ball_radius: z.number().default(6),
  spawn_point: z.tuple([z.number(), z.number()]).default([0, 0]),
  exit_zone_radius: z.number().default(40),
  balls_to_escape: z.number().default(100)
});

export const AlgorithmArenaSchema = z.object({
  type: z.literal("ALGORITHM_ARENA"),
  algorithm_a: z.enum(["FALLING_SAND", "TSP_2OPT", "BFS_LIGHTNING", "BOIDS"]),
  algorithm_b: z.enum(["FALLING_SAND", "TSP_2OPT", "BFS_LIGHTNING", "BOIDS"]).optional(),
  grid_resolution: z.number().default(500),
  ops_per_frame: z.number().default(2500)
});

export const SceneConfigSchema = z.discriminatedUnion("type", [
  TowerBreakerSceneSchema,
  MazeEscapeSceneSchema,
  AlgorithmArenaSchema
]);

export const PaletteNameSchema = z.enum([
  "kalimba_glow",
  "glass_bell",
  "marimba_wood",
  "thocky_keys",
  "water_drop"
]);

export const SoundConfigSchema = z.object({
  palette: PaletteNameSchema.default("kalimba_glow"),
  scale: z.object({
    root: z.string().default("C4"),
    mode: z.enum(["pentatonic_major", "pentatonic_minor", "dorian", "lydian"]).default("pentatonic_major"),
    octaves: z.number().default(3)
  }),
  quantizer: z.object({
    mode: z.enum(["FREE", "HARMONIC", "GRID"]).default("HARMONIC"),
    bpm: z.number().default(120),
    progression: z.array(z.string()).default(["I", "V", "vi", "IV"]),
    snap_ms: z.number().default(30)
  }),
  chord_on_density: z.object({
    window_ms: z.number().default(30),
    min_hits: z.number().default(6)
  }),
  cooldown_ms: z.number().default(18),
  polyphony: z.number().default(48),
  spatial: z.object({
    pan: z.enum(["constant_power", "hrtf"]).default("constant_power"),
    y_filter: z.boolean().default(true),
    hrtf: z.boolean().default(false)
  }),
  escalation: z.object({
    pitch_semitones_per_floor: z.number().default(0.5),
    riser_sec: z.number().default(3.5)
  }),
  limiter: z.object({
    lookahead_ms: z.number().default(5),
    ceiling_db: z.number().default(-1)
  })
});

export const LookConfigSchema = z.object({
  background: z.string().default("#060609"),
  bloom: z.object({
    enabled: z.boolean().default(true),
    threshold: z.number().default(0.2),
    intensity: z.number().default(1.5),
    blur: z.number().default(8)
  }),
  trail: z.object({
    enabled: z.boolean().default(true),
    fade_alpha: z.number().default(0.18)
  }),
  pitch_hue: z.boolean().default(true),
  safe_flash: z.boolean().default(true),
  metaball: z.boolean().default(false),
  hud: z.object({
    font: z.string().default("sans-serif"),
    timer_y: z.number().default(280),
    show_safe_zones: z.boolean().default(false)
  })
});

export const RuleGuardSchema = z.object({
  max_fires: z.number().default(500),
  cooldown_ms: z.number().default(0),
  budget_per_frame: z.number().default(200),
  depth_limit: z.number().default(3)
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
  count: z.number().optional(),
  at: z.string().optional(),
  value: z.any().optional()
});

export const RuleConfigSchema = z.object({
  id: z.string(),
  enabled: z.boolean().default(true),
  trigger: z.enum([
    "ON_HIT_WALL",
    "ON_FLOOR_BREAK",
    "ON_EXIT_ENTER",
    "ON_RING_BREAK",
    "ON_TIMER",
    "ON_COUNT_REACHED",
    "ON_TERRITORY_CONTACT",
    "ON_BEAT"
  ]),
  condition: z.string().optional(),
  guard: RuleGuardSchema.default({ max_fires: 500, cooldown_ms: 0, budget_per_frame: 200, depth_limit: 3 }),
  actions: z.array(RuleActionSchema)
});

export const ProjectConfigSchema = z.object({
  version: z.literal("2.0").default("2.0"),
  seed: z.number().default(20261110),
  meta: MetaConfigSchema.default({
    title: "3 Towers - 60s",
    duration_sec: 60,
    fps: 60,
    width: 1080,
    height: 1920
  }),
  arc: ArcConfigSchema.default({
    hook_text: "1 MENIT. 3 TOWER.\nSIAPA PECAHKAN LANTAI 10?",
    tension_curve: [
      [0, 0.2],
      [0.1, 0.35],
      [0.55, 0.6],
      [0.85, 1.0],
      [1, 0.4]
    ],
    loop_outro_sec: 0.6
  }),
  physics: PhysicsConfigSchema.default({
    pixels_per_meter: 20,
    gravity: [0, 9.81],
    substeps: 4,
    max_speed: 60,
    restitution_default: 0.98,
    ball_ball_collision: false,
    physical_cap: 3000
  }),
  scene: SceneConfigSchema,
  sound: SoundConfigSchema.default({
    palette: "kalimba_glow",
    scale: { root: "C4", mode: "pentatonic_major", octaves: 3 },
    quantizer: { mode: "HARMONIC", bpm: 120, progression: ["I", "V", "vi", "IV"], snap_ms: 30 },
    chord_on_density: { window_ms: 30, min_hits: 6 },
    cooldown_ms: 18,
    polyphony: 48,
    spatial: { pan: "constant_power", y_filter: true, hrtf: false },
    escalation: { pitch_semitones_per_floor: 0.5, riser_sec: 3.5 },
    limiter: { lookahead_ms: 5, ceiling_db: -1 }
  }),
  look: LookConfigSchema.default({
    background: "#060609",
    bloom: { enabled: true, threshold: 0.2, intensity: 1.5, blur: 8 },
    trail: { enabled: true, fade_alpha: 0.18 },
    pitch_hue: true,
    safe_flash: true,
    metaball: false,
    hud: { font: "sans-serif", timer_y: 280, show_safe_zones: false }
  }),
  rules: z.array(RuleConfigSchema).default([])
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type SceneConfig = z.infer<typeof SceneConfigSchema>;
export type TowerBreakerSceneConfig = z.infer<typeof TowerBreakerSceneSchema>;
export type MazeEscapeSceneConfig = z.infer<typeof MazeEscapeSceneSchema>;
export type AlgorithmArenaConfig = z.infer<typeof AlgorithmArenaSchema>;
export type SoundConfig = z.infer<typeof SoundConfigSchema>;
export type LookConfig = z.infer<typeof LookConfigSchema>;
export type RuleConfig = z.infer<typeof RuleConfigSchema>;
export type PaletteName = z.infer<typeof PaletteNameSchema>;
