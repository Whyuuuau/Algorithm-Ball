import React, { useEffect } from "react";
import { useProjectStore } from "./store/projectStore.js";
import { Viewport } from "./components/Viewport.js";
import { Inspector } from "./components/Inspector.js";
import { Sparkles, Download, ShieldCheck, Undo2, Redo2 } from "lucide-react";

export const App: React.FC = () => {
  const {
    config,
    simState,
    setActiveTab,
    undo,
    redo,
    undoStack,
    redoStack,
    isPlaying,
    setIsPlaying
  } = useProjectStore();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, isPlaying, setIsPlaying]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Header */}
      <header className="h-12 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-md shadow-cyan-500/50" />
            <span className="font-black text-sm tracking-wide bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              ASMR STUDIO
            </span>
            <span className="bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded text-[10px] font-mono border border-cyan-500/30">
              v2.0
            </span>
          </div>

          <span className="text-slate-600">|</span>

          <span className="text-slate-300 font-semibold truncate max-w-[240px]">
            {config.meta.title}
          </span>

          <span className="bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded font-mono text-[10px] border border-slate-700/60">
            {config.scene.type}
          </span>
        </div>

        {/* Status & Quick Actions */}
        <div className="flex items-center gap-2.5">
          {/* Undo / Redo */}
          <div className="flex items-center bg-slate-950 rounded border border-slate-800 overflow-hidden">
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              title="Undo (Ctrl+Z)"
              className="px-2 py-1 hover:bg-slate-800 disabled:opacity-30 text-slate-300 transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={redoStack.length === 0}
              title="Redo (Ctrl+Y)"
              className="px-2 py-1 hover:bg-slate-800 disabled:opacity-30 text-slate-300 border-l border-slate-800 transition-colors"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800 text-[11px] font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">FNV-1a:</span>
            <span className="text-emerald-400 font-bold">
              {simState
                ? `0x${simState.hash.toString(16).toUpperCase().padStart(8, "0")}`
                : "SYNCED"}
            </span>
          </div>

          <button
            onClick={() => setActiveTab("export")}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded text-amber-400 font-medium border border-slate-700 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Seed Scout
          </button>

          <button
            onClick={() => setActiveTab("export")}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-3 py-1 rounded text-white font-bold shadow-md shadow-emerald-950 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export 1080×1920 MP4
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center Viewport */}
        <Viewport />

        {/* Right Inspector */}
        <Inspector />
      </div>
    </div>
  );
};
