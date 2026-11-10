import React from "react";
import { useProjectStore } from "../store/projectStore.js";
import { Play, Pause, RotateCcw, StepForward, Gauge } from "lucide-react";

export const TransportBar: React.FC<{
  fpsLive: number;
  onReset: () => void;
  onStep: () => void;
}> = ({ fpsLive, onReset, onStep }) => {
  const {
    config,
    isPlaying,
    setIsPlaying,
    currentFrame,
    setCurrentFrame,
    simState,
    previewWidth,
    setPreviewScale
  } = useProjectStore();

  const totalFrames = Math.round(config.meta.duration_sec * config.meta.fps);
  const progressPercent = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;

  return (
    <div className="bg-slate-900 border-t border-slate-800 p-2.5 flex items-center justify-between gap-4 text-xs select-none">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`p-2 rounded-lg font-bold flex items-center justify-center transition-all ${
            isPlaying ? "bg-amber-500 hover:bg-amber-400 text-slate-950" : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
          }`}
          title={isPlaying ? "Pause" : "Play Live"}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
        </button>

        <button
          onClick={onStep}
          disabled={isPlaying}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
          title="Step 1 Frame"
        >
          <StepForward className="w-4 h-4" />
        </button>

        <button
          onClick={onReset}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="Reset Simulation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Scrubber Slider */}
      <div className="flex-1 flex items-center gap-3">
        <span className="font-mono text-cyan-400 font-bold w-12 text-right">
          {Math.floor(currentFrame / config.meta.fps)}s
        </span>
        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min="0"
            max={totalFrames}
            value={currentFrame}
            onChange={(e) => {
              setCurrentFrame(parseInt(e.target.value));
            }}
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
        <span className="font-mono text-slate-400 w-12">{config.meta.duration_sec}s</span>
      </div>

      {/* Stats Readout */}
      <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-200 font-bold">{fpsLive} FPS</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span>Balls:</span>
          <span className="text-cyan-400 font-bold">
            {simState ? simState.physicalBallCount : 0}
          </span>
          <span className="text-[10px] text-slate-500">
            ({simState ? simState.virtualBallCount.toLocaleString() : 0} virtual)
          </span>
        </div>

        {/* Resolution selector */}
        <select
          value={previewWidth === 1080 ? "1080p" : "540p"}
          onChange={(e) => setPreviewScale(e.target.value as any)}
          className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 text-[10px]"
        >
          <option value="540p">Preview: 540×960 (Optimal)</option>
          <option value="1080p">Preview: 1080×1920 (Hi-DPI)</option>
        </select>
      </div>
    </div>
  );
};
