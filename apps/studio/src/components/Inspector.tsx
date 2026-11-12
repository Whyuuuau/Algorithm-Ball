import React, { useRef, useState } from "react";
import { useProjectStore } from "../store/projectStore.js";
import {
  type PaletteName,
  type RuleConfig,
  type BackgroundStyle,
  type BallStyle,
  type BallColorMode,
  type TowerHudStyle,
  type FloorStyle,
  PRESETS,
  TowerBreakerSceneSchema,
  MazeEscapeSceneSchema,
  AlgorithmArenaSchema,
  CubeArenaSceneSchema,
  OverflowBowlSceneSchema,
  OpticalMirrorsSceneSchema,
  PendulumWaveSceneSchema,
  PolyOrbitSceneSchema,
  PrismChamberSceneSchema
} from "@asmr/schema";
import { ARENA_PARAM_SPECS, arenaDefaults, type ArenaId } from "@asmr/sim-core";
import { AudioDirector } from "@asmr/audio-core";
import { TensionCurveEditor } from "./TensionCurveEditor.js";
import { SeedScout } from "../scout/SeedScout.js";
import { ExportDirector } from "../exporter/ExportDirector.js";
import {
  Layers,
  Sliders,
  Music,
  Eye,
  TrendingUp,
  Download,
  Plus,
  Trash2,
  Volume2,
  Sparkles,
  Upload,
  FileJson,
  Save,
  AlertTriangle
} from "lucide-react";

export const Inspector: React.FC = () => {
  const {
    config,
    updateConfig,
    activeTab,
    setActiveTab,
    loadPreset,
    savedPresets,
    saveCustomPreset,
    deleteCustomPreset,
    importJsonConfig,
    isScouting,
    setScouting,
    scoutProgress,
    setScoutProgress,
    scoutedSeeds,
    setScoutedSeeds,
    isExporting,
    setExporting,
    exportProgress,
    setExportProgress,
    setExportedBlob
  } = useProjectStore();

  const [presetCategory, setPresetCategory] = useState<string>("ALL");
  const [presetName, setPresetName] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [jsonMsg, setJsonMsg] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleAudition = () => {
    const dir = new AudioDirector(config.sound);
    dir.auditionNote();
  };

  const handleSwitchSceneType = (
    type:
      | "TOWER_BREAKER"
      | "MAZE_ESCAPE"
      | "CUBE_ARENA"
      | "OVERFLOW_BOWL"
      | "OPTICAL_MIRRORS"
      | "PENDULUM_WAVE"
      | "POLY_ORBIT"
      | "PRISM_CHAMBER"
      | "ALGORITHM_ARENA"
  ) => {
    if (config.scene.type === type) return;
    updateConfig((p) => {
      if (type === "TOWER_BREAKER") {
        p.scene = TowerBreakerSceneSchema.parse({ type: "TOWER_BREAKER" });
        p.physics.gravity = [0, 9.81];
        p.physics.speed_lock = 0;
      } else if (type === "MAZE_ESCAPE") {
        p.scene = MazeEscapeSceneSchema.parse({ type: "MAZE_ESCAPE" });
        p.physics.gravity = [0, 0];
        p.physics.speed_lock = 26;
      } else if (type === "CUBE_ARENA") {
        p.scene = CubeArenaSceneSchema.parse({ type: "CUBE_ARENA" });
        p.physics.gravity = [0, 7.5];
        p.physics.speed_lock = 0;
        p.look.ball_style = "solid_cube";
        p.look.color_mode = "rainbow";
      } else if (type === "OVERFLOW_BOWL") {
        p.scene = OverflowBowlSceneSchema.parse({ type: "OVERFLOW_BOWL" });
        p.physics.gravity = [0, 12];
        p.physics.speed_lock = 0;
        p.look.ball_style = "shaded_sphere";
        p.look.color_mode = "rainbow";
      } else if (type === "OPTICAL_MIRRORS") {
        p.scene = OpticalMirrorsSceneSchema.parse({ type: "OPTICAL_MIRRORS" });
        p.physics.gravity = [0, 0];
        p.physics.speed_lock = 0;
        p.look.ball_style = "glow";
        p.look.color_mode = "rainbow";
        p.sound.note_mapping = "index_degree";
      } else if (type === "PENDULUM_WAVE") {
        p.scene = PendulumWaveSceneSchema.parse({ type: "PENDULUM_WAVE" });
        p.physics.gravity = [0, 0];
        p.physics.speed_lock = 0;
        p.look.ball_style = "shaded_sphere";
        p.look.color_mode = "rainbow";
        p.sound.note_mapping = "index_degree";
      } else if (type === "POLY_ORBIT") {
        p.scene = PolyOrbitSceneSchema.parse({ type: "POLY_ORBIT" });
        p.physics.gravity = [0, 0];
        p.physics.speed_lock = 0;
        p.look.ball_style = "glow";
        p.look.color_mode = "rainbow";
        p.sound.note_mapping = "index_degree";
      } else if (type === "PRISM_CHAMBER") {
        p.scene = PrismChamberSceneSchema.parse({ type: "PRISM_CHAMBER" });
        p.physics.gravity = [0, 0.25];
        p.physics.speed_lock = 0;
        p.look.ball_style = "neon_ring";
        p.look.color_mode = "rainbow";
        p.sound.note_mapping = "index_degree";
      } else {
        p.scene = AlgorithmArenaSchema.parse({
          type: "ALGORITHM_ARENA",
          algorithm: "FALLING_SAND",
          params: arenaDefaults("FALLING_SAND")
        });
      }
      return p;
    });
  };

  const handleRunSeedScout = async (candidateCount: number) => {
    try {
      setScouting(true);
      setScoutProgress(0);
      const results = await SeedScout.scoutTopSeeds(config, candidateCount, (pct) => {
        setScoutProgress(pct);
      });
      setScoutedSeeds(results);
    } finally {
      setScouting(false);
    }
  };

  const handleStartExport = async () => {
    try {
      setExporting(true);
      setExportedBlob(null);
      setExportError(null);

      const check = await ExportDirector.checkWebCodecsSupport();
      if (!check.supported) {
        const msg =
          "WebCodecs VideoEncoder is not supported in this browser: " +
          (check.reason || "Please use the latest desktop Google Chrome or Microsoft Edge.");
        setExportError(msg);
        alert(msg);
        setExporting(false);
        return;
      }

      const ac = new AbortController();
      abortRef.current = ac;

      const blob = await ExportDirector.exportMp4(
        config,
        (progress) => setExportProgress(progress),
        ac.signal
      );

      setExportedBlob(blob);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName =
        config.export.filename.trim() ||
        `${config.meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${config.seed}`;
      a.download = baseName.endsWith(".mp4") ? baseName : `${baseName}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      if ((e as DOMException)?.name !== "AbortError") {
        const errStr = e instanceof Error ? e.message : String(e);
        setExportError(errStr);
        alert("Export failed: " + errStr);
      }
    } finally {
      abortRef.current = null;
      setExporting(false);
    }
  };

  const handleExportJson = () => {
    const str = JSON.stringify(config, null, 2);
    setJsonText(str);
    const blob = new Blob([str], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addRule = () => {
    const newRule: RuleConfig = {
      id: `rule_${Date.now().toString(36).slice(-4)}`,
      enabled: true,
      trigger: "ON_TIMER",
      every_sec: 5,
      at_sec: 2,
      threshold: 0,
      min_tension: 0,
      guard: { max_fires: 50, cooldown_ms: 500, budget_per_frame: 100, depth_limit: 3 },
      actions: [{ type: "SPAWN", count: 25 }]
    };
    updateConfig((p) => ({ ...p, rules: [...p.rules, newRule] }));
  };

  return (
    <div className="w-[380px] bg-slate-900 border-l border-slate-800 flex flex-col h-full text-slate-200 select-none">
      {/* Tab Navigation */}
      <div className="grid grid-cols-6 border-b border-slate-800 p-1 bg-slate-950 text-[11px]">
        {(
          [
            ["scene", "Scene", Layers],
            ["physics", "Physics", Sliders],
            ["sound", "Audio", Music],
            ["look", "Visual", Eye],
            ["arc", "Arc/Rules", TrendingUp],
            ["export", "Export", Download]
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center gap-1 py-1.5 rounded font-medium transition-colors cursor-pointer ${
              activeTab === id ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
        {/* ============================================================ */}
        {/* TAB 1: SCENE                                                 */}
        {/* ============================================================ */}
        {activeTab === "scene" && (
          <div className="space-y-4">
            {/* Presets Gallery */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-bold flex items-center gap-1.5 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Studio Presets & Templates ({Object.keys(PRESETS).length})
                </label>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1">
                {(["ALL", "Satisfying & ASMR", "High Tension & Battle", "Sci-Fi & Cosmic", "Algorithm & Arena"] as const).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setPresetCategory(cat)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                        presetCategory === cat
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                      }`}
                    >
                      {cat === "ALL" ? "All" : cat}
                    </button>
                  )
                )}
              </div>

              {/* Preset Cards List */}
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {Object.entries(PRESETS)
                  .filter(
                    ([, item]) =>
                      presetCategory === "ALL" ||
                      item.category === presetCategory
                  )
                  .map(([key, item]) => {
                    const isCurrent = config.meta.title === item.config.meta.title;
                    return (
                      <button
                        key={key}
                        onClick={() => loadPreset(key)}
                        className={`w-full py-2 px-2.5 rounded text-left border transition-all cursor-pointer flex flex-col gap-0.5 ${
                          isCurrent
                            ? "bg-cyan-950/40 border-cyan-500/60 shadow-sm shadow-cyan-500/10"
                            : "bg-slate-900/90 hover:bg-slate-800/90 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold text-[11px] truncate ${isCurrent ? "text-cyan-300" : "text-slate-200"}`}>
                            {item.label}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase ${
                              item.category === "Satisfying & ASMR"
                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                : item.category === "High Tension & Battle"
                                ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                : item.category === "Sci-Fi & Cosmic"
                                ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                                : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                            }`}
                          >
                            {item.category.split(" ")[0]}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 line-clamp-1">{item.description}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Custom saved presets */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2">
              <span className="font-semibold text-slate-300 block">Custom Local Presets</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="New preset name..."
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200"
                />
                <button
                  onClick={() => {
                    if (presetName.trim()) {
                      saveCustomPreset(presetName);
                      setPresetName("");
                    }
                  }}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-2.5 py-1 rounded flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Save className="w-3 h-3" /> Save
                </button>
              </div>
              {Object.keys(savedPresets).length > 0 && (
                <div className="space-y-1 pt-1">
                  {Object.keys(savedPresets).map((name) => (
                    <div key={name} className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded">
                      <button
                        onClick={() => loadPreset(name)}
                        className="text-cyan-400 hover:underline font-medium truncate text-left flex-1 cursor-pointer"
                      >
                        {name}
                      </button>
                      <button
                        onClick={() => deleteCustomPreset(name)}
                        className="text-rose-400 hover:text-rose-300 p-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mode Scene Switcher */}
            <div>
              <label className="text-slate-400 block mb-1 font-semibold">Arena Mode (9 Engines)</label>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    ["TOWER_BREAKER", "Tower Duel"],
                    ["MAZE_ESCAPE", "Maze Rings"],
                    ["CUBE_ARENA", "Cube Arena"],
                    ["OVERFLOW_BOWL", "Overflow Bowl"],
                    ["OPTICAL_MIRRORS", "Optical Mirrors"],
                    ["PENDULUM_WAVE", "Pendulum Wave"],
                    ["POLY_ORBIT", "Poly Orbits"],
                    ["PRISM_CHAMBER", "Prism Chamber"],
                    ["ALGORITHM_ARENA", "Algorithms"]
                  ] as const
                ).map(([t, lbl]) => (
                  <button
                    key={t}
                    onClick={() => handleSwitchSceneType(t)}
                    className={`py-1.5 rounded font-semibold border cursor-pointer text-[11px] ${
                      config.scene.type === t
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Master Seed */}
            <div>
              <label className="text-slate-400 block mb-1 font-semibold">Master PRNG Seed</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={config.seed}
                  onChange={(e) =>
                    updateConfig((p) => ({ ...p, seed: Math.max(0, parseInt(e.target.value, 10) || 0) }))
                  }
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 w-full font-mono text-cyan-400"
                />
                <button
                  onClick={() =>
                    updateConfig((p) => ({ ...p, seed: Math.floor(Math.random() * 9000000) + 1000000 }))
                  }
                  className="bg-slate-800 hover:bg-slate-700 px-3 rounded border border-slate-700 cursor-pointer"
                  title="Randomize Seed"
                >
                  🎲
                </button>
              </div>
            </div>

            {/* TOWER BREAKER EDITOR */}
            {config.scene.type === "TOWER_BREAKER" && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Floor Durability (HP)</span>
                  <select
                    value={config.scene.floors_hp.mode}
                    onChange={(e) =>
                      updateConfig((p) => {
                        if (p.scene.type !== "TOWER_BREAKER") return p;
                        p.scene.floors_hp.mode = e.target.value as "manual" | "exponential";
                        return p;
                      })
                    }
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-cyan-400"
                  >
                    <option value="manual">Manual Array</option>
                    <option value="exponential">Exponential Growth</option>
                  </select>
                </div>

                {config.scene.floors_hp.mode === "manual" ? (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Floor HP Values (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={config.scene.floors_hp.values.join(", ")}
                      onChange={(e) => {
                        const nums = e.target.value
                          .split(",")
                          .map((s) => parseInt(s.trim(), 10))
                          .filter((n) => Number.isFinite(n) && n > 0);
                        if (nums.length > 0) {
                          updateConfig((p) => {
                            if (p.scene.type === "TOWER_BREAKER") p.scene.floors_hp.values = nums;
                            return p;
                          });
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-[11px] text-slate-200"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Base HP</span>
                      <input
                        type="number"
                        value={config.scene.floors_hp.base}
                        onChange={(e) =>
                          updateConfig((p) => {
                            if (p.scene.type === "TOWER_BREAKER")
                              p.scene.floors_hp.base = Math.max(1, parseFloat(e.target.value) || 10);
                            return p;
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Growth</span>
                      <input
                        type="number"
                        step="0.1"
                        value={config.scene.floors_hp.growth}
                        onChange={(e) =>
                          updateConfig((p) => {
                            if (p.scene.type === "TOWER_BREAKER")
                              p.scene.floors_hp.growth = Math.max(1.05, parseFloat(e.target.value) || 1.8);
                            return p;
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Floors Count</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={config.scene.floors_hp.count}
                        onChange={(e) =>
                          updateConfig((p) => {
                            if (p.scene.type === "TOWER_BREAKER")
                              p.scene.floors_hp.count = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 10));
                            return p;
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    updateConfig((p) => {
                      if (p.scene.type !== "TOWER_BREAKER") return p;
                      p.meta.duration_sec = 60;
                      p.arc.calm_outro_sec = 3.0;
                      p.scene.floors_hp.mode = "manual";
                      p.scene.floors_hp.values = [10, 26, 60, 180, 520, 1400, 3800, 9500];
                      p.scene.lanes.forEach((l) => {
                        l.initial_balls = 1;
                        l.on_floor_break = { op: "FOUNTAIN", value: 3 };
                      });
                      return p;
                    })
                  }
                  className="w-full py-1.5 px-2 bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/40 hover:to-blue-600/40 border border-cyan-500/40 rounded text-cyan-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
                  title="Calibrates floor HP so 1 solitary ball rhythmically breaks 8 floors over 60 seconds with a dramatic climax"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Auto-Calibrate for 60s Finish (1-Ball Start)
                </button>

                {/* Pegs Config */}
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">Peg Obstacles</span>
                    <input
                      type="checkbox"
                      checked={config.scene.pegs.enabled}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "TOWER_BREAKER") p.scene.pegs.enabled = e.target.checked;
                          return p;
                        })
                      }
                      className="accent-cyan-400 w-4 h-4 cursor-pointer"
                    />
                  </div>
                  {config.scene.pegs.enabled && (
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">Pin Matrix Pattern</span>
                        <select
                          value={config.scene.pegs.pattern}
                          onChange={(e) =>
                            updateConfig((p) => {
                              if (p.scene.type === "TOWER_BREAKER")
                                p.scene.pegs.pattern = e.target.value as "staggered" | "funnel" | "diamond" | "cathedral";
                              return p;
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-cyan-300 font-semibold text-[11px]"
                        >
                          <option value="staggered">Staggered Pachinko Grid</option>
                          <option value="funnel">Galton Funnel Pyramid</option>
                          <option value="diamond">Diamond Lattice</option>
                          <option value="cathedral">Cathedral Arch Columns</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Rows</span>
                          <input
                            type="number"
                            min={1}
                            max={12}
                            value={config.scene.pegs.rows}
                            onChange={(e) =>
                              updateConfig((p) => {
                                if (p.scene.type === "TOWER_BREAKER")
                                  p.scene.pegs.rows = Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 4));
                                return p;
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Pins / Row</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={config.scene.pegs.per_row}
                            onChange={(e) =>
                              updateConfig((p) => {
                                if (p.scene.type === "TOWER_BREAKER")
                                  p.scene.pegs.per_row = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 4));
                                return p;
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Radius (px)</span>
                          <input
                          type="number"
                          min={3}
                          max={25}
                          value={config.scene.pegs.radius}
                          onChange={(e) =>
                            updateConfig((p) => {
                              if (p.scene.type === "TOWER_BREAKER")
                                p.scene.pegs.radius = Math.max(3, Math.min(25, parseFloat(e.target.value) || 10));
                              return p;
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* Lanes Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">
                      Lanes Configuration ({config.scene.lanes.length}/4)
                    </span>
                    <button
                      type="button"
                      disabled={config.scene.lanes.length >= 4}
                      onClick={() =>
                        updateConfig((p) => {
                          if (p.scene.type !== "TOWER_BREAKER" || p.scene.lanes.length >= 4) return p;
                          const idx = p.scene.lanes.length + 1;
                          p.scene.lanes.push({
                            id: `lane_${idx}`,
                            label: `x2 / FLOOR`,
                            color: "#38bdf8",
                            initial_balls: 3,
                            ball_radius: 7,
                            on_floor_break: { op: "MULTIPLY", value: 2 }
                          });
                          return p;
                        })
                      }
                      className="flex items-center gap-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2 py-1 rounded disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Lane
                    </button>
                  </div>

                  {config.scene.lanes.map((lane, idx) => (
                    <div key={idx} className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={lane.color}
                          onChange={(e) =>
                            updateConfig((p) => {
                              if (p.scene.type === "TOWER_BREAKER") p.scene.lanes[idx].color = e.target.value;
                              return p;
                            })
                          }
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={lane.label}
                          onChange={(e) =>
                            updateConfig((p) => {
                              if (p.scene.type === "TOWER_BREAKER") p.scene.lanes[idx].label = e.target.value;
                              return p;
                            })
                          }
                          className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 font-bold"
                          style={{ color: lane.color }}
                        />
                        {config.scene.type === "TOWER_BREAKER" && config.scene.lanes.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              updateConfig((p) => {
                                if (p.scene.type === "TOWER_BREAKER" && p.scene.lanes.length > 1) {
                                  p.scene.lanes.splice(idx, 1);
                                }
                                return p;
                              })
                            }
                            className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                            title="Delete Lane"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Initial Balls</span>
                          <input
                            type="number"
                            min={1}
                            max={100000}
                            value={lane.initial_balls}
                            onChange={(e) =>
                              updateConfig((p) => {
                                if (p.scene.type === "TOWER_BREAKER")
                                  p.scene.lanes[idx].initial_balls = Math.max(1, parseInt(e.target.value, 10) || 1);
                                return p;
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Ball Radius (px)</span>
                          <input
                            type="number"
                            min={2}
                            max={30}
                            value={lane.ball_radius}
                            onChange={(e) =>
                              updateConfig((p) => {
                                if (p.scene.type === "TOWER_BREAKER")
                                  p.scene.lanes[idx].ball_radius = Math.max(2, Math.min(30, parseFloat(e.target.value) || 6));
                                return p;
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block">On Floor Break</span>
                          <select
                            value={lane.on_floor_break.op}
                            onChange={(e) =>
                              updateConfig((p) => {
                                if (p.scene.type === "TOWER_BREAKER")
                                  p.scene.lanes[idx].on_floor_break.op = e.target.value as
                                    | "NONE"
                                    | "ADD"
                                    | "MULTIPLY"
                                    | "FOUNTAIN"
                                    | "EXPLODE"
                                    | "SCALE_SIZE"
                                    | "SCALE_SPEED"
                                    | "GRAVITY_PULSE";
                                return p;
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-cyan-300 font-semibold"
                          >
                            <option value="FOUNTAIN">FOUNTAIN (Geyser Shower)</option>
                            <option value="EXPLODE">EXPLODE (Radial Shockwave)</option>
                            <option value="MULTIPLY">MULTIPLY (× Population)</option>
                            <option value="ADD">ADD (+ Fixed Balls)</option>
                            <option value="SCALE_SPEED">SCALE_SPEED (Speed Surge)</option>
                            <option value="GRAVITY_PULSE">GRAVITY_PULSE (Float Loft)</option>
                            <option value="SCALE_SIZE">SCALE_SIZE (× Radius)</option>
                            <option value="NONE">NONE (No Action)</option>
                          </select>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Multiplier / Value</span>
                          <input
                            type="number"
                            step="any"
                            value={lane.on_floor_break.value}
                            onChange={(e) =>
                              updateConfig((p) => {
                                if (p.scene.type === "TOWER_BREAKER")
                                  p.scene.lanes[idx].on_floor_break.value = parseFloat(e.target.value) || 1;
                                return p;
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                          />
                        </div>
                      </div>

                      {/* Progressive Per-Floor Sequence */}
                      <div className="pt-1.5 border-t border-slate-800/60">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Progressive Floor Sequence</span>
                          <button
                            type="button"
                            onClick={() =>
                              updateConfig((p) => {
                                if (p.scene.type !== "TOWER_BREAKER") return p;
                                const targetLane = p.scene.lanes[idx];
                                if (targetLane.floor_actions && targetLane.floor_actions.length > 0) {
                                  delete targetLane.floor_actions;
                                } else {
                                  targetLane.floor_actions = [
                                    { op: "ADD", value: 1 },
                                    { op: "MULTIPLY", value: 2 },
                                    { op: "FOUNTAIN", value: 3 },
                                    { op: "SCALE_SPEED", value: 1.15 },
                                    { op: "EXPLODE", value: 3 },
                                    { op: "FOUNTAIN", value: 3 },
                                    { op: "GRAVITY_PULSE", value: 2.2 },
                                    { op: "EXPLODE", value: 4 }
                                  ];
                                }
                                return p;
                              })
                            }
                            className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                          >
                            {lane.floor_actions && lane.floor_actions.length > 0
                              ? `Active (${lane.floor_actions.length} Floors)`
                              : "+ Enable Custom Sequence"}
                          </button>
                        </div>

                        {lane.floor_actions && lane.floor_actions.length > 0 && (
                          <div className="space-y-1 pt-1.5 max-h-36 overflow-y-auto">
                            {lane.floor_actions.map((fa, fIdx) => (
                              <div key={fIdx} className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded text-[10px] border border-slate-800">
                                <span className="font-mono text-cyan-400 w-12 shrink-0">Fl {fIdx + 1}:</span>
                                <select
                                  value={fa.op}
                                  onChange={(e) =>
                                    updateConfig((p) => {
                                      if (p.scene.type === "TOWER_BREAKER" && p.scene.lanes[idx].floor_actions) {
                                        p.scene.lanes[idx].floor_actions![fIdx].op = e.target.value as any;
                                      }
                                      return p;
                                    })
                                  }
                                  className="bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-slate-300 text-[10px] flex-1"
                                >
                                  <option value="FOUNTAIN">FOUNTAIN</option>
                                  <option value="EXPLODE">EXPLODE</option>
                                  <option value="MULTIPLY">MULTIPLY</option>
                                  <option value="ADD">ADD</option>
                                  <option value="SCALE_SPEED">SPEED</option>
                                  <option value="GRAVITY_PULSE">GRAVITY</option>
                                </select>
                                <input
                                  type="number"
                                  step="any"
                                  value={fa.value}
                                  onChange={(e) =>
                                    updateConfig((p) => {
                                      if (p.scene.type === "TOWER_BREAKER" && p.scene.lanes[idx].floor_actions) {
                                        p.scene.lanes[idx].floor_actions![fIdx].value = parseFloat(e.target.value) || 1;
                                      }
                                      return p;
                                    })
                                  }
                                  className="w-14 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 font-mono text-right text-[10px]"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MAZE ESCAPE EDITOR */}
            {config.scene.type === "MAZE_ESCAPE" && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Initial Balls</span>
                    <input
                      type="number"
                      min={1}
                      value={config.scene.initial_balls}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "MAZE_ESCAPE")
                            p.scene.initial_balls = Math.max(1, parseInt(e.target.value, 10) || 10);
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Ball Radius (px)</span>
                    <input
                      type="number"
                      min={2}
                      max={25}
                      value={config.scene.ball_radius}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "MAZE_ESCAPE")
                            p.scene.ball_radius = Math.max(2, parseFloat(e.target.value) || 6);
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Escape Target</span>
                    <input
                      type="number"
                      min={1}
                      value={config.scene.balls_to_escape}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "MAZE_ESCAPE")
                            p.scene.balls_to_escape = Math.max(1, parseInt(e.target.value, 10) || 100);
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Spawn on Escape (+N)</span>
                    <input
                      type="number"
                      min={0}
                      value={config.scene.spawn_on_escape}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "MAZE_ESCAPE")
                            p.scene.spawn_on_escape = Math.max(0, parseInt(e.target.value, 10) || 0);
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="font-semibold text-slate-200">
                    Concentric Rings ({config.scene.rings.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig((p) => {
                        if (p.scene.type !== "MAZE_ESCAPE") return p;
                        const lastR = p.scene.rings[p.scene.rings.length - 1]?.radius ?? 90;
                        p.scene.rings.push({
                          radius: Math.min(500, lastR + 75),
                          thickness: 12,
                          angular_speed: p.scene.rings.length % 2 === 0 ? 1.1 : -1.1,
                          gap_angle_deg: 42,
                          durability: 0
                        });
                        return p;
                      })
                    }
                    className="flex items-center gap-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2 py-1 rounded cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Ring
                  </button>
                </div>

                <div className="space-y-2">
                  {config.scene.rings.map((ring, idx) => (
                    <div key={idx} className="bg-slate-950 p-2 rounded border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-cyan-300">Ring #{idx + 1}</span>
                        {config.scene.type === "MAZE_ESCAPE" && config.scene.rings.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              updateConfig((p) => {
                                if (p.scene.type === "MAZE_ESCAPE" && p.scene.rings.length > 1) {
                                  p.scene.rings.splice(idx, 1);
                                }
                                return p;
                              })
                            }
                            className="text-rose-400 hover:text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        <div>
                          <span className="text-[9px] text-slate-400 block">Radius</span>
                          <input
                            type="number"
                            value={ring.radius}
                            onChange={(e) =>
                              updateConfig((p) => {
                                if (p.scene.type === "MAZE_ESCAPE")
                                  p.scene.rings[idx].radius = Math.max(40, parseFloat(e.target.value) || 100);
                                return p;
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-[11px]"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block">Speed</span>
                          <input
                            type="number"
                            step="0.1"
                            value={ring.angular_speed}
                            onChange={(e) =>
                              updateConfig((p) => {
                                if (p.scene.type === "MAZE_ESCAPE")
                                  p.scene.rings[idx].angular_speed = parseFloat(e.target.value) || 0;
                                return p;
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-[11px]"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block">Gap Angle°</span>
                          <input
                            type="number"
                            value={ring.gap_angle_deg}
                            onChange={(e) =>
                              updateConfig((p) => {
                                if (p.scene.type === "MAZE_ESCAPE")
                                  p.scene.rings[idx].gap_angle_deg = Math.max(10, Math.min(270, parseFloat(e.target.value) || 45));
                                return p;
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-[11px]"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block">Durability</span>
                          <input
                            type="number"
                            min={0}
                            value={ring.durability}
                            onChange={(e) =>
                              updateConfig((p) => {
                                if (p.scene.type === "MAZE_ESCAPE")
                                  p.scene.rings[idx].durability = Math.max(0, parseInt(e.target.value, 10) || 0);
                                return p;
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-[11px]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ALGORITHM ARENA EDITOR */}
            {config.scene.type === "ALGORITHM_ARENA" && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Select Algorithm</label>
                  <select
                    value={config.scene.algorithm}
                    onChange={(e) => {
                      const alg = e.target.value as ArenaId;
                      updateConfig((p) => {
                        if (p.scene.type === "ALGORITHM_ARENA") {
                          p.scene.algorithm = alg;
                          p.scene.params = arenaDefaults(alg);
                        }
                        return p;
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-cyan-400 font-semibold"
                  >
                    <option value="FALLING_SAND">Falling Sand Alchemist (Lava/Water/Ice/Sand)</option>
                    <option value="TSP_2OPT">TSP 2-Opt (Untangling Tour → Loop)</option>
                    <option value="BFS_LIGHTNING">BFS Wavefront vs Lightning (DBM SOR)</option>
                    <option value="BOIDS">Boids Flocking vs Black Hole</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Grid Width Resolution</span>
                    <span className="font-mono text-cyan-400">{config.scene.grid_width}px</span>
                  </div>
                  <input
                    type="range"
                    min={120}
                    max={360}
                    step={30}
                    value={config.scene.grid_width}
                    onChange={(e) =>
                      updateConfig((p) => {
                        if (p.scene.type === "ALGORITHM_ARENA")
                          p.scene.grid_width = parseInt(e.target.value, 10);
                        return p;
                      })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ops Budget / Frame</span>
                    <span className="font-mono text-cyan-400">
                      {config.scene.ops_per_frame.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={40000}
                    step={1000}
                    value={config.scene.ops_per_frame}
                    onChange={(e) =>
                      updateConfig((p) => {
                        if (p.scene.type === "ALGORITHM_ARENA")
                          p.scene.ops_per_frame = parseInt(e.target.value, 10);
                        return p;
                      })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2.5">
                  <span className="font-semibold text-slate-300 block">Algorithm Parameters</span>
                  {ARENA_PARAM_SPECS[config.scene.algorithm].map((spec) => {
                    const val = config.scene.type === "ALGORITHM_ARENA" ? (config.scene.params[spec.key] ?? spec.default) : spec.default;
                    return (
                      <div key={spec.key}>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">{spec.label}</span>
                          <span className="font-mono text-cyan-300">{val}</span>
                        </div>
                        <input
                          type="range"
                          min={spec.min}
                          max={spec.max}
                          step={spec.step}
                          value={val}
                          onChange={(e) =>
                            updateConfig((p) => {
                              if (p.scene.type === "ALGORITHM_ARENA") {
                                p.scene.params = {
                                  ...p.scene.params,
                                  [spec.key]: parseFloat(e.target.value)
                                };
                              }
                              return p;
                            })
                          }
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CUBE ARENA EDITOR */}
            {config.scene.type === "CUBE_ARENA" && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Outer Chamber Silhouette</span>
                  <select
                    value={config.scene.chamber_shape}
                    onChange={(e) =>
                      updateConfig((p) => {
                        if (p.scene.type === "CUBE_ARENA")
                          p.scene.chamber_shape = e.target.value as "circle" | "hexagon" | "diamond";
                        return p;
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-cyan-400 font-semibold"
                  >
                    <option value="hexagon">Hexagonal Centrifuge</option>
                    <option value="diamond">Diamond Prism Boundary</option>
                    <option value="circle">Circular Arena Rim</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Initial Cubes</span>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      value={config.scene.initial_cubes}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "CUBE_ARENA")
                            p.scene.initial_cubes = Math.max(1, parseInt(e.target.value, 10) || 12);
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Cube Size (px)</span>
                    <input
                      type="number"
                      min={4}
                      max={32}
                      value={config.scene.cube_size}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "CUBE_ARENA")
                            p.scene.cube_size = Math.max(4, Math.min(32, parseFloat(e.target.value) || 12));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Outer Circle Radius</span>
                    <input
                      type="number"
                      min={200}
                      max={510}
                      step={10}
                      value={config.scene.outer_radius}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "CUBE_ARENA")
                            p.scene.outer_radius = Math.max(200, Math.min(510, parseFloat(e.target.value) || 440));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Max Cubes Cap</span>
                    <input
                      type="number"
                      min={20}
                      max={2000}
                      step={20}
                      value={config.scene.max_cubes}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "CUBE_ARENA")
                            p.scene.max_cubes = Math.max(20, Math.min(2000, parseInt(e.target.value, 10) || 400));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2">
                  <span className="font-semibold text-slate-300 block text-[11px]">Spinning Cross & Escape Cage</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Cross Blades (0-8)</span>
                      <input
                        type="number"
                        min={0}
                        max={8}
                        value={config.scene.cross_blades}
                        onChange={(e) =>
                          updateConfig((p) => {
                            if (p.scene.type === "CUBE_ARENA")
                              p.scene.cross_blades = Math.max(0, Math.min(8, parseInt(e.target.value, 10) || 0));
                            return p;
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Cross Speed (rad/s)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={config.scene.cross_speed}
                        onChange={(e) =>
                          updateConfig((p) => {
                            if (p.scene.type === "CUBE_ARENA")
                              p.scene.cross_speed = parseFloat(e.target.value) || 0;
                            return p;
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                      />
                    </div>
                  </div>
                  <label className="flex items-center justify-between cursor-pointer pt-1">
                    <span className="text-slate-300">Central Escape Hatch Cage</span>
                    <input
                      type="checkbox"
                      checked={config.scene.cage_enabled}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "CUBE_ARENA") p.scene.cage_enabled = e.target.checked;
                          return p;
                        })
                      }
                      className="accent-cyan-400 w-4 h-4"
                    />
                  </label>
                  {config.scene.cage_enabled && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Cage Size (px)</span>
                        <input
                          type="number"
                          min={60}
                          max={240}
                          value={config.scene.cage_size}
                          onChange={(e) =>
                            updateConfig((p) => {
                              if (p.scene.type === "CUBE_ARENA")
                                p.scene.cage_size = Math.max(60, parseFloat(e.target.value) || 135);
                              return p;
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">+Split on Escape</span>
                        <input
                          type="number"
                          min={0}
                          max={6}
                          value={config.scene.split_on_escape}
                          onChange={(e) =>
                            updateConfig((p) => {
                              if (p.scene.type === "CUBE_ARENA")
                                p.scene.split_on_escape = Math.max(0, Math.min(6, parseInt(e.target.value, 10) || 0));
                              return p;
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* OVERFLOW BOWL EDITOR */}
            {config.scene.type === "OVERFLOW_BOWL" && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Vessel Architecture</span>
                  <select
                    value={config.scene.bowl_shape}
                    onChange={(e) =>
                      updateConfig((p) => {
                        if (p.scene.type === "OVERFLOW_BOWL")
                          p.scene.bowl_shape = e.target.value as "u_bowl" | "goblet_funnel";
                        return p;
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-cyan-400 font-semibold"
                  >
                    <option value="goblet_funnel">Chalice Goblet Vessel</option>
                    <option value="u_bowl">Wide U-Bowl Chamber</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Initial Balls</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={config.scene.initial_balls}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "OVERFLOW_BOWL")
                            p.scene.initial_balls = Math.max(1, parseInt(e.target.value, 10) || 2);
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Ball Radius (px)</span>
                    <input
                      type="number"
                      min={3}
                      max={20}
                      value={config.scene.ball_radius}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "OVERFLOW_BOWL")
                            p.scene.ball_radius = Math.max(3, Math.min(20, parseFloat(e.target.value) || 9));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Bowl Radius (px)</span>
                    <input
                      type="number"
                      min={200}
                      max={500}
                      step={10}
                      value={config.scene.bowl_radius}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "OVERFLOW_BOWL")
                            p.scene.bowl_radius = Math.max(200, Math.min(500, parseFloat(e.target.value) || 420));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Swing Speed (rad/s)</span>
                    <input
                      type="number"
                      step="0.1"
                      min={0.2}
                      max={8}
                      value={config.scene.swing_speed}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "OVERFLOW_BOWL")
                            p.scene.swing_speed = Math.max(0.2, parseFloat(e.target.value) || 2.0);
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between cursor-pointer bg-slate-950 p-2.5 rounded border border-slate-800">
                  <span className="font-semibold text-slate-300">Every Hit Splits a Ball</span>
                  <input
                    type="checkbox"
                    checked={config.scene.split_on_hit}
                    onChange={(e) =>
                      updateConfig((p) => {
                        if (p.scene.type === "OVERFLOW_BOWL") p.scene.split_on_hit = e.target.checked;
                        return p;
                      })
                    }
                    className="accent-cyan-400 w-4 h-4"
                  />
                </label>

                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Split Cooldown Gate</span>
                    <span className="font-mono text-cyan-400">{config.scene.split_cooldown_ms} ms</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={600}
                    step={20}
                    value={config.scene.split_cooldown_ms}
                    onChange={(e) =>
                      updateConfig((p) => {
                        if (p.scene.type === "OVERFLOW_BOWL")
                          p.scene.split_cooldown_ms = parseInt(e.target.value, 10);
                        return p;
                      })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* OPTICAL MIRRORS EDITOR */}
            {config.scene.type === "OPTICAL_MIRRORS" && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Curved Mirror Geometry</span>
                  <select
                    value={config.scene.mirror_shape}
                    onChange={(e) =>
                      updateConfig((p) => {
                        if (p.scene.type === "OPTICAL_MIRRORS")
                          p.scene.mirror_shape = e.target.value as "vesica_piscis" | "ellipse" | "circle";
                        return p;
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-cyan-400 font-semibold"
                  >
                    <option value="vesica_piscis">Vesica Piscis (Twin Curved Lens)</option>
                    <option value="ellipse">True Optical Ellipse (Twin Foci)</option>
                    <option value="circle">Circular Mandala Reflector</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-[11px]">Lens Precession Spin</span>
                    <span className="font-mono text-cyan-400">{config.scene.mirror_spin.toFixed(2)} rad/s</span>
                  </div>
                  <input
                    type="range"
                    min={-1.5}
                    max={1.5}
                    step={0.05}
                    value={config.scene.mirror_spin}
                    onChange={(e) =>
                      updateConfig((p) => {
                        if (p.scene.type === "OPTICAL_MIRRORS")
                          p.scene.mirror_spin = parseFloat(e.target.value);
                        return p;
                      })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Balls Count (Rays)</span>
                    <input
                      type="number"
                      min={1}
                      max={128}
                      value={config.scene.ball_count}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "OPTICAL_MIRRORS")
                            p.scene.ball_count = Math.max(1, Math.min(128, parseInt(e.target.value, 10) || 16));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Optical Speed (m/s)</span>
                    <input
                      type="number"
                      min={4}
                      max={60}
                      value={config.scene.ball_speed}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "OPTICAL_MIRRORS")
                            p.scene.ball_speed = Math.max(4, Math.min(60, parseFloat(e.target.value) || 23));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Lens Width (px)</span>
                    <input
                      type="number"
                      min={300}
                      max={1020}
                      step={20}
                      value={config.scene.width_px}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "OPTICAL_MIRRORS")
                            p.scene.width_px = Math.max(300, Math.min(1020, parseInt(e.target.value, 10) || 740));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Lens Height (px)</span>
                    <input
                      type="number"
                      min={400}
                      max={1600}
                      step={20}
                      value={config.scene.height_px}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "OPTICAL_MIRRORS")
                            p.scene.height_px = Math.max(400, Math.min(1600, parseInt(e.target.value, 10) || 1320));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 bg-slate-950 p-2.5 rounded border border-slate-800">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">Draw Radial Geometric Rays</span>
                    <input
                      type="checkbox"
                      checked={config.scene.show_rays}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "OPTICAL_MIRRORS") p.scene.show_rays = e.target.checked;
                          return p;
                        })
                      }
                      className="accent-cyan-400 w-4 h-4"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">Show Optical Reference Grid</span>
                    <input
                      type="checkbox"
                      checked={config.scene.show_grid}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "OPTICAL_MIRRORS") p.scene.show_grid = e.target.checked;
                          return p;
                        })
                      }
                      className="accent-cyan-400 w-4 h-4"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* PENDULUM WAVE HARP EDITOR */}
            {config.scene.type === "PENDULUM_WAVE" && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Pendulum Strings (4–32)</span>
                    <input
                      type="number"
                      min={4}
                      max={32}
                      value={config.scene.count}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "PENDULUM_WAVE")
                            p.scene.count = Math.max(4, Math.min(32, parseInt(e.target.value, 10) || 18));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Base Cycles / Video</span>
                    <input
                      type="number"
                      min={5}
                      max={80}
                      value={config.scene.base_cycles}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "PENDULUM_WAVE")
                            p.scene.base_cycles = Math.max(5, Math.min(80, parseInt(e.target.value, 10) || 24));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Cycle Step per String</span>
                    <input
                      type="number"
                      step="0.5"
                      min={0.5}
                      max={4}
                      value={config.scene.cycle_step}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "PENDULUM_WAVE")
                            p.scene.cycle_step = Math.max(0.5, Math.min(4, parseFloat(e.target.value) || 1));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Swing Amplitude (px)</span>
                    <input
                      type="number"
                      min={120}
                      max={460}
                      step={10}
                      value={config.scene.amplitude_px}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "PENDULUM_WAVE")
                            p.scene.amplitude_px = Math.max(120, Math.min(460, parseInt(e.target.value, 10) || 380));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Note Strike Trigger Zone</span>
                  <select
                    value={config.scene.trigger}
                    onChange={(e) =>
                      updateConfig((p) => {
                        if (p.scene.type === "PENDULUM_WAVE")
                          p.scene.trigger = e.target.value as "center" | "extremes" | "both";
                        return p;
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-cyan-400 font-semibold"
                  >
                    <option value="center">Center Laser Line (Vertical Harp Pluck)</option>
                    <option value="extremes">Left & Right Turning Extremes</option>
                    <option value="both">Both Center & Extremes (Double Tempo)</option>
                  </select>
                </div>

                <div className="space-y-1.5 bg-slate-950 p-2.5 rounded border border-slate-800">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">Show Harmonic Wave Ribbon</span>
                    <input
                      type="checkbox"
                      checked={config.scene.show_strings}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "PENDULUM_WAVE") p.scene.show_strings = e.target.checked;
                          return p;
                        })
                      }
                      className="accent-cyan-400 w-4 h-4"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">Show Horizontal Track Guides</span>
                    <input
                      type="checkbox"
                      checked={config.scene.show_rest_marks}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "PENDULUM_WAVE") p.scene.show_rest_marks = e.target.checked;
                          return p;
                        })
                      }
                      className="accent-cyan-400 w-4 h-4"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">Liquid Silk Phase Ribbon</span>
                    <input
                      type="checkbox"
                      checked={config.scene.wave_ribbon}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "PENDULUM_WAVE") p.scene.wave_ribbon = e.target.checked;
                          return p;
                        })
                      }
                      className="accent-cyan-400 w-4 h-4"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* CELESTIAL POLYRHYTHM ORBIT EDITOR */}
            {config.scene.type === "POLY_ORBIT" && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Concentric Orbits (3–24)</span>
                    <input
                      type="number"
                      min={3}
                      max={24}
                      value={config.scene.orbits}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "POLY_ORBIT")
                            p.scene.orbits = Math.max(3, Math.min(24, parseInt(e.target.value, 10) || 16));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Radial Strike Gates (1–4)</span>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={config.scene.gates}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "POLY_ORBIT")
                            p.scene.gates = Math.max(1, Math.min(4, parseInt(e.target.value, 10) || 2));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Base Orbit Revolutions</span>
                    <input
                      type="number"
                      min={2}
                      max={40}
                      value={config.scene.first_ratio}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "POLY_ORBIT")
                            p.scene.first_ratio = Math.max(2, Math.min(40, parseInt(e.target.value, 10) || 10));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Ratio Step / Orbit</span>
                    <input
                      type="number"
                      step="0.5"
                      min={0.5}
                      max={4}
                      value={config.scene.ratio_step}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "POLY_ORBIT")
                            p.scene.ratio_step = Math.max(0.5, Math.min(4, parseFloat(e.target.value) || 1));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Orbital Direction Mode</span>
                  <select
                    value={config.scene.direction_mode}
                    onChange={(e) =>
                      updateConfig((p) => {
                        if (p.scene.type === "POLY_ORBIT")
                          p.scene.direction_mode = e.target.value as "same" | "alternate";
                        return p;
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-cyan-400 font-semibold"
                  >
                    <option value="same">Co-Rotating Spiral Wave</option>
                    <option value="alternate">Counter-Rotating Alternating Rings</option>
                  </select>
                </div>

                <label className="flex items-center justify-between cursor-pointer bg-slate-950 p-2.5 rounded border border-slate-800">
                  <span className="text-slate-300">Harmonic Constellation Threads</span>
                  <input
                    type="checkbox"
                    checked={config.scene.constellation_links}
                    onChange={(e) =>
                      updateConfig((p) => {
                        if (p.scene.type === "POLY_ORBIT") p.scene.constellation_links = e.target.checked;
                        return p;
                      })
                    }
                    className="accent-cyan-400 w-4 h-4"
                  />
                </label>
              </div>
            )}

            {/* CHROMATIC PRISM CHAMBER EDITOR */}
            {config.scene.type === "PRISM_CHAMBER" && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Polygon Sides (3–12)</span>
                    <input
                      type="number"
                      min={3}
                      max={12}
                      value={config.scene.sides}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "PRISM_CHAMBER")
                            p.scene.sides = Math.max(3, Math.min(12, parseInt(e.target.value, 10) || 7));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Prism Radius (px)</span>
                    <input
                      type="number"
                      min={220}
                      max={490}
                      step={10}
                      value={config.scene.radius}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "PRISM_CHAMBER")
                            p.scene.radius = Math.max(220, Math.min(490, parseInt(e.target.value, 10) || 420));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Wall Hits / Split</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={config.scene.hits_per_split}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "PRISM_CHAMBER")
                            p.scene.hits_per_split = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 4));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Max Refracted Orbs</span>
                    <input
                      type="number"
                      min={10}
                      max={600}
                      step={10}
                      value={config.scene.max_balls}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "PRISM_CHAMBER")
                            p.scene.max_balls = Math.max(10, Math.min(600, parseInt(e.target.value, 10) || 160));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Prism Spin (rad/s)</span>
                    <input
                      type="number"
                      step="0.05"
                      value={config.scene.spin}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "PRISM_CHAMBER")
                            p.scene.spin = parseFloat(e.target.value) || 0;
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Breathing Amp (0–0.35)</span>
                    <input
                      type="number"
                      step="0.02"
                      min={0}
                      max={0.35}
                      value={config.scene.breathe_amp}
                      onChange={(e) =>
                        updateConfig((p) => {
                          if (p.scene.type === "PRISM_CHAMBER")
                            p.scene.breathe_amp = Math.max(0, Math.min(0.35, parseFloat(e.target.value) || 0));
                          return p;
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between cursor-pointer bg-slate-950 p-2.5 rounded border border-slate-800">
                  <span className="font-semibold text-slate-300">Orbs Inherit Struck Wall Hue</span>
                  <input
                    type="checkbox"
                    checked={config.scene.inherit_color}
                    onChange={(e) =>
                      updateConfig((p) => {
                        if (p.scene.type === "PRISM_CHAMBER") p.scene.inherit_color = e.target.checked;
                        return p;
                      })
                    }
                    className="accent-cyan-400 w-4 h-4"
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: PHYSICS & GAME FEEL                                   */}
        {/* ============================================================ */}
        {activeTab === "physics" && (
          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Physical Ball Cap (Governor)</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {config.physics.physical_cap.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min={200}
                max={8000}
                step={200}
                value={config.physics.physical_cap}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    physics: { ...p.physics, physical_cap: parseInt(e.target.value, 10) }
                  }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] text-slate-400 block">Gravity Y (m/s²)</span>
                <input
                  type="number"
                  step="0.5"
                  value={config.physics.gravity[1]}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      physics: {
                        ...p.physics,
                        gravity: [p.physics.gravity[0], parseFloat(e.target.value) || 0]
                      }
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Gravity X (m/s²)</span>
                <input
                  type="number"
                  step="0.5"
                  value={config.physics.gravity[0]}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      physics: {
                        ...p.physics,
                        gravity: [parseFloat(e.target.value) || 0, p.physics.gravity[1]]
                      }
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Restitution (Bounciness)</span>
                <span className="font-mono text-cyan-400">{config.physics.restitution_default.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.15}
                step={0.01}
                value={config.physics.restitution_default}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    physics: { ...p.physics, restitution_default: parseFloat(e.target.value) }
                  }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Max Speed (m/s)</span>
                <span className="font-mono text-cyan-400">{config.physics.max_speed}</span>
              </div>
              <input
                type="range"
                min={15}
                max={140}
                step={5}
                value={config.physics.max_speed}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    physics: { ...p.physics, max_speed: parseFloat(e.target.value) }
                  }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Speed Lock (0 = Disabled)</span>
                <span className="font-mono text-cyan-400">{config.physics.speed_lock} m/s</span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                step={2}
                value={config.physics.speed_lock}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    physics: { ...p.physics, speed_lock: parseFloat(e.target.value) }
                  }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Physics Substeps / Frame</span>
                <span className="font-mono text-cyan-400">{config.physics.substeps}×</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={config.physics.substeps}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    physics: { ...p.physics, substeps: parseInt(e.target.value, 10) }
                  }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Air Drag / Viscosity */}
            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Viscosity / Fluid Drag</span>
                <span className="font-mono text-cyan-400">
                  {((config.physics.air_drag ?? 0) * 1000).toFixed(1)} mU
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={0.04}
                step={0.002}
                value={config.physics.air_drag ?? 0}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    physics: { ...p.physics, air_drag: parseFloat(e.target.value) }
                  }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Gravity Wave Oscillation */}
            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gravity Wave Oscillation</span>
                <span className="font-mono text-cyan-400">
                  {(config.physics.gravity_oscillation ?? 0).toFixed(1)} rad/s
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={6}
                step={0.2}
                value={config.physics.gravity_oscillation ?? 0}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    physics: { ...p.physics, gravity_oscillation: parseFloat(e.target.value) }
                  }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Game Feel Section */}
            <div className="pt-2 border-t border-slate-800 space-y-2.5">
              <span className="font-semibold text-slate-200 block">Tactile Game Feel</span>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Hit-Stop on Floor Break</span>
                <input
                  type="checkbox"
                  checked={config.feel.hit_stop_on_break}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      feel: { ...p.feel, hit_stop_on_break: e.target.checked }
                    }))
                  }
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>

              <div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hit-Stop Duration (Frames)</span>
                  <span className="font-mono text-cyan-400">{config.feel.hit_stop_frames}f</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={1}
                  value={config.feel.hit_stop_frames}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      feel: { ...p.feel, hit_stop_frames: parseInt(e.target.value, 10) }
                    }))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Velocity Vector Squash & Stretch</span>
                <input
                  type="checkbox"
                  checked={config.feel.squash_stretch}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      feel: { ...p.feel, squash_stretch: e.target.checked }
                    }))
                  }
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>

              <div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Screen Shake Intensity</span>
                  <span className="font-mono text-cyan-400">{config.feel.shake_amount}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={2}
                  value={config.feel.shake_amount}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      feel: { ...p.feel, shake_amount: parseFloat(e.target.value) }
                    }))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="pt-1.5 flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-800/60">
                <span>Calm Outro (No Shake/Flash)</span>
                <span className="font-mono text-cyan-400 font-bold">Last {(config.arc.calm_outro_sec ?? 3.0).toFixed(1)}s</span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: SOUND                                                 */}
        {/* ============================================================ */}
        {activeTab === "sound" && (
          <div className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400 font-semibold">Sonic Palette (Modal Synth)</label>
                <button
                  type="button"
                  onClick={handleAudition}
                  className="flex items-center gap-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer"
                >
                  <Volume2 className="w-3 h-3" /> Preview Sound
                </button>
              </div>
              <select
                value={config.sound.palette}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    sound: { ...p.sound, palette: e.target.value as PaletteName }
                  }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-cyan-400 font-semibold"
              >
                <option value="kalimba_glow">Kalimba Glow (Warm, Tinkling)</option>
                <option value="handpan_steel">Handpan Steel (Metallic Tongue Drum)</option>
                <option value="celesta_chime">Celesta Chime (Glassy Orchestral Bell)</option>
                <option value="glass_bell">Glass Bell (Crystal, Pure)</option>
                <option value="marimba_wood">Marimba Wood (Deep, Woody)</option>
                <option value="thocky_keys">Thocky Keys (Mechanical Thock)</option>
                <option value="water_drop">Water Drop (Organic Droplet)</option>
                <option value="synth_pluck">Synth Pluck (80s Neon Cyberpunk)</option>
                <option value="music_box">Music Box (Antique Mechanical)</option>
                <option value="crystal_bowl">Crystal Singing Bowl (432Hz Zen)</option>
                <option value="cosmic_laser">Cosmic Laser Zap (Sci-Fi Arcade)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Master Volume</span>
                <span className="font-mono text-cyan-400">{Math.round(config.sound.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={config.sound.volume}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    sound: { ...p.sound, volume: parseFloat(e.target.value) }
                  }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <span className="text-[10px] text-slate-400 block">Root Note</span>
                <select
                  value={config.sound.scale.root}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      sound: { ...p.sound, scale: { ...p.sound.scale, root: e.target.value } }
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1"
                >
                  {["C3", "D3", "F3", "G3", "A3", "C4", "D4", "E4", "F4", "G4", "A4"].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Scale Mode</span>
                <select
                  value={config.sound.scale.mode}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      sound: {
                        ...p.sound,
                        scale: { ...p.sound.scale, mode: e.target.value as typeof p.sound.scale.mode }
                      }
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1"
                >
                  <option value="pentatonic_major">Pentatonic Maj</option>
                  <option value="pentatonic_minor">Pentatonic Min</option>
                  <option value="dorian">Dorian</option>
                  <option value="lydian">Lydian</option>
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                  <option value="hirajoshi">Hirajoshi (Japanese Zen)</option>
                  <option value="insen">Insen (Traditional Japanese)</option>
                  <option value="gypsy_minor">Gypsy Minor (Dramatic)</option>
                  <option value="whole_tone">Whole Tone (Dreamy Surreal)</option>
                  <option value="blues">Blues (Pentatonic Soul)</option>
                </select>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Octaves</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={config.sound.scale.octaves}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      sound: {
                        ...p.sound,
                        scale: { ...p.sound.scale, octaves: Math.max(1, Math.min(5, parseInt(e.target.value, 10) || 3)) }
                      }
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">Collision Pitch Mapping</label>
              <select
                value={config.sound.note_mapping}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    sound: { ...p.sound, note_mapping: e.target.value as typeof p.sound.note_mapping }
                  }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1"
              >
                <option value="melodic_step">Melodic Arpeggio (Harmonic ASMR Rhythms)</option>
                <option value="index_degree">Object / String Degree (Harp, Orbits & Prism)</option>
                <option value="floor_level">Floor Depth (Deeper = Higher Pitch)</option>
                <option value="x_position">Horizontal X Position (Left Low → Right High)</option>
                <option value="lane_floor">Lane Index & Floor Tier</option>
                <option value="random">Deterministic Variation</option>
              </select>
            </div>

            {/* Quantizer */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2">
              <span className="font-semibold text-slate-300 block">Musical Quantizer</span>
              <div className="grid grid-cols-3 gap-1">
                {(["FREE", "HARMONIC", "GRID"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() =>
                      updateConfig((p) => ({
                        ...p,
                        sound: { ...p.sound, quantizer: { ...p.sound.quantizer, mode: m } }
                      }))
                    }
                    className={`py-1 rounded font-semibold border cursor-pointer ${
                      config.sound.quantizer.mode === m
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                        : "bg-slate-900 text-slate-400 border-slate-800"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">BPM</span>
                  <input
                    type="number"
                    min={40}
                    max={220}
                    value={config.sound.quantizer.bpm}
                    onChange={(e) =>
                      updateConfig((p) => ({
                        ...p,
                        sound: {
                          ...p.sound,
                          quantizer: { ...p.sound.quantizer, bpm: Math.max(40, Math.min(220, parseInt(e.target.value, 10) || 120)) }
                        }
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Snap Grid (ms)</span>
                  <input
                    type="number"
                    min={5}
                    max={80}
                    value={config.sound.quantizer.snap_ms}
                    onChange={(e) =>
                      updateConfig((p) => ({
                        ...p,
                        sound: {
                          ...p.sound,
                          quantizer: { ...p.sound.quantizer, snap_ms: Math.max(5, parseInt(e.target.value, 10) || 30) }
                        }
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Chord on density */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-semibold text-slate-300">Density-Triggered Chords</span>
                <input
                  type="checkbox"
                  checked={config.sound.chord_on_density.enabled}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      sound: {
                        ...p.sound,
                        chord_on_density: { ...p.sound.chord_on_density, enabled: e.target.checked }
                      }
                    }))
                  }
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">Min Hits (K)</span>
                  <input
                    type="number"
                    min={2}
                    max={40}
                    value={config.sound.chord_on_density.min_hits}
                    onChange={(e) =>
                      updateConfig((p) => ({
                        ...p,
                        sound: {
                          ...p.sound,
                          chord_on_density: {
                            ...p.sound.chord_on_density,
                            min_hits: Math.max(2, parseInt(e.target.value, 10) || 6)
                          }
                        }
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Time Window (ms)</span>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={config.sound.chord_on_density.window_ms}
                    onChange={(e) =>
                      updateConfig((p) => ({
                        ...p,
                        sound: {
                          ...p.sound,
                          chord_on_density: {
                            ...p.sound.chord_on_density,
                            window_ms: Math.max(10, parseInt(e.target.value, 10) || 30)
                          }
                        }
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Cooldown, Escalation & Reverb */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block">Cooldown Gate (ms)</span>
                <input
                  type="number"
                  min={0}
                  max={150}
                  value={config.sound.cooldown_ms}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      sound: { ...p.sound, cooldown_ms: Math.max(0, parseInt(e.target.value, 10) || 18) }
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Pitch Escalation / Floor</span>
                <input
                  type="number"
                  step="0.25"
                  min={0}
                  max={4}
                  value={config.sound.escalation.pitch_semitones_per_floor}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      sound: {
                        ...p.sound,
                        escalation: {
                          ...p.sound.escalation,
                          pitch_semitones_per_floor: Math.max(0, parseFloat(e.target.value) || 0)
                        }
                      }
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Constant-Power Stereo Panning (X)</span>
                <input
                  type="checkbox"
                  checked={config.sound.spatial.pan}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      sound: { ...p.sound, spatial: { ...p.sound.spatial, pan: e.target.checked } }
                    }))
                  }
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Vertical Low-Pass Filter (Y)</span>
                <input
                  type="checkbox"
                  checked={config.sound.spatial.y_filter}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      sound: { ...p.sound, spatial: { ...p.sound.spatial, y_filter: e.target.checked } }
                    }))
                  }
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Stereo Reverb & Sub-Bass Drone</span>
                <input
                  type="checkbox"
                  checked={config.sound.reverb.enabled}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      sound: {
                        ...p.sound,
                        reverb: { ...p.sound.reverb, enabled: e.target.checked },
                        escalation: { ...p.sound.escalation, drone: e.target.checked }
                      }
                    }))
                  }
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: LOOK & HUD                                            */}
        {/* ============================================================ */}
        {activeTab === "look" && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-300">Arena Background Color</span>
              <input
                type="color"
                value={config.look.background}
                onChange={(e) =>
                  updateConfig((p) => ({ ...p, look: { ...p.look, background: e.target.value } }))
                }
                className="w-8 h-6 rounded cursor-pointer bg-transparent border-0"
              />
            </div>

            {/* Background Style */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Background Visual Theme</span>
              <select
                value={config.look.background_style ?? "solid"}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    look: { ...p.look, background_style: e.target.value as BackgroundStyle }
                  }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-cyan-400 font-semibold"
              >
                <option value="solid">Solid Hex Color (Minimalist)</option>
                <option value="radial_vignette">Radial Spotlight Vignette (Studio Focus)</option>
                <option value="deep_space_stars">Deep Space Stars & Nebula (Cosmic Space)</option>
                <option value="cyber_grid">Cyber Synthwave Perspective Grid (Retro Neon)</option>
                <option value="aurora_gradient">Aurora Celestial Gradient (Twilight Skies)</option>
              </select>
            </div>

            {/* Ball Style */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Ball / Object Shape Style</span>
              <select
                value={config.look.ball_style ?? "glow"}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    look: { ...p.look, ball_style: e.target.value as BallStyle }
                  }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-cyan-400 font-semibold"
              >
                <option value="glow">Radial Neon Bloom Glow (Classic ASMR)</option>
                <option value="neon_ring">Hollow Neon Ring / Photon (Energy Ring)</option>
                <option value="shaded_sphere">3D Shaded Marble Sphere (Glass Marble)</option>
                <option value="sparkle_particle">Sparkle Star / Diamond (Crystal Sparkle)</option>
                <option value="solid_cube">3D Tumbling Shaded Cube (Cube Arena)</option>
                <option value="neon_cube">Hollow Neon Glowing Cube (Cyber Square)</option>
              </select>
            </div>

            {/* Color Mode */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Object Color Palette Mode</span>
              <select
                value={config.look.color_mode ?? "lane"}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    look: { ...p.look, color_mode: e.target.value as BallColorMode }
                  }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-cyan-400 font-semibold"
              >
                <option value="lane">Lane / Scene Theme Color</option>
                <option value="rainbow">Full-Spectrum Rainbow (Per-Object Hue)</option>
                <option value="velocity">Velocity Heat Map (Dynamic Energy)</option>
              </select>
            </div>

            {/* Tower HUD Style */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Tower HUD Layout</span>
              <select
                value={config.look.tower_hud_style ?? "classic"}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    look: { ...p.look, tower_hud_style: e.target.value as TowerHudStyle }
                  }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-cyan-400 font-semibold"
              >
                <option value="classic">Classic Edge-to-Edge Lanes</option>
                <option value="duel_cards">Framed Broadcast Duel Cards (VS / LEADER)</option>
              </select>
            </div>

            {/* Floor Style */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Floor Visual Style</span>
              <select
                value={config.look.floor_style ?? "solid"}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    look: { ...p.look, floor_style: e.target.value as FloorStyle }
                  }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-cyan-400 font-semibold"
              >
                <option value="solid">Solid Bar (Standard)</option>
                <option value="neon_laser">Neon Laser Beam (Laser Shield)</option>
                <option value="glass_brick">Glass Crystal Bricks (Glass Bricks)</option>
                <option value="striped_warning">Hazard Warning Stripes (Stripe Pattern)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ball Glow Radius</span>
                <span className="font-mono text-cyan-400">{config.look.glow.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={config.look.glow}
                onChange={(e) =>
                  updateConfig((p) => ({ ...p, look: { ...p.look, glow: parseFloat(e.target.value) } }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Bloom */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-semibold text-slate-300">Bloom & Neon Glow Pass</span>
                <input
                  type="checkbox"
                  checked={config.look.bloom.enabled}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      look: { ...p.look, bloom: { ...p.look.bloom, enabled: e.target.checked } }
                    }))
                  }
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>
              {config.look.bloom.enabled && (
                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Bloom Intensity</span>
                    <span className="font-mono text-cyan-300">{config.look.bloom.intensity.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={2.5}
                    step={0.1}
                    value={config.look.bloom.intensity}
                    onChange={(e) =>
                      updateConfig((p) => ({
                        ...p,
                        look: {
                          ...p.look,
                          bloom: { ...p.look.bloom, intensity: parseFloat(e.target.value) }
                        }
                      }))
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Trail */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-semibold text-slate-300">Persistent Motion Trail</span>
                <input
                  type="checkbox"
                  checked={config.look.trail.enabled}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      look: { ...p.look, trail: { ...p.look.trail, enabled: e.target.checked } }
                    }))
                  }
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>
              {config.look.trail.enabled && (
                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Fade Alpha (Lower = Longer Trail)</span>
                    <span className="font-mono text-cyan-300">{config.look.trail.fade_alpha.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.04}
                    max={0.6}
                    step={0.02}
                    value={config.look.trail.fade_alpha}
                    onChange={(e) =>
                      updateConfig((p) => ({
                        ...p,
                        look: {
                          ...p.look,
                          trail: { ...p.look.trail, fade_alpha: parseFloat(e.target.value) }
                        }
                      }))
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              )}
            </div>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-medium text-slate-300">Pitch-to-Hue Synesthesia</span>
              <input
                type="checkbox"
                checked={config.look.pitch_hue}
                onChange={(e) =>
                  updateConfig((p) => ({ ...p, look: { ...p.look, pitch_hue: e.target.checked } }))
                }
                className="accent-cyan-400 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="font-medium text-slate-300 block">Safe Flash Guard</span>
                <span className="text-[10px] text-slate-500">Max 3 screen flashes per second</span>
              </div>
              <input
                type="checkbox"
                checked={config.look.safe_flash}
                onChange={(e) =>
                  updateConfig((p) => ({ ...p, look: { ...p.look, safe_flash: e.target.checked } }))
                }
                className="accent-cyan-400 w-4 h-4"
              />
            </label>

            {/* Cinematic Post-Processing FX */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2.5">
              <span className="font-semibold text-slate-200 block text-[11px]">Cinematic Post-Processing FX</span>

              {/* Chromatic Aberration */}
              <div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Chromatic Aberration (RGB Shift)</span>
                  <span className="font-mono text-cyan-400">{config.look.chromatic_aberration ?? 0}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={14}
                  step={1}
                  value={config.look.chromatic_aberration ?? 0}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      look: { ...p.look, chromatic_aberration: parseFloat(e.target.value) }
                    }))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* CRT Scanlines */}
              <div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Retro CRT Scanlines</span>
                  <span className="font-mono text-cyan-400">{Math.round((config.look.scanlines ?? 0) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.8}
                  step={0.05}
                  value={config.look.scanlines ?? 0}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      look: { ...p.look, scanlines: parseFloat(e.target.value) }
                    }))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Dark Vignette */}
              <div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Dark Vignette (Cinematic Focus)</span>
                  <span className="font-mono text-cyan-400">{Math.round((config.look.vignette ?? 0.35) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={config.look.vignette ?? 0.35}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      look: { ...p.look, vignette: parseFloat(e.target.value) }
                    }))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>

            {/* HUD Settings */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="font-semibold text-slate-200 block">HUD & Safe Zones</span>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Show Countdown Timer</span>
                <input
                  type="checkbox"
                  checked={config.look.hud.show_timer}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      look: { ...p.look, hud: { ...p.look.hud, show_timer: e.target.checked } }
                    }))
                  }
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Show Bottom Lane Statistics</span>
                <input
                  type="checkbox"
                  checked={config.look.hud.show_lane_counts}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      look: { ...p.look, hud: { ...p.look.hud, show_lane_counts: e.target.checked } }
                    }))
                  }
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Show TikTok / Shorts Safe Zones</span>
                <input
                  type="checkbox"
                  checked={config.look.hud.show_safe_zones}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      look: { ...p.look, hud: { ...p.look.hud, show_safe_zones: e.target.checked } }
                    }))
                  }
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: ARC DIRECTOR & RULE ENGINE                            */}
        {/* ============================================================ */}
        {activeTab === "arc" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <span className="text-[10px] text-slate-400 block">Project Title</span>
                <input
                  type="text"
                  value={config.meta.title}
                  onChange={(e) =>
                    updateConfig((p) => ({ ...p, meta: { ...p.meta, title: e.target.value } }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Duration (sec)</span>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={config.meta.duration_sec}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      meta: { ...p.meta, duration_sec: Math.max(5, Math.min(180, parseInt(e.target.value, 10) || 60)) }
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">Hook Opening Text</label>
              <textarea
                rows={2}
                value={config.arc.hook_text}
                onChange={(e) =>
                  updateConfig((p) => ({ ...p, arc: { ...p.arc, hook_text: e.target.value } }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-cyan-300 font-bold"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block">Hook Text (s)</span>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={60}
                  value={config.arc.hook_duration_sec}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      arc: { ...p.arc, hook_duration_sec: Math.max(0, parseFloat(e.target.value) || 0) }
                    }))
                  }
                  title="Duration hook text is displayed (0 = persistent)"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Loop Dissolve (s)</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={3}
                  value={config.arc.loop_outro_sec}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      arc: { ...p.arc, loop_outro_sec: Math.max(0, Math.min(3, parseFloat(e.target.value) || 0)) }
                    }))
                  }
                  title="Cross-dissolve duration into initial frame"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Calm Outro (s)</span>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={10}
                  value={config.arc.calm_outro_sec ?? 3.0}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      arc: { ...p.arc, calm_outro_sec: Math.max(0, Math.min(10, parseFloat(e.target.value) || 0)) }
                    }))
                  }
                  title="Disable screen shake, flashes, and hit-stops in the final seconds for a smooth outro"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-cyan-300 font-bold"
                />
              </div>
            </div>

            <TensionCurveEditor />

            {/* Rule Engine Editor */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">
                  Rule Engine ({config.rules.length})
                </span>
                <button
                  type="button"
                  onClick={addRule}
                  className="flex items-center gap-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2 py-1 rounded cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Rule
                </button>
              </div>

              {config.rules.length === 0 && (
                <p className="text-[11px] text-slate-500 italic">
                  No custom rules yet. Click &ldquo;Add Rule&rdquo; to build Trigger → Action logic.
                </p>
              )}

              {config.rules.map((rule, rIdx) => (
                <div key={rule.id} className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 font-mono text-cyan-300">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) =>
                          updateConfig((p) => {
                            p.rules[rIdx].enabled = e.target.checked;
                            return p;
                          })
                        }
                        className="accent-cyan-400"
                      />
                      {rule.id}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateConfig((p) => {
                          p.rules.splice(rIdx, 1);
                          return p;
                        })
                      }
                      className="text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-[9px] text-slate-400 block">Trigger</span>
                      <select
                        value={rule.trigger}
                        onChange={(e) =>
                          updateConfig((p) => {
                            p.rules[rIdx].trigger = e.target.value as RuleConfig["trigger"];
                            return p;
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[11px]"
                      >
                        <option value="ON_TIMER">ON_TIMER</option>
                        <option value="ON_BEAT">ON_BEAT</option>
                        <option value="ON_FLOOR_BREAK">ON_FLOOR_BREAK</option>
                        <option value="ON_EXIT_ENTER">ON_EXIT_ENTER</option>
                        <option value="ON_RING_BREAK">ON_RING_BREAK</option>
                        <option value="ON_COUNT_REACHED">ON_COUNT_REACHED</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block">Interval / Threshold</span>
                      <input
                        type="number"
                        step="0.5"
                        value={rule.trigger === "ON_TIMER" ? rule.every_sec : rule.threshold}
                        onChange={(e) =>
                          updateConfig((p) => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0);
                            if (p.rules[rIdx].trigger === "ON_TIMER") p.rules[rIdx].every_sec = v;
                            else p.rules[rIdx].threshold = v;
                            return p;
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  {rule.actions[0] && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[9px] text-slate-400 block">Action</span>
                        <select
                          value={rule.actions[0].type}
                          onChange={(e) =>
                            updateConfig((p) => {
                              p.rules[rIdx].actions[0].type = e.target.value as RuleConfig["actions"][0]["type"];
                              return p;
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[11px]"
                        >
                          <option value="SPAWN">SPAWN (+Balls)</option>
                          <option value="SCALE_BALL">SCALE_BALL</option>
                          <option value="ROTATE_ARENA">ROTATE_ARENA</option>
                          <option value="DAMAGE_WALL">DAMAGE_WALL</option>
                          <option value="SHIFT_PITCH">SHIFT_PITCH</option>
                          <option value="SHAKE">SHAKE</option>
                          <option value="FLASH">FLASH</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block">Count / Value</span>
                        <input
                          type="number"
                          step="any"
                          value={rule.actions[0].type === "SPAWN" ? (rule.actions[0].count ?? 10) : (rule.actions[0].value ?? 1)}
                          onChange={(e) =>
                            updateConfig((p) => {
                              const v = parseFloat(e.target.value) || 1;
                              if (p.rules[rIdx].actions[0].type === "SPAWN") p.rules[rIdx].actions[0].count = Math.max(1, Math.round(v));
                              else p.rules[rIdx].actions[0].value = v;
                              return p;
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 6: SEED SCOUT, MP4 EXPORT & JSON                         */}
        {/* ============================================================ */}
        {activeTab === "export" && (
          <div className="space-y-4">
            {/* Seed Scout */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2.5">
              <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
                <Sparkles className="w-4 h-4" /> Seed Scout (Climax Finder)
              </div>
              <p className="text-[11px] text-slate-400">
                Headless search through seed candidates to find the most dramatic climax.
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {[8, 16, 32].map((cnt) => (
                  <button
                    key={cnt}
                    disabled={isScouting}
                    onClick={() => handleRunSeedScout(cnt)}
                    className="bg-slate-800 hover:bg-slate-700 py-1.5 rounded font-semibold text-cyan-300 border border-slate-700 disabled:opacity-50 cursor-pointer"
                  >
                    {isScouting ? `${scoutProgress}%` : `Scout ${cnt}`}
                  </button>
                ))}
              </div>

              {scoutedSeeds.length > 0 && (
                <div className="space-y-1.5 pt-1 max-h-44 overflow-y-auto">
                  {scoutedSeeds.slice(0, 6).map((res, i) => (
                    <div
                      key={res.seed}
                      onClick={() => updateConfig((p) => ({ ...p, seed: res.seed }))}
                      className={`p-2 rounded border cursor-pointer flex items-center justify-between ${
                        config.seed === res.seed
                          ? "bg-cyan-500/20 border-cyan-500/50"
                          : "bg-slate-900 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div>
                        <div className="font-mono font-bold text-cyan-300">
                          #{i + 1} Seed {res.seed}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Leader: {res.winnerLabel} • Hits: {res.totalHits.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-emerald-400">{res.climaxScore.toFixed(2)}</div>
                        <span className="text-[9px] text-slate-500">Climax Score</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MP4 Export */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2.5">
              <span className="font-semibold text-slate-200 block">Render MP4 (1080×1920 @ {config.meta.fps} FPS)</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">Video Bitrate (Mbps)</span>
                  <input
                    type="number"
                    min={4}
                    max={30}
                    value={config.export.video_mbps}
                    onChange={(e) =>
                      updateConfig((p) => ({
                        ...p,
                        export: { ...p.export, video_mbps: Math.max(4, Math.min(30, parseFloat(e.target.value) || 14)) }
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Output FPS</span>
                  <select
                    value={config.meta.fps}
                    onChange={(e) =>
                      updateConfig((p) => ({
                        ...p,
                        meta: { ...p.meta, fps: parseInt(e.target.value, 10) === 30 ? 30 : 60 }
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                  >
                    <option value={60}>60 FPS</option>
                    <option value={30}>30 FPS</option>
                  </select>
                </div>
              </div>

              {isExporting && exportProgress && (
                <div className="bg-slate-900 p-2.5 rounded border border-cyan-500/40 space-y-1.5">
                  <div className="flex justify-between font-medium">
                    <span className="text-cyan-400">{exportProgress.phase}</span>
                    <span className="font-mono text-slate-200">{exportProgress.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-cyan-400 h-full transition-all duration-150"
                      style={{ width: `${exportProgress.progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>
                      Frame {exportProgress.frame} / {exportProgress.totalFrames}
                    </span>
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      className="text-rose-400 hover:underline font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {exportError && (
                <div className="bg-rose-950/70 border border-rose-500/50 p-2.5 rounded-lg text-rose-300 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Export Failed</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-300/90 break-words font-mono">{exportError}</p>
                  <p className="text-[10px] text-rose-400/80 leading-tight">
                    Tip: Ensure you are using the latest Google Chrome or Microsoft Edge with Hardware Acceleration enabled.
                  </p>
                </div>
              )}

              <button
                disabled={isExporting}
                onClick={handleStartExport}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-2.5 rounded-lg font-bold text-white shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {isExporting ? "Rendering MP4..." : "Export MP4 (1080×1920)"}
              </button>
            </div>

            {/* JSON Import / Export */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileJson className="w-3.5 h-3.5 text-cyan-400" /> ProjectConfig JSON
                </span>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-[11px] text-cyan-300 cursor-pointer"
                >
                  Download .JSON
                </button>
              </div>
              <textarea
                rows={4}
                placeholder="Paste ProjectConfig JSON here to import..."
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded p-2 font-mono text-[10px] text-slate-300"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const res = importJsonConfig(jsonText);
                    setJsonMsg(res.ok ? "Configuration loaded successfully!" : `Error: ${res.error}`);
                  }}
                  className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-white px-2.5 py-1 rounded font-semibold cursor-pointer"
                >
                  <Upload className="w-3 h-3" /> Apply JSON
                </button>
                {jsonMsg && <span className="text-[10px] text-emerald-400 truncate max-w-[180px]">{jsonMsg}</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
