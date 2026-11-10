import { ProjectConfig } from "./schema.js";

export const CLASSIC_3_TOWERS_PRESET: ProjectConfig = {
  version: "2.0",
  seed: 20261110,
  meta: {
    title: "Classic 3 Towers - 60s",
    duration_sec: 60,
    fps: 60,
    width: 1080,
    height: 1920
  },
  arc: {
    hook_text: "1 MENIT. 3 TOWER.\nSIAPA PECAHKAN LANTAI 10?",
    tension_curve: [
      [0, 0.2],
      [0.1, 0.35],
      [0.55, 0.6],
      [0.85, 1.0],
      [1, 0.4]
    ],
    loop_outro_sec: 0.6
  },
  physics: {
    pixels_per_meter: 20,
    gravity: [0, 9.81],
    substeps: 4,
    max_speed: 60,
    restitution_default: 0.98,
    ball_ball_collision: false,
    physical_cap: 3000
  },
  scene: {
    type: "TOWER_BREAKER",
    floors_hp: {
      mode: "manual",
      values: [76, 900, 3000, 4500, 7500, 12000, 18000, 24000, 30000, 45000]
    },
    lanes: [
      {
        id: "left",
        label: "x100 / FLOOR",
        color: "#00e5ff",
        initial_balls: 1,
        ball_radius: 8,
        on_floor_break: { op: "MULTIPLY", value: 100 }
      },
      {
        id: "center",
        label: "x5 / FLOOR",
        color: "#ff00aa",
        initial_balls: 50,
        ball_radius: 6,
        on_floor_break: { op: "MULTIPLY", value: 5 }
      },
      {
        id: "right",
        label: "+1,000 / FLOOR",
        color: "#d4ff00",
        initial_balls: 500,
        ball_radius: 5,
        on_floor_break: { op: "ADD", value: 1000 }
      }
    ],
    anti_stalemate_sec: 8
  },
  sound: {
    palette: "kalimba_glow",
    scale: {
      root: "C4",
      mode: "pentatonic_major",
      octaves: 3
    },
    quantizer: {
      mode: "HARMONIC",
      bpm: 120,
      progression: ["I", "V", "vi", "IV"],
      snap_ms: 30
    },
    chord_on_density: {
      window_ms: 30,
      min_hits: 6
    },
    cooldown_ms: 18,
    polyphony: 48,
    spatial: {
      pan: "constant_power",
      y_filter: true,
      hrtf: false
    },
    escalation: {
      pitch_semitones_per_floor: 0.5,
      riser_sec: 3.5
    },
    limiter: {
      lookahead_ms: 5,
      ceiling_db: -1
    }
  },
  look: {
    background: "#060609",
    bloom: {
      enabled: true,
      threshold: 0.2,
      intensity: 1.5,
      blur: 8
    },
    trail: {
      enabled: true,
      fade_alpha: 0.18
    },
    pitch_hue: true,
    safe_flash: true,
    metaball: false,
    hud: {
      font: "sans-serif",
      timer_y: 280,
      show_safe_zones: false
    }
  },
  rules: []
};

export const MAZE_RINGS_PRESET: ProjectConfig = {
  ...CLASSIC_3_TOWERS_PRESET,
  meta: {
    title: "12 Concentric Rings Maze",
    duration_sec: 60,
    fps: 60,
    width: 1080,
    height: 1920
  },
  arc: {
    hook_text: "12 CINCIN. 1 JALUR KELUAR.\nBISAKAH SEMUA LOLOS?",
    tension_curve: [
      [0, 0.15],
      [0.3, 0.4],
      [0.7, 0.75],
      [0.9, 1.0],
      [1, 0.3]
    ],
    loop_outro_sec: 0.6
  },
  scene: {
    type: "MAZE_ESCAPE",
    container_shape: "RINGS",
    initial_balls: 25,
    ball_radius: 6,
    spawn_point: [0, 0],
    exit_zone_radius: 50,
    balls_to_escape: 150,
    rings: [
      { radius: 100, segments: 1, thickness: 12, angular_speed: 1.2, gap_angle_deg: 45, durability: 0 },
      { radius: 180, segments: 1, thickness: 12, angular_speed: -0.9, gap_angle_deg: 40, durability: 0 },
      { radius: 260, segments: 1, thickness: 12, angular_speed: 1.5, gap_angle_deg: 35, durability: 0 },
      { radius: 340, segments: 1, thickness: 12, angular_speed: -1.1, gap_angle_deg: 30, durability: 0 },
      { radius: 420, segments: 1, thickness: 12, angular_speed: 0.8, gap_angle_deg: 25, durability: 0 }
    ]
  },
  sound: {
    ...CLASSIC_3_TOWERS_PRESET.sound,
    palette: "glass_bell"
  }
};
