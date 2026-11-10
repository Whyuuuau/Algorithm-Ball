import React from "react";
import { useProjectStore } from "../store/projectStore.js";

export const TensionCurveEditor: React.FC = () => {
  const { config, updateConfig } = useProjectStore();
  const curve = config.arc.tension_curve;

  const width = 320;
  const height = 140;
  const padding = 20;
  const graphW = width - padding * 2;
  const graphH = height - padding * 2;

  // Convert normalized [0, 1] to SVG coordinates
  const toSvgX = (t: number) => padding + t * graphW;
  const toSvgY = (v: number) => padding + (1 - v) * graphH;

  // Path data for spline
  let pathD = "";
  if (curve.length > 0) {
    pathD = `M ${toSvgX(curve[0][0])} ${toSvgY(curve[0][1])}`;
    for (let i = 1; i < curve.length; i++) {
      pathD += ` L ${toSvgX(curve[i][0])} ${toSvgY(curve[i][1])}`;
    }
  }

  const handlePointChange = (idx: number, newV: number) => {
    updateConfig((prev) => {
      const nextCurve = [...prev.arc.tension_curve];
      nextCurve[idx] = [nextCurve[idx][0], Math.max(0, Math.min(1, newV))];
      return {
        ...prev,
        arc: {
          ...prev.arc,
          tension_curve: nextCurve
        }
      };
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-slate-200">Tension Curve (Arc Director)</span>
        <span className="text-slate-400">0.0 (Hook) → 1.0 (Climax)</span>
      </div>

      <div className="relative border border-slate-800 bg-slate-950 rounded overflow-hidden">
        <svg width={width} height={height} className="w-full">
          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={padding + graphW} y2={padding} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1={padding} y1={padding + graphH / 2} x2={padding + graphW} y2={padding + graphH / 2} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1={padding} y1={padding + graphH} x2={padding + graphW} y2={padding + graphH} stroke="#1e293b" strokeDasharray="3 3" />

          {/* Area under curve */}
          {curve.length > 0 && (
            <path
              d={`${pathD} L ${toSvgX(curve[curve.length - 1][0])} ${padding + graphH} L ${toSvgX(curve[0][0])} ${padding + graphH} Z`}
              fill="rgba(0, 229, 255, 0.15)"
            />
          )}

          {/* Curve line */}
          <path d={pathD} fill="none" stroke="#00e5ff" strokeWidth="2.5" />

          {/* Draggable point circles */}
          {curve.map(([t, v], idx) => (
            <circle
              key={idx}
              cx={toSvgX(t)}
              cy={toSvgY(v)}
              r="6"
              fill="#00e5ff"
              stroke="#ffffff"
              strokeWidth="2"
              className="cursor-pointer hover:scale-125 transition-transform"
            />
          ))}
        </svg>
      </div>

      {/* Point Sliders */}
      <div className="mt-3 grid grid-cols-5 gap-1">
        {curve.map(([t, v], idx) => (
          <div key={idx} className="flex flex-col items-center">
            <span className="text-[10px] text-slate-400 font-mono">T{Math.round(t * 100)}%</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={v}
              onChange={(e) => handlePointChange(idx, parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1 mt-1 cursor-pointer"
            />
            <span className="text-[10px] text-cyan-300 font-mono mt-0.5">{v.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
