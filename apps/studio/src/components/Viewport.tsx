import React, { useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "../store/projectStore.js";
import { SimCore } from "@asmr/sim-core";
import { StageRenderer } from "@asmr/render-core";
import { AudioDirector } from "@asmr/audio-core";
import { evaluateTensionCurve } from "@asmr/schema";
import { TransportBar } from "./TransportBar.js";

export const Viewport: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const {
    config,
    isPlaying,
    setIsPlaying,
    seekFrame,
    clearSeek,
    resetCounter,
    setCurrentFrame,
    setSimState,
    previewWidth,
    previewHeight
  } = useProjectStore();

  const simRef = useRef<SimCore | null>(null);
  const stageRef = useRef<StageRenderer | null>(null);
  const audioDirRef = useRef<AudioDirector | null>(null);
  const reqIdRef = useRef<number>(0);
  const hitCursorRef = useRef<number>(0);
  const lastNoteRef = useRef<number | null>(null);

  const [fpsLive, setFpsLive] = useState<number>(60);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);

  // Structural fingerprint: any change to seed, scene, physics, rules, or meta resets SimCore
  const simKey = useMemo(
    () =>
      JSON.stringify({
        seed: config.seed,
        meta: config.meta,
        physics: config.physics,
        scene: config.scene,
        rules: config.rules,
        resetCounter
      }),
    [config.seed, config.meta, config.physics, config.scene, config.rules, resetCounter]
  );

  const soundKey = useMemo(() => JSON.stringify(config.sound), [config.sound]);

  // Initialize or reset simulation when structural config changes
  useEffect(() => {
    if (!canvasRef.current) return;

    const sim = new SimCore(config);
    sim.initSync();
    simRef.current = sim;
    hitCursorRef.current = 0;

    if (!stageRef.current) {
      stageRef.current = new StageRenderer(canvasRef.current, config, {
        width: previewWidth,
        height: previewHeight
      });
    } else {
      stageRef.current.setConfig(config);
      stageRef.current.resize(previewWidth, previewHeight);
      stageRef.current.clearTrail();
    }

    const snap = sim.step();
    setSimState(snap);
    setCurrentFrame(snap.frame);
    const tension = evaluateTensionCurve(config.arc.tension_curve, 0);
    stageRef.current.draw(snap, tension, lastNoteRef.current);
  }, [simKey, previewWidth, previewHeight]);

  // Rebuild AudioDirector when sound settings change
  useEffect(() => {
    audioDirRef.current = new AudioDirector(config.sound);
  }, [soundKey]);

  // Live update look / arc / feel on current frame even while paused
  useEffect(() => {
    if (!stageRef.current || !simRef.current) return;
    stageRef.current.setConfig(config);
    if (!isPlaying) {
      const state = useProjectStore.getState().simState;
      if (state) {
        const progress = state.totalFrames > 0 ? state.frame / state.totalFrames : 0;
        const tension = evaluateTensionCurve(config.arc.tension_curve, progress);
        stageRef.current.draw(state, tension, lastNoteRef.current);
      }
    }
  }, [config.look, config.arc, config.feel]);

  // Handle timeline scrub / seek
  useEffect(() => {
    if (seekFrame === null || !simRef.current || !stageRef.current) return;
    const target = Math.max(0, Math.min(simRef.current.totalFrames - 1, seekFrame));
    stageRef.current.clearTrail();
    const snap = simRef.current.seek(target);
    hitCursorRef.current = simRef.current.getHitLog().length;
    setCurrentFrame(snap.frame);
    setSimState(snap);
    const progress = snap.totalFrames > 0 ? snap.frame / snap.totalFrames : 0;
    const tension = evaluateTensionCurve(config.arc.tension_curve, progress);
    stageRef.current.draw(snap, tension, lastNoteRef.current);
    clearSeek();
  }, [seekFrame]);

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
      if (now - lastTimeRef.current >= 500) {
        setFpsLive(Math.round((frameCountRef.current * 1000) / (now - lastTimeRef.current)));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      const snap = simRef.current.step();
      setCurrentFrame(snap.frame);
      setSimState(snap);

      const progress = totalFrames > 0 ? snap.frame / totalFrames : 0;
      const tension = evaluateTensionCurve(config.arc.tension_curve, progress);

      if (audioDirRef.current) {
        const hitLog = simRef.current.getHitLog();
        if (hitCursorRef.current < hitLog.length) {
          const slice = hitLog.slice(hitCursorRef.current);
          hitCursorRef.current = hitLog.length;
          const midi = audioDirRef.current.playLiveHits(slice, tension);
          if (midi !== null) lastNoteRef.current = midi;
        }
      }

      stageRef.current.draw(snap, tension, lastNoteRef.current);

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

  const handleReset = () => {
    useProjectStore.getState().triggerReset();
  };

  const handleStep = () => {
    if (!simRef.current || !stageRef.current) return;
    const snap = simRef.current.step();
    setCurrentFrame(snap.frame);
    setSimState(snap);
    const totalFrames = Math.round(config.meta.duration_sec * config.meta.fps);
    const progress = totalFrames > 0 ? snap.frame / totalFrames : 0;
    const tension = evaluateTensionCurve(config.arc.tension_curve, progress);
    if (audioDirRef.current) {
      const hitLog = simRef.current.getHitLog();
      if (hitCursorRef.current < hitLog.length) {
        const slice = hitLog.slice(hitCursorRef.current);
        hitCursorRef.current = hitLog.length;
        const midi = audioDirRef.current.playLiveHits(slice, tension);
        if (midi !== null) lastNoteRef.current = midi;
      }
    }
    stageRef.current.draw(snap, tension, lastNoteRef.current);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 h-full overflow-hidden">
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        <div
          className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-800 bg-[#060609]"
          style={{
            aspectRatio: "9 / 16",
            maxHeight: "82vh",
            maxWidth: "100%"
          }}
        >
          <canvas ref={canvasRef} className="w-full h-full object-contain block" />
        </div>
      </div>

      <TransportBar fpsLive={fpsLive} onReset={handleReset} onStep={handleStep} />
    </div>
  );
};
