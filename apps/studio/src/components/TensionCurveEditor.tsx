import React, { useRef, useState } from "react";
import { useProjectStore } from "../store/projectStore.js";
import { evaluateTensionCurve } from "@asmr/schema";
import { Plus, Trash2 } from "lucide-react";

export const TensionCurveEditor: React.FC = () => {
  const { config, updateConfig } = useProjectStore();
  const curve = config.arc.tension_curve;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const width = 320;
  const height = 140;
  const padding = 20;
  const graphW = width - padding * 2;
  const graphH = height - padding * 2;

  const toSvgX = (t: number) => padding + t * graphW;
  const toSvgY = (v: number) => padding + (1 - v) * graphH;

  // Smooth sampled path (48 segments)
  const samples = 48;
  let pathD = "";
  for (let s = 0; s <= samples; s++) {
    const u = s / samples;
    const v = evaluateTensionCurve(curve, u);
    pathD += `${s === 0 ? "M" : "L"} ${toSvgX(u).toFixed(1)} ${toSvgY(v).toFixed(1)} `;
  }

  const updatePoint = (idx: number, t: number, v: number) => {
    updateConfig((prev) => {
      const next = [...prev.arc.tension_curve];
      const clampedT = idx === 0 ? 0 : idx === next.length - 1 ? 1 : Math.max(0.02, Math.min(0.98, t));
      const clampedV = Math.max(0, Math.min(1, Math.round(v * 100) / 100));
      next[idx] = [Math.round(clampedT * 100) / 100, clampedV];
      next.sort((a, b) => a[0] - b[0]);
      return { ...prev, arc: { ...prev.arc, tension_curve: next } };
    });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragIdx === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const y = ((e.clientY - rect.top) / rect.height) * height;
    const t = (x - padding) / graphW;
    const v = 1 - (y - padding) / graphH;
    updatePoint(dragIdx, t, v);
  };

  const handleAddPoint = () => {
    if (curve.length >= 8) return;
    updateConfig((prev) => {
      const next: [number, number][] = [...prev.arc.tension_curve, [0.5, 0.7]];
      next.sort((a, b) => a[0] - b[0]);
      return { ...prev, arc: { ...prev.arc, tension_curve: next } };
    });
  };

  const handleRemovePoint = () => {
    if (curve.length <= 2) return;
    updateConfig((prev) => {
      const next = [...prev.arc.tension_curve];
      next.splice(next.length - 2, 1);
      return { ...prev, arc: { ...prev.arc, tension_curve: next } };
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-slate-200">Tension Curve ({curve.length}/8 titik)</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleAddPoint}
            disabled={curve.length >= 8}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-cyan-400"
            title="Tambah Titik"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRemovePoint}
            disabled={curve.length <= 2}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-rose-400"
            title="Hapus Titik Tengah"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="relative border border-slate-800 bg-slate-950 rounded overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-36 touch-none select-none"
          onPointerMove={handlePointerMove}
          onPointerUp={() => setDragIdx(null)}
          onPointerLeave={() => setDragIdx(null)}
        >
          <line x1={padding} y1={padding} x2={padding + graphW} y2={padding} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1={padding} y1={padding + graphH / 2} x2={padding + graphW} y2={padding + graphH / 2} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1={padding} y1={padding + graphH} x2={padding + graphW} y2={padding + graphH} stroke="#1e293b" strokeDasharray="3 3" />

          {curve.length > 0 && (
            <path
              d={`${pathD} L ${toSvgX(1)} ${padding + graphH} L ${toSvgX(0)} ${padding + graphH} Z`}
              fill="rgba(0, 229, 255, 0.14)"
            />
          )}

          <path d={pathD} fill="none" stroke="#00e5ff" strokeWidth="2.5" />

          {curve.map(([t, v], idx) => (
            <circle
              key={idx}
              cx={toSvgX(t)}
              cy={toSvgY(v)}
              r={dragIdx === idx ? 7 : 5.5}
              fill={dragIdx === idx ? "#ffffff" : "#00e5ff"}
              stroke="#0f172a"
              strokeWidth="2"
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragIdx(idx);
              }}
            />
          ))}
        </svg>
      </div>

      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
        {curve.map(([t, v], idx) => (
          <div key={idx} className="bg-slate-950 border border-slate-800 rounded p-1.5 flex flex-col">
            <span className="text-[10px] text-slate-400 font-mono">T{Math.round(t * 100)}%</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={v}
              onChange={(e) => updatePoint(idx, t, parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1 mt-1 cursor-pointer"
            />
            <span className="text-[10px] text-cyan-300 font-mono mt-0.5 text-right">{v.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
