import { ProjectConfig } from "@asmr/schema";
import { SimCore } from "@asmr/sim-core";
import { AudioDirector } from "@asmr/audio-core";
import { StageRenderer } from "@asmr/render-core";
import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource
} from "mediabunny";

export interface ExportProgress {
  phase: "PREPARING" | "SIMULATING_AUDIO" | "RENDERING_AUDIO" | "RENDERING_VIDEO" | "FINALIZING";
  frame: number;
  totalFrames: number;
  progressPercent: number;
}

/**
 * Tension curve evaluator with piecewise linear interpolation
 */
export function evaluateTensionCurve(curve: [number, number][], progress: number): number {
  if (!curve || curve.length === 0) return 0.5;
  if (curve.length === 1) return curve[0][1];

  const p = Math.max(0, Math.min(1, progress));

  if (p <= curve[0][0]) return curve[0][1];
  if (p >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];

  for (let i = 0; i < curve.length - 1; i++) {
    const [t0, v0] = curve[i];
    const [t1, v1] = curve[i + 1];

    if (p >= t0 && p <= t1) {
      const alpha = (p - t0) / (t1 - t0);
      return v0 + alpha * (v1 - v0);
    }
  }

  return 0.5;
}

export class ExportDirector {
  public static async checkWebCodecsSupport(): Promise<{ supported: boolean; reason?: string }> {
    if (typeof window === "undefined" || typeof VideoEncoder === "undefined") {
      return { supported: false, reason: "WebCodecs VideoEncoder is not available in this browser environment." };
    }

    try {
      const support = await VideoEncoder.isConfigSupported({
        codec: "avc1.640028", // H.264 High Profile Level 4.0
        width: 1080,
        height: 1920,
        bitrate: 14_000_000,
        framerate: 60
      });
      return { supported: !!support.supported };
    } catch (e: any) {
      return { supported: false, reason: e.message };
    }
  }

  public static async exportMp4(
    config: ProjectConfig,
    onProgress: (p: ExportProgress) => void,
    signal?: AbortSignal
  ): Promise<Blob> {
    const totalFrames = Math.round(config.meta.duration_sec * config.meta.fps);
    const fps = config.meta.fps;

    onProgress({
      phase: "PREPARING",
      frame: 0,
      totalFrames,
      progressPercent: 0
    });

    // ==========================================
    // PASS 1: Headless Audio Pass
    // ==========================================
    onProgress({
      phase: "SIMULATING_AUDIO",
      frame: 0,
      totalFrames,
      progressPercent: 5
    });

    const headlessSim = new SimCore(config);
    await headlessSim.init();

    for (let f = 0; f < totalFrames; f++) {
      if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
      headlessSim.step();
      if (f % 60 === 0) {
        onProgress({
          phase: "SIMULATING_AUDIO",
          frame: f,
          totalFrames,
          progressPercent: 5 + Math.round((f / totalFrames) * 20)
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    onProgress({
      phase: "RENDERING_AUDIO",
      frame: totalFrames,
      totalFrames,
      progressPercent: 25
    });

    const audioDirector = new AudioDirector(config.sound);
    const hitLog = headlessSim.getHitLog();
    const audioBuffer = await audioDirector.renderAudioBuffer(hitLog, config.meta.duration_sec);

    // ==========================================
    // PASS 2: Deterministic Video Pass
    // ==========================================
    onProgress({
      phase: "RENDERING_VIDEO",
      frame: 0,
      totalFrames,
      progressPercent: 30
    });

    // Create export canvas strictly at 1080x1920
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 1080;
    exportCanvas.height = 1920;

    const stageRenderer = new StageRenderer(exportCanvas, config, {
      width: 1080,
      height: 1920
    });

    // Initialize fresh SimCore with identical seed
    const videoSim = new SimCore(config);
    await videoSim.init();

    // Setup Mediabunny Output & Sources
    const target = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat(),
      target
    });

    const videoSource = new CanvasSource(exportCanvas, {
      codec: "avc",
      bitrate: 14_000_000
    });
    output.addVideoTrack(videoSource, { frameRate: fps });

    const audioSource = new AudioBufferSource({
      codec: "aac",
      bitrate: 256_000
    });
    output.addAudioTrack(audioSource);

    await output.start();
    await audioSource.add(audioBuffer);

    // Render frame-by-frame and feed directly into WebCodecs VideoEncoder
    for (let f = 0; f < totalFrames; f++) {
      if (signal?.aborted) {
        await output.cancel();
        throw new DOMException("Export cancelled", "AbortError");
      }

      const state = videoSim.step();
      const progress = f / totalFrames;
      const tension = evaluateTensionCurve(config.arc.tension_curve, progress);

      stageRenderer.draw(state, tension);

      const timestampSec = f / fps;
      const durationSec = 1 / fps;
      await videoSource.add(timestampSec, durationSec);

      if (f % 15 === 0) {
        onProgress({
          phase: "RENDERING_VIDEO",
          frame: f,
          totalFrames,
          progressPercent: 30 + Math.round((f / totalFrames) * 65)
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    onProgress({
      phase: "FINALIZING",
      frame: totalFrames,
      totalFrames,
      progressPercent: 98
    });

    await output.finalize();

    const mp4Bytes = target.buffer;
    if (!mp4Bytes) {
      throw new Error("Mediabunny output buffer is empty");
    }

    onProgress({
      phase: "FINALIZING",
      frame: totalFrames,
      totalFrames,
      progressPercent: 100
    });

    return new Blob([mp4Bytes], { type: "video/mp4" });
  }
}
