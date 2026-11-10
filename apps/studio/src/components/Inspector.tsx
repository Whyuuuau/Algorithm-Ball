import React from "react";
import { useProjectStore, StudioTab } from "../store/projectStore.js";
import { PaletteName, CLASSIC_3_TOWERS_PRESET, MAZE_RINGS_PRESET } from "@asmr/schema";
import { TensionCurveEditor } from "./TensionCurveEditor.js";
import { SeedScout } from "../scout/SeedScout.js";
import { ExportDirector } from "../exporter/ExportDirector.js";
import {
  Layers,
  Music,
  Eye,
  TrendingUp,
  Sparkles,
  Download,
  Play,
  RotateCcw
} from "lucide-react";

export const Inspector: React.FC = () => {
  const {
    config,
    updateConfig,
    activeTab,
    setActiveTab,
    loadPreset,
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

  const handleRunSeedScout = async (candidateCount: number = 8) => {
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

      // WebCodecs check
      const check = await ExportDirector.checkWebCodecsSupport();
      if (!check.supported) {
        alert(
          "Peringatan: WebCodecs VideoEncoder tidak didukung di environment browser ini.\n" +
            (check.reason || "Pastikan Anda menggunakan Chrome/Edge versi terbaru.")
        );
        setExporting(false);
        return;
      }

      const blob = await ExportDirector.exportMp4(config, (progress) => {
        setExportProgress(progress);
      });

      setExportedBlob(blob);

      // Auto-download file
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${config.meta.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${config.seed}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Export gagal: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full text-slate-200">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 overflow-x-auto p-1 bg-slate-950 text-xs">
        <button
          onClick={() => setActiveTab("scene")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded font-medium transition-colors ${
            activeTab === "scene" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Scene
        </button>
        <button
          onClick={() => setActiveTab("sound")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded font-medium transition-colors ${
            activeTab === "sound" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Music className="w-3.5 h-3.5" /> Sound
        </button>
        <button
          onClick={() => setActiveTab("look")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded font-medium transition-colors ${
            activeTab === "look" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Eye className="w-3.5 h-3.5" /> Look
        </button>
        <button
          onClick={() => setActiveTab("arc")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded font-medium transition-colors ${
            activeTab === "arc" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" /> Arc
        </button>
        <button
          onClick={() => setActiveTab("scout")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded font-medium transition-colors ${
            activeTab === "scout" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Scout
        </button>
        <button
          onClick={() => setActiveTab("export")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded font-medium transition-colors ${
            activeTab === "export" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {activeTab === "scene" && (
          <div className="space-y-4">
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Preset Template</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => loadPreset("classic_3_towers")}
                  className="bg-slate-800 hover:bg-slate-700 py-1.5 px-2 rounded font-medium text-left border border-slate-700"
                >
                  🗼 3 Towers
                </button>
                <button
                  onClick={() => loadPreset("maze_rings")}
                  className="bg-slate-800 hover:bg-slate-700 py-1.5 px-2 rounded font-medium text-left border border-slate-700"
                >
                  🌀 Maze Rings
                </button>
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">Master PRNG Seed</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={config.seed}
                  onChange={(e) => updateConfig((p) => ({ ...p, seed: parseInt(e.target.value) || 0 }))}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 w-full font-mono text-cyan-400"
                />
                <button
                  onClick={() => updateConfig((p) => ({ ...p, seed: Math.floor(Math.random() * 9000000) + 1000000 }))}
                  className="bg-slate-800 hover:bg-slate-700 px-3 rounded"
                >
                  🎲
                </button>
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">
                Physical Ball Cap (Governor)
              </label>
              <input
                type="range"
                min="500"
                max="8000"
                step="500"
                value={config.physics.physical_cap}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    physics: { ...p.physics, physical_cap: parseInt(e.target.value) }
                  }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>Safe Preview: 3,000</span>
                <span className="text-cyan-400 font-mono font-bold">
                  {config.physics.physical_cap.toLocaleString()}
                </span>
                <span>Export Max: 8,000</span>
              </div>
            </div>

            {config.scene.type === "TOWER_BREAKER" && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <span className="font-semibold text-slate-300 block">Lanes Configuration</span>
                {(config.scene as any).lanes.map((lane: any, idx: number) => (
                  <div key={lane.id} className="bg-slate-950 p-2 rounded border border-slate-800 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold" style={{ color: lane.color }}>
                        Lane {idx + 1}: {lane.label}
                      </span>
                      <input
                        type="color"
                        value={lane.color}
                        onChange={(e) =>
                          updateConfig((p) => {
                            const lanes = [...(p.scene as any).lanes];
                            lanes[idx] = { ...lanes[idx], color: e.target.value };
                            return { ...p, scene: { ...p.scene, lanes } };
                          })
                        }
                        className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                      />
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Multiplier: {lane.on_floor_break.op} {lane.on_floor_break.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "sound" && (
          <div className="space-y-4">
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Sonic Palette (Modal Synth)</label>
              <select
                value={config.sound.palette}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    sound: { ...p.sound, palette: e.target.value as PaletteName }
                  }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-cyan-400 font-medium"
              >
                <option value="kalimba_glow">Kalimba Glow (Warm, Tinkling)</option>
                <option value="glass_bell">Glass Bell (Crystal Chime)</option>
                <option value="marimba_wood">Marimba Wood (Warm Wood)</option>
                <option value="thocky_keys">Thocky Keys (Mechanical Switch)</option>
                <option value="water_drop">Water Drop (Sine Sweep)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">Scale & Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={config.sound.scale.root}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      sound: { ...p.sound, scale: { ...p.sound.scale, root: e.target.value } }
                    }))
                  }
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1"
                >
                  <option value="C4">C4</option>
                  <option value="D4">D4</option>
                  <option value="E4">E4</option>
                  <option value="F4">F4</option>
                  <option value="G4">G4</option>
                  <option value="A4">A4</option>
                </select>

                <select
                  value={config.sound.scale.mode}
                  onChange={(e) =>
                    updateConfig((p) => ({
                      ...p,
                      sound: { ...p.sound, scale: { ...p.sound.scale, mode: e.target.value as any } }
                    }))
                  }
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1"
                >
                  <option value="pentatonic_major">Pentatonic Major</option>
                  <option value="pentatonic_minor">Pentatonic Minor</option>
                  <option value="dorian">Dorian</option>
                  <option value="lydian">Lydian</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">Musical Quantizer Mode</label>
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
                    className={`py-1.5 rounded font-medium border text-center ${
                      config.sound.quantizer.mode === m
                        ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"
                        : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <label className="text-slate-400 block mb-1 font-medium">Chord-dari-Kepadatan</label>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[11px] space-y-1 text-slate-300">
                <p>
                  Jika ≥ <span className="text-cyan-400 font-bold">{config.sound.chord_on_density.min_hits}</span> hits
                  dalam <span className="text-cyan-400 font-bold">{config.sound.chord_on_density.window_ms}ms</span>,
                  dimainkan sebagai 1 akor harpa harmonis.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "look" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-300">Bloom & Neon Glow</span>
              <input
                type="checkbox"
                checked={config.look.bloom.enabled}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    look: { ...p.look, bloom: { ...p.look.bloom, enabled: e.target.checked } }
                  }))
                }
                className="accent-cyan-400 w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-300">Motion Trails</span>
              <input
                type="checkbox"
                checked={config.look.trail.enabled}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    look: { ...p.look, trail: { ...p.look.trail, enabled: e.target.checked } }
                  }))
                }
                className="accent-cyan-400 w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-300">Pitch-to-Hue Synesthesia</span>
              <input
                type="checkbox"
                checked={config.look.pitch_hue}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    look: { ...p.look, pitch_hue: e.target.checked }
                  }))
                }
                className="accent-cyan-400 w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-300 block">Safe Flash Guard</span>
                <span className="text-[10px] text-slate-500">Maksimal 3 kilatan per detik</span>
              </div>
              <input
                type="checkbox"
                checked={config.look.safe_flash}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    look: { ...p.look, safe_flash: e.target.checked }
                  }))
                }
                className="accent-cyan-400 w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-300">Show Safe Zones (TikTok/Shorts)</span>
              <input
                type="checkbox"
                checked={config.look.hud.show_safe_zones}
                onChange={(e) =>
                  updateConfig((p) => ({
                    ...p,
                    look: { ...p.look, hud: { ...p.look.hud, show_safe_zones: e.target.checked } }
                  }))
                }
                className="accent-cyan-400 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        )}

        {activeTab === "arc" && (
          <div className="space-y-4">
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Hook Text (0-3s)</label>
              <textarea
                rows={2}
                value={config.arc.hook_text}
                onChange={(e) => updateConfig((p) => ({ ...p, arc: { ...p.arc, hook_text: e.target.value } }))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-cyan-300 font-bold"
              />
            </div>

            <TensionCurveEditor />

            <div>
              <label className="text-slate-400 block mb-1 font-medium">Loop Outro Cross-dissolve</label>
              <input
                type="range"
                min="0.2"
                max="1.5"
                step="0.1"
                value={config.arc.loop_outro_sec}
                onChange={(e) =>
                  updateConfig((p) => ({ ...p, arc: { ...p.arc, loop_outro_sec: parseFloat(e.target.value) } }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="text-right text-cyan-400 font-mono">{config.arc.loop_outro_sec}s</div>
            </div>
          </div>
        )}

        {activeTab === "scout" && (
          <div className="space-y-3">
            <div>
              <span className="font-semibold text-slate-200 block mb-1">Seed Scout (Climax Analyzer)</span>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                Simulasi headless cepat untuk mencari seed dengan klimaks paling dramatis berdasarkan skor
                kedekatan finis, pergantian posisi, dan kepadatan benturan akhir.
              </p>
              <div className="flex gap-2">
                <button
                  disabled={isScouting}
                  onClick={() => handleRunSeedScout(8)}
                  className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 py-2 rounded font-semibold text-white transition-all disabled:opacity-50"
                >
                  {isScouting ? `Scouting... ${scoutProgress}%` : "Scout 8 Seeds"}
                </button>
                <button
                  disabled={isScouting}
                  onClick={() => handleRunSeedScout(16)}
                  className="bg-slate-800 hover:bg-slate-700 py-2 px-3 rounded font-medium disabled:opacity-50"
                >
                  16 Seeds
                </button>
              </div>
            </div>

            {scoutedSeeds.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-semibold text-slate-400">Leaderboard Climax Score</span>
                {scoutedSeeds.map((res, i) => (
                  <div
                    key={res.seed}
                    onClick={() => updateConfig((p) => ({ ...p, seed: res.seed }))}
                    className={`p-2 rounded border cursor-pointer transition-all flex items-center justify-between ${
                      config.seed === res.seed
                        ? "bg-cyan-500/20 border-cyan-500/50"
                        : "bg-slate-950 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="font-mono font-bold text-cyan-300">
                        #{i + 1} Seed {res.seed}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Winner: {res.winnerLaneId || "Tie"} • Hits: {res.totalHits.toLocaleString()}
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
        )}

        {activeTab === "export" && (
          <div className="space-y-4">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Format:</span>
                <span className="font-mono font-bold text-slate-200">MP4 (H.264 / AAC)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Resolusi Output:</span>
                <span className="font-mono font-bold text-cyan-400">1080 × 1920 (9:16)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Frame Rate:</span>
                <span className="font-mono font-bold text-slate-200">{config.meta.fps} FPS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Durasi:</span>
                <span className="font-mono font-bold text-slate-200">{config.meta.duration_sec} detik</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Audio Quality:</span>
                <span className="font-mono font-bold text-slate-200">48 kHz Stereo (-1 dBFS)</span>
              </div>
            </div>

            {isExporting && exportProgress && (
              <div className="bg-slate-950 p-3 rounded-lg border border-cyan-500/40 space-y-2">
                <div className="flex justify-between font-medium">
                  <span className="text-cyan-400">{exportProgress.phase}</span>
                  <span className="font-mono text-slate-200">{exportProgress.progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full transition-all duration-200"
                    style={{ width: `${exportProgress.progressPercent}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 text-center">
                  Frame {exportProgress.frame} / {exportProgress.totalFrames}
                </div>
              </div>
            )}

            <button
              disabled={isExporting}
              onClick={handleStartExport}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-3 rounded-lg font-bold text-white shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Rendering MP4..." : "Export MP4 (1080×1920 @ 60 FPS)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
