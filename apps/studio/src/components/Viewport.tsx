import React, { useEffect, useRef, useState } from "react";
import { useProjectStore } from "../store/projectStore.js";
import { SimCore, SimStateSnapshot } from "@asmr/sim-core";
import { StageRenderer } from "@asmr/render-core";
import { AudioDirector } from "@asmr/audio-core";
import { evaluateTensionCurve } from "../exporter/ExportDirector.js";
import { TransportBar } from "./TransportBar.js";

export const Viewport: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const {
    config,
    isPlaying,
    setIsPlaying,
    currentFrame,
    setCurrentFrame,
    setSimState,
    previewWidth,
    previewHeight
  } = useProjectStore();

  const simRef = useRef<SimCore | null>(null);
  const stageRef = useRef<StageRenderer | null>(null);
  const audioDirRef = useRef<AudioDirector | null>(null);
  const reqIdRef = useRef<number>(0);

  const [fpsLive, setFpsLive] = useState<number>(60);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);

  // Initialize Simulation and Renderer when config or resolution changes
  const initSimulation = async () => {
    if (!canvasRef.current) return;

    const sim = new SimCore(config);
    await sim.init();
    simRef.current = sim;

    const stage = new StageRenderer(canvasRef.current, config, {
      width: previewWidth,
      height: previewHeight
    });
    stageRef.current = stage;

    const audioDir = new AudioDirector(config.sound);
    audioDirRef.current = audioDir;

    // Draw frame 0
    const snap = sim.step();
    setSimState(snap);
    setCurrentFrame(0);
    stage.draw(snap, 0.2);
  };

  useEffect(() => {
    initSimulation();
    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
    };
  }, [config.seed, config.scene.type, previewWidth, previewHeight]);

  // Main interactive animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      return;
    }

    const totalFrames = Math.round(config.meta.duration_sec * config.meta.fps);

    const loop = () => {
      if (!simRef.current || !stageRef.current) return;

      const now = performance.now();
      frameCountRef.current++;
      if (now - lastTimeRef.current >= 1000) {
        setFpsLive(Math.round((frameCountRef.current * 1000) / (now - lastTimeRef.current)));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      const snap = simRef.current.step();
      setCurrentFrame(snap.frame);
      setSimState(snap);

      const progress = snap.frame / totalFrames;
      const tension = evaluateTensionCurve(config.arc.tension_curve, progress);

      // Play audio events for this frame
      if (audioDirRef.current) {
        const hitLog = simRef.current.getHitLog();
        const frameHits = hitLog.filter((h) => Math.abs(h.t - snap.timeSec) < 0.017);
        for (const hit of frameHits) {
          audioDirRef.current.playLiveEvent(hit);
        }
      }

      stageRef.current.draw(snap, tension);

      if (snap.frame >= totalFrames) {
        setIsPlaying(false);
        return;
      }

      reqIdRef.current = requestAnimationFrame(loop);
    };

    reqIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
    };
  }, [isPlaying, config]);

  const handleReset = async () => {
    setIsPlaying(false);
    await initSimulation();
  };

  const handleStep = () => {
    if (!simRef.current || !stageRef.current) return;
    const snap = simRef.current.step();
    setCurrentFrame(snap.frame);
    setSimState(snap);
    const progress = snap.frame / Math.round(config.meta.duration_sec * config.meta.fps);
    const tension = evaluateTensionCurve(config.arc.tension_curve, progress);
    stageRef.current.draw(snap, tension);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 h-full overflow-hidden">
      {/* Centered Canvas Container */}
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        <div
          className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-800 bg-[#060609]"
          style={{
            aspectRatio: "9 / 16",
            maxHeight: "82vh",
            maxWidth: "100%"
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain block"
          />
        </div>
      </div>

      {/* Transport bar attached at bottom */}
      <TransportBar fpsLive={fpsLive} onReset={handleReset} onStep={handleStep} />
    </div>
  );
};
