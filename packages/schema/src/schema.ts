import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Format warna harus #RRGGBB");
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
  hook_text: z.string().default("1 MENIT. 3 TOWER.\nSIAPA PECAHKAN LANTAI 10?"),
  hook_duration_sec: z.number().min(0).max(30).default(3.5),
  tension_curve: z.array(TensionPointSchema).min(2).max(12).default([
    [0, 0.2],
    [0.1, 0.35],
    [0.55, 0.6],
    [0.85, 1.0],
    [1, 0.4]
  ]),
  loop_outro_sec: z.number().min(0).max(3).default(0.6)
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
  physical_cap: z.number().int().min(100).max(8000).default(3000)
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
  op: z.enum(["NONE", "ADD", "MULTIPLY", "SCALE_SIZE", "SCALE_SPEED"]).default("NONE"),
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
  rows: z.number().int().min(1).max(14).default(5),
  per_row: z.number().int().min(1).max(12).default(4),
  /** px */
  radius: z.number().min(2).max(30).default(10),
  top: z.number().min(0.05).max(0.5).default(0.14),
  bottom: z.number().min(0.1).max(0.6).default(0.32)
});

export const TowerBreakerSceneSchema = z.object({
  type: z.literal("TOWER_BREAKER"),
  floors_hp: FloorHpSchema.default({}),
  lanes: z
    .array(TowerLaneSchema)
    .min(1)
    .max(4)
    .default([
      { id: "a", label: "x2 / LANTAI", color: "#00e5ff", initial_balls: 1, ball_radius: 8, on_floor_break: { op: "MULTIPLY", value: 2 } },
      { id: "b", label: "+50 / LANTAI", color: "#ff00aa", initial_balls: 20, ball_radius: 6, on_floor_break: { op: "ADD", value: 50 } },
      { id: "c", label: "+300 / LANTAI", color: "#d4ff00", initial_balls: 100, ball_radius: 5, on_floor_break: { op: "ADD", value: 300 } }
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

export const SceneConfigSchema = z.discriminatedUnion("type", [
  TowerBreakerSceneSchema,
  MazeEscapeSceneSchema,
  AlgorithmArenaSchema
]);

/* ------------------------------------------------------------------ */
/* Sound                                                               */
/* ------------------------------------------------------------------ */
export const PaletteNameSchema = z.enum(["kalimba_glow", "glass_bell", "marimba_wood", "thocky_keys", "water_drop"]);

export const SoundConfigSchema = z.object({
  palette: PaletteNameSchema.default("kalimba_glow"),
  volume: z.number().min(0).max(1).default(0.9),
  scale: z
    .object({
      root: z.string().regex(/^[A-Ga-g]#?-?\d$/).default("C4"),
      mode: z.enum(["pentatonic_major", "pentatonic_minor", "dorian", "lydian", "major", "minor"]).default("pentatonic_major"),
      octaves: z.number().int().min(1).max(5).default(3)
    })
    .default({}),
  /** how the pitch of a hit is picked */
  note_mapping: z.enum(["x_position", "lane_floor", "random"]).default("x_position"),
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
  cooldown_ms: z.number().min(0).max(200).default(24),
  polyphony: z.number().int().min(4).max(128).default(48),
  max_events_per_frame: z.number().int().min(1).max(12).default(2),
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
export const LookConfigSchema = z.object({
  background: hexColor.default("#060609"),
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
  audio_kbps: z.number().min(96).max(320).default(256),
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
export type TowerLane = z.infer<typeof TowerLaneSchema>;
export type MazeRing = z.infer<typeof MazeRingSchema>;
export type SoundConfig = z.infer<typeof SoundConfigSchema>;
export type LookConfig = z.infer<typeof LookConfigSchema>;
export type RuleConfig = z.infer<typeof RuleConfigSchema>;
export type RuleAction = z.infer<typeof RuleActionSchema>;
export type PaletteName = z.infer<typeof PaletteNameSchema>;

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
