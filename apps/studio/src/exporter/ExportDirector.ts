import type { ProjectConfig } from "@asmr/schema";
import { evaluateTensionCurve } from "@asmr/schema";
import { SimCore } from "@asmr/sim-core";
import { AudioDirector } from "@asmr/audio-core";
import { StageRenderer } from "@asmr/render-core";
import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  canEncodeVideo,
  canEncodeAudio
} from "mediabunny";

export { evaluateTensionCurve };

export interface ExportProgress {
  phase: "PREPARING" | "SIMULATING_AUDIO" | "RENDERING_AUDIO" | "RENDERING_VIDEO" | "FINALIZING";
  frame: number;
  totalFrames: number;
  progressPercent: number;
}

export class ExportDirector {
  public static async checkWebCodecsSupport(): Promise<{ supported: boolean; reason?: string }> {
    if (typeof window === "undefined" || typeof VideoEncoder === "undefined") {
      return { supported: false, reason: "WebCodecs VideoEncoder is not available in this browser. Please use the latest desktop Chrome or Edge." };
    }
    try {
      const candidates = [
        "avc1.640033", // High Level 5.1
        "avc1.64002a", // High Level 4.2
        "avc1.4d0033", // Main Level 5.1
        "avc1.420033", // Baseline Level 5.1
        "avc1.640028"  // High Level 4.0
      ];
      for (const codec of candidates) {
        try {
          const support = await VideoEncoder.isConfigSupported({
            codec,
            width: 1080,
            height: 1920,
            bitrate: 14_000_000,
            framerate: 60
          });
          if (support.supported) return { supported: true };
        } catch {
          // Probe next candidate
        }
      }
      const mbSupported = await canEncodeVideo("avc", { width: 1080, height: 1920 }).catch(() => false);
      if (mbSupported) return { supported: true };
      return { supported: false, reason: "H.264 1080×1920 @ 60 FPS video format is not supported by this browser's hardware encoder." };
    } catch (e: unknown) {
      return { supported: false, reason: e instanceof Error ? e.message : String(e) };
    }
  }

  public static async exportMp4(
    config: ProjectConfig,
    onProgress: (p: ExportProgress) => void,
    signal?: AbortSignal
  ): Promise<Blob> {
    const totalFrames = Math.round(config.meta.duration_sec * config.meta.fps);
    const fps = config.meta.fps;

    onProgress({ phase: "PREPARING", frame: 0, totalFrames, progressPercent: 0 });

    // PASS 1: Headless simulation -> HitLog -> Offline stereo AudioBuffer
    onProgress({ phase: "SIMULATING_AUDIO", frame: 0, totalFrames, progressPercent: 4 });
    const headlessSim = new SimCore(config, { render: false });
    headlessSim.initSync();

    for (let f = 0; f < totalFrames; f++) {
      if (signal?.aborted) throw new DOMException("Export cancelled by user", "AbortError");
      headlessSim.step();
      if (f % 120 === 0) {
        onProgress({
          phase: "SIMULATING_AUDIO",
          frame: f,
          totalFrames,
          progressPercent: 4 + Math.round((f / totalFrames) * 18)
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    onProgress({ phase: "RENDERING_AUDIO", frame: totalFrames, totalFrames, progressPercent: 24 });
    await new Promise((r) => setTimeout(r, 0));

    let audioBuffer: AudioBuffer | null = null;
    try {
      const audioDirector = new AudioDirector(config.sound);
      const hitLog = headlessSim.getHitLog();
      audioBuffer = await audioDirector.renderAudioBuffer(
        hitLog,
        config.meta.duration_sec,
        config.arc
      );
    } catch (err) {
      console.warn("Failed to render offline audio, continuing without audio track:", err);
    }

    // PASS 2: Re-run identical simulation at 1080x1920 and stream frames to WebCodecs
    onProgress({ phase: "RENDERING_VIDEO", frame: 0, totalFrames, progressPercent: 30 });

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 1080;
    exportCanvas.height = 1920;

    const stageRenderer = new StageRenderer(exportCanvas, config, {
      width: 1080,
      height: 1920
    });

    const videoSim = new SimCore(config, { render: true });
    videoSim.initSync();

    const target = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat(),
      target
    });

    const videoBitrate = Math.round((config.export?.video_mbps ?? 14) * 1_000_000);
    const audioBitrate = Math.round((config.export?.audio_kbps ?? 256) * 1000);

    const videoSource = new CanvasSource(exportCanvas, {
      codec: "avc",
      bitrate: videoBitrate
    });
    output.addVideoTrack(videoSource, { frameRate: fps });

    // Audio support check with automatic fallback: AAC -> Opus -> silent
    let audioSource: AudioBufferSource | null = null;
    if (audioBuffer) {
      try {
        const canAac = typeof AudioEncoder !== "undefined" && (await canEncodeAudio("aac").catch(() => false));
        const canOpus = typeof AudioEncoder !== "undefined" && (await canEncodeAudio("opus").catch(() => false));
        const chosenCodec = canAac ? "aac" : canOpus ? "opus" : null;
        if (chosenCodec) {
          audioSource = new AudioBufferSource({
            codec: chosenCodec,
            bitrate: audioBitrate
          });
          output.addAudioTrack(audioSource);
        }
      } catch (err) {
        console.warn("Audio track initialization skipped:", err);
      }
    }

    await output.start();

    if (audioSource && audioBuffer) {
      try {
        await audioSource.add(audioBuffer);
      } catch (err) {
        console.warn("Audio buffer encoding skipped:", err);
      }
    }

    for (let f = 0; f < totalFrames; f++) {
      if (signal?.aborted) {
        await output.cancel();
        throw new DOMException("Export cancelled by user", "AbortError");
      }

      const state = videoSim.step();
      const progress = f / totalFrames;
      const tension = evaluateTensionCurve(config.arc.tension_curve, progress);

      stageRenderer.draw(state, tension);

      await videoSource.add(f / fps, 1 / fps);

      if (f % 15 === 0) {
        onProgress({
          phase: "RENDERING_VIDEO",
          frame: f,
          totalFrames,
          progressPercent: 30 + Math.round((f / totalFrames) * 66)
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    onProgress({ phase: "FINALIZING", frame: totalFrames, totalFrames, progressPercent: 98 });
    await output.finalize();

    const mp4Bytes = target.buffer;
    if (!mp4Bytes) {
      throw new Error("Output buffer Mediabunny kosong setelah finalize()");
    }

    onProgress({ phase: "FINALIZING", frame: totalFrames, totalFrames, progressPercent: 100 });
    return new Blob([mp4Bytes], { type: "video/mp4" });
  }
}
