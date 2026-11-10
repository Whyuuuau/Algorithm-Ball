import React, { useRef, useState } from "react";
import { useProjectStore } from "../store/projectStore.js";
import {
  type PaletteName,
  type RuleConfig,
  PRESETS,
  TowerBreakerSceneSchema,
  MazeEscapeSceneSchema,
  AlgorithmArenaSchema
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
  Save
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

  const [presetName, setPresetName] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [jsonMsg, setJsonMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleAudition = () => {
    const dir = new AudioDirector(config.sound);
    dir.auditionNote();
  };

  const handleSwitchSceneType = (type: "TOWER_BREAKER" | "MAZE_ESCAPE" | "ALGORITHM_ARENA") => {
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

      const check = await ExportDirector.checkWebCodecsSupport();
      if (!check.supported) {
        alert(
          "WebCodecs VideoEncoder tidak didukung di browser ini.\n" +
            (check.reason || "Gunakan Chrome atau Edge desktop.")
        );
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
        alert("Export gagal: " + (e instanceof Error ? e.message : String(e)));
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
            ["physics", "Fisika", Sliders],
            ["sound", "Suara", Music],
            ["look", "Visual", Eye],
            ["arc", "Arc/Rule", TrendingUp],
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
            {/* Presets */}
            <div>
              <label className="text-slate-400 block mb-1.5 font-semibold">Preset Bawaan (7 Template)</label>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(PRESETS).map(([key, item]) => (
                  <button
                    key={key}
                    onClick={() => loadPreset(key)}
                    className="bg-slate-800/90 hover:bg-slate-700 py-1.5 px-2.5 rounded font-medium text-left border border-slate-700/80 truncate cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom saved presets */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2">
              <span className="font-semibold text-slate-300 block">Preset Kustom Lokal</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Nama preset baru..."
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
                  <Save className="w-3 h-3" /> Simpan
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
              <label className="text-slate-400 block mb-1 font-semibold">Mode Arena</label>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    ["TOWER_BREAKER", "Tower"],
                    ["MAZE_ESCAPE", "Maze Rings"],
                    ["ALGORITHM_ARENA", "Algoritma"]
                  ] as const
                ).map(([t, lbl]) => (
                  <button
                    key={t}
                    onClick={() => handleSwitchSceneType(t)}
                    className={`py-1.5 rounded font-semibold border cursor-pointer ${
                      config.scene.type === t
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                        : "bg-slate-950 text-slate-400 border-slate-800"
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
                  title="Acak Seed"
                >
                  🎲
                </button>
              </div>
            </div>

            {/* TOWER BREAKER EDITOR */}
            {config.scene.type === "TOWER_BREAKER" && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Konfigurasi Lantai (HP)</span>
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
                    <option value="exponential">Eksponensial</option>
                  </select>
                </div>

                {config.scene.floors_hp.mode === "manual" ? (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Daftar HP Lantai (pisahkan koma)
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
                      <span className="text-[10px] text-slate-400 block">Jml Lantai</span>
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

                {/* Pegs Config */}
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">Pin Rintangan (Pegs)</span>
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
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Baris</span>
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
                        <span className="text-[10px] text-slate-400 block">Pin/Baris</span>
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
                  )}
                </div>

                {/* Lanes Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">
                      Daftar Lane ({config.scene.lanes.length}/4)
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
                            label: `x2 / LANTAI`,
                            color: "#38bdf8",
                            initial_balls: 5,
                            ball_radius: 6,
                            on_floor_break: { op: "MULTIPLY", value: 2 }
                          });
                          return p;
                        })
                      }
                      className="flex items-center gap-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2 py-1 rounded disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Tambah Lane
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
                            title="Hapus Lane"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Bola Awal</span>
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
                          <span className="text-[10px] text-slate-400 block">Radius Bola (px)</span>
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
                          <span className="text-[10px] text-slate-400 block">Aksi Lantai Pecah</span>
                          <select
                            value={lane.on_floor_break.op}
                            onChange={(e) =>
                              updateConfig((p) => {
                                if (p.scene.type === "TOWER_BREAKER")
                                  p.scene.lanes[idx].on_floor_break.op = e.target.value as
                                    | "NONE"
                                    | "ADD"
                                    | "MULTIPLY"
                                    | "SCALE_SIZE"
                                    | "SCALE_SPEED";
                                return p;
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1"
                          >
                            <option value="MULTIPLY">MULTIPLY (×N)</option>
                            <option value="ADD">ADD (+N)</option>
                            <option value="SCALE_SIZE">SCALE_SIZE (×Radius)</option>
                            <option value="SCALE_SPEED">SCALE_SPEED (×Kecepatan)</option>
                            <option value="NONE">NONE</option>
                          </select>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Nilai Aksi</span>
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
                    <span className="text-[10px] text-slate-400 block">Bola Awal</span>
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
                    <span className="text-[10px] text-slate-400 block">Radius Bola (px)</span>
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
                    <span className="text-[10px] text-slate-400 block">Target Lolos</span>
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
                    <span className="text-[10px] text-slate-400 block">Spawn saat Lolos (+N)</span>
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
                    Cincin Konsentris ({config.scene.rings.length})
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
                    <Plus className="w-3 h-3" /> Tambah Cincin
                  </button>
                </div>

                <div className="space-y-2">
                  {config.scene.rings.map((ring, idx) => (
                    <div key={idx} className="bg-slate-950 p-2 rounded border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-cyan-300">Cincin #{idx + 1}</span>
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
                          <span className="text-[9px] text-slate-400 block">Celah°</span>
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
                          <span className="text-[9px] text-slate-400 block">HP Lolos</span>
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
                  <label className="text-slate-400 block mb-1 font-semibold">Pilih Algoritma</label>
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
                    <option value="FALLING_SAND">Falling Sand Alchemist (Lava/Air/Es/Pasir)</option>
                    <option value="TSP_2OPT">TSP 2-Opt (Benang Kusut → Cincin)</option>
                    <option value="BFS_LIGHTNING">BFS Wavefront vs Petir (DBM SOR)</option>
                    <option value="BOIDS">Boids Flock vs Lubang Hitam</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Resolusi Grid Lebar</span>
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
                  <span className="font-semibold text-slate-300 block">Parameter Algoritma</span>
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
                <span className="text-[11px] text-slate-400 block">Gravitasi Y (m/s²)</span>
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
                <span className="text-[11px] text-slate-400 block">Gravitasi X (m/s²)</span>
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
                <span className="text-slate-400">Restitution (Pantulan)</span>
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
                <span className="text-slate-400">Kecepatan Maks (m/s)</span>
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
                <span className="text-slate-400">Speed Lock (0 = Nonaktif)</span>
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
                <span className="text-slate-400">Substeps Fisika / Frame</span>
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

            {/* Game Feel Section */}
            <div className="pt-2 border-t border-slate-800 space-y-2.5">
              <span className="font-semibold text-slate-200 block">Tactile Game Feel</span>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Hit-Stop saat Lantai Pecah</span>
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
                  <span className="text-slate-400">Durasi Hit-Stop (Frame)</span>
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
                <span className="text-slate-300">Squash & Stretch Vektor Kecepatan</span>
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
                  <span className="text-slate-400">Intensitas Screen Shake</span>
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
                  <Volume2 className="w-3 h-3" /> Tes Bunyi
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
                <option value="kalimba_glow">Kalimba Glow (Hangat, Tinkling)</option>
                <option value="glass_bell">Glass Bell (Jernih, Kristal)</option>
                <option value="marimba_wood">Marimba Wood (Bulat, Kayu)</option>
                <option value="thocky_keys">Thocky Keys (Keyboard Mekanik)</option>
                <option value="water_drop">Water Drop (Tetes Air)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Volume Master</span>
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
                <span className="text-[10px] text-slate-400 block">Root Nada</span>
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
                <span className="text-[10px] text-slate-400 block">Mode Skala</span>
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
                </select>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Oktaf</span>
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
              <label className="text-slate-400 block mb-1 font-medium">Pemetaan Pitch Benturan</label>
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
                <option value="x_position">Posisi X (Kiri Rendah → Kanan Tinggi)</option>
                <option value="lane_floor">Indeks Lane & Nomor Lantai</option>
                <option value="random">Variasi Deterministik</option>
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
                <span className="font-semibold text-slate-300">Chord-dari-Kepadatan</span>
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
                  <span className="text-[10px] text-slate-400 block">Jendela (ms)</span>
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
                <span className="text-[10px] text-slate-400 block">Pitch Escalation / Lantai</span>
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
                <span className="text-slate-300">Filter Low-Pass Vertikal (Y)</span>
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
              <span className="font-medium text-slate-300">Warna Latar Arena</span>
              <input
                type="color"
                value={config.look.background}
                onChange={(e) =>
                  updateConfig((p) => ({ ...p, look: { ...p.look, background: e.target.value } }))
                }
                className="w-8 h-6 rounded cursor-pointer bg-transparent border-0"
              />
            </div>

            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Radius Glow Bola</span>
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
                    <span className="text-slate-400">Intensitas Bloom</span>
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
                    <span className="text-slate-400">Fade Alpha (Kecil = Ekor Panjang)</span>
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
                <span className="text-[10px] text-slate-500">Maksimal 3 kilatan per detik</span>
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

            {/* HUD Settings */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="font-semibold text-slate-200 block">HUD & Safe Zones</span>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Tampilkan Countdown Timer</span>
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
                <span className="text-slate-300">Tampilkan Statistik Bawah</span>
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
                <span className="text-slate-300">Tampilkan Safe Zone TikTok/Shorts</span>
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
                <span className="text-[10px] text-slate-400 block">Judul Proyek</span>
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
                <span className="text-[10px] text-slate-400 block">Durasi (dtk)</span>
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
              <label className="text-slate-400 block mb-1 font-medium">Teks Hook Pembuka</label>
              <textarea
                rows={2}
                value={config.arc.hook_text}
                onChange={(e) =>
                  updateConfig((p) => ({ ...p, arc: { ...p.arc, hook_text: e.target.value } }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-cyan-300 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block">Durasi Teks Hook (0 = Selalu)</span>
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
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Loop Outro Cross-Dissolve (dtk)</span>
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
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
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
                  <Plus className="w-3 h-3" /> Tambah Rule
                </button>
              </div>

              {config.rules.length === 0 && (
                <p className="text-[11px] text-slate-500 italic">
                  Belum ada rule tambahan. Klik &ldquo;Tambah Rule&rdquo; untuk membuat aturan Trigger → Action.
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
                          <option value="SPAWN">SPAWN (+Bola)</option>
                          <option value="SCALE_BALL">SCALE_BALL</option>
                          <option value="ROTATE_ARENA">ROTATE_ARENA</option>
                          <option value="DAMAGE_WALL">DAMAGE_WALL</option>
                          <option value="SHIFT_PITCH">SHIFT_PITCH</option>
                          <option value="SHAKE">SHAKE</option>
                          <option value="FLASH">FLASH</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block">Jumlah / Nilai</span>
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
                Uji banyak kandidat seed secara headless untuk memilih yang klimaksnya paling dramatis.
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
                          Unggul: {res.winnerLabel} • Hits: {res.totalHits.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-emerald-400">{res.climaxScore.toFixed(2)}</div>
                        <span className="text-[9px] text-slate-500">Skor Klimaks</span>
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
                  <span className="text-[10px] text-slate-400 block">Bitrate Video (Mbps)</span>
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
                  <span className="text-[10px] text-slate-400 block">FPS Output</span>
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
                      Batalkan
                    </button>
                  </div>
                </div>
              )}

              <button
                disabled={isExporting}
                onClick={handleStartExport}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-2.5 rounded-lg font-bold text-white shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {isExporting ? "Merender MP4..." : "Export MP4 (1080×1920)"}
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
                  Unduh .JSON
                </button>
              </div>
              <textarea
                rows={4}
                placeholder="Tempel JSON ProjectConfig di sini untuk impor..."
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded p-2 font-mono text-[10px] text-slate-300"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const res = importJsonConfig(jsonText);
                    setJsonMsg(res.ok ? "Konfigurasi berhasil dimuat!" : `Error: ${res.error}`);
                  }}
                  className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-white px-2.5 py-1 rounded font-semibold cursor-pointer"
                >
                  <Upload className="w-3 h-3" /> Terapkan JSON
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
