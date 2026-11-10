import { ProjectConfig } from "@asmr/schema";
import { SimStateSnapshot } from "@asmr/sim-core";

export interface StageRendererOptions {
  width: number;
  height: number;
  scale?: number;
}

export class StageRenderer {
  public readonly config: ProjectConfig;
  public readonly canvas: HTMLCanvasElement;
  public readonly ctx: CanvasRenderingContext2D;

  private trailCanvas: HTMLCanvasElement;
  private trailCtx: CanvasRenderingContext2D;
  private firstFrameCanvas: HTMLCanvasElement | null = null;
  private firstFrameCtx: CanvasRenderingContext2D | null = null;

  public width: number;
  public height: number;
  private shakeOffset: { x: number; y: number } = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, config: ProjectConfig, options?: StageRendererOptions) {
    this.canvas = canvas;
    this.config = config;
    this.width = options?.width || config.meta.width;
    this.height = options?.height || config.meta.height;

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    const ctx = this.canvas.getContext("2d", { alpha: false, willReadFrequently: false });
    if (!ctx) throw new Error("Could not acquire 2D context for canvas");
    this.ctx = ctx;

    // Trail buffer
    this.trailCanvas = document.createElement("canvas");
    this.trailCanvas.width = this.width;
    this.trailCanvas.height = this.height;
    const tCtx = this.trailCanvas.getContext("2d", { alpha: true });
    if (!tCtx) throw new Error("Could not acquire trail context");
    this.trailCtx = tCtx;

    // Clear trail canvas with background
    this.trailCtx.fillStyle = config.look.background || "#060609";
    this.trailCtx.fillRect(0, 0, this.width, this.height);
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.trailCanvas.width = width;
    this.trailCanvas.height = height;
    this.trailCtx.fillStyle = this.config.look.background || "#060609";
    this.trailCtx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draw complete frame given SimCore state snapshot and normalized tension (0.0 to 1.0)
   */
  public draw(state: SimStateSnapshot, tension: number = 0.5): void {
    const scaleX = this.width / this.config.meta.width;
    const scaleY = this.height / this.config.meta.height;

    // 1. Calculate deterministic screen shake when tension > 0.9
    if (tension > 0.9) {
      const shakeAmp = (tension - 0.9) * 25 * scaleX;
      this.shakeOffset.x = Math.sin(state.frame * 2.5) * shakeAmp;
      this.shakeOffset.y = Math.cos(state.frame * 3.1) * shakeAmp;
    } else {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
    }

    // 2. Persistent trail fade
    const fadeAlpha = this.config.look.trail.enabled ? this.config.look.trail.fade_alpha : 1.0;
    this.trailCtx.fillStyle = this.config.look.background || "#060609";
    this.trailCtx.globalAlpha = fadeAlpha;
    this.trailCtx.fillRect(0, 0, this.width, this.height);
    this.trailCtx.globalAlpha = 1.0;

    // 3. Render balls to trail buffer
    this.renderBalls(this.trailCtx, state.ballBuffer, scaleX, scaleY);

    // 4. Render arena walls & floors
    if (this.config.scene.type === "TOWER_BREAKER") {
      this.renderTowerArena(this.trailCtx, state, scaleX, scaleY);
    } else if (this.config.scene.type === "MAZE_ESCAPE") {
      this.renderMazeArena(this.trailCtx, state, scaleX, scaleY);
    }

    // 5. Blit trail buffer to main canvas with screen shake
    this.ctx.save();
    this.ctx.translate(this.shakeOffset.x, this.shakeOffset.y);
    this.ctx.drawImage(this.trailCanvas, 0, 0);
    this.ctx.restore();

    // 6. Capture frame 0 for Loop Outro
    if (state.frame === 0) {
      this.captureFirstFrame();
    }

    // 7. Loop Outro cross-dissolve if in last seconds
    const totalFrames = state.totalFrames;
    const outroFrames = Math.round(this.config.arc.loop_outro_sec * this.config.meta.fps);
    if (state.frame >= totalFrames - outroFrames && this.firstFrameCanvas) {
      const progress = (state.frame - (totalFrames - outroFrames)) / outroFrames;
      this.ctx.save();
      this.ctx.globalAlpha = Math.min(1.0, Math.max(0, progress));
      this.ctx.drawImage(this.firstFrameCanvas, 0, 0);
      this.ctx.restore();
    }

    // 8. Render crisp HUD overlay (Hook text, timer, stats)
    this.renderHUD(this.ctx, state, tension, scaleX, scaleY);
  }

  private renderBalls(
    targetCtx: CanvasRenderingContext2D,
    buffer: Float32Array,
    scaleX: number,
    scaleY: number
  ): void {
    const ballCount = buffer.length / 10;

    for (let i = 0; i < ballCount; i++) {
      const offset = i * 10;
      const x = buffer[offset + 0] * scaleX;
      const y = buffer[offset + 1] * scaleY;
      const vx = buffer[offset + 2];
      const vy = buffer[offset + 3];
      const radius = buffer[offset + 4] * scaleX;
      const r = Math.round(buffer[offset + 5] * 255);
      const g = Math.round(buffer[offset + 6] * 255);
      const b = Math.round(buffer[offset + 7] * 255);

      // Squash and stretch along velocity
      const speed = Math.hypot(vx, vy);
      const stretch = Math.min(1.4, 1 + speed * 0.0008);
      const squash = 1 / stretch;
      const angle = Math.atan2(vy, vx);

      targetCtx.save();
      targetCtx.translate(x, y);
      targetCtx.rotate(angle);
      targetCtx.scale(stretch, squash);

      // Draw glowing ball with radial gradient
      targetCtx.beginPath();
      targetCtx.arc(0, 0, Math.max(1.5, radius), 0, Math.PI * 2);
      targetCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      targetCtx.shadowColor = `rgb(${r}, ${g}, ${b})`;
      targetCtx.shadowBlur = Math.min(12, radius * 2);
      targetCtx.fill();

      targetCtx.restore();
    }
  }

  private renderTowerArena(
    targetCtx: CanvasRenderingContext2D,
    state: SimStateSnapshot,
    scaleX: number,
    scaleY: number
  ): void {
    const laneCount = (this.config.scene as any).lanes.length;
    const laneWidth = this.width / laneCount;
    const ppm = this.config.physics.pixels_per_meter;

    // Draw vertical divider lines
    targetCtx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    targetCtx.lineWidth = 2 * scaleX;
    for (let i = 1; i < laneCount; i++) {
      const x = i * laneWidth;
      targetCtx.beginPath();
      targetCtx.moveTo(x, 0);
      targetCtx.lineTo(x, this.height);
      targetCtx.stroke();
    }

    // Draw Floors
    for (const floor of state.floors) {
      if (floor.broken) continue;

      const laneIdx = (this.config.scene as any).lanes.findIndex((l: any) => l.id === floor.laneId);
      const laneX = laneIdx * laneWidth;
      const y = floor.yPos * ppm * scaleY;
      const floorH = 10 * scaleY;

      const hpPercent = Math.max(0, floor.currentHp / floor.initialHp);

      // Floor background block
      targetCtx.fillStyle = "rgba(20, 20, 35, 0.85)";
      targetCtx.fillRect(laneX + 8 * scaleX, y - floorH / 2, laneWidth - 16 * scaleX, floorH);

      // Neon HP fill
      const laneColor = (this.config.scene as any).lanes[laneIdx].color;
      targetCtx.fillStyle = laneColor;
      targetCtx.shadowColor = laneColor;
      targetCtx.shadowBlur = 8;
      targetCtx.fillRect(
        laneX + 8 * scaleX,
        y - floorH / 2,
        (laneWidth - 16 * scaleX) * hpPercent,
        floorH
      );
      targetCtx.shadowBlur = 0;

      // Floor label (HP)
      targetCtx.fillStyle = "#ffffff";
      targetCtx.font = `bold ${Math.round(11 * scaleX)}px sans-serif`;
      targetCtx.textAlign = "center";
      targetCtx.fillText(
        `L${floor.floorIndex}: ${Math.ceil(floor.currentHp).toLocaleString()}`,
        laneX + laneWidth / 2,
        y + 3 * scaleY
      );
    }
  }

  private renderMazeArena(
    targetCtx: CanvasRenderingContext2D,
    state: SimStateSnapshot,
    scaleX: number,
    scaleY: number
  ): void {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const rings = (this.config.scene as any).rings || [];
    const ppm = this.config.physics.pixels_per_meter;

    targetCtx.save();
    targetCtx.translate(centerX, centerY);

    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      const radius = ring.radius * scaleX;
      const angle = state.ringRotations[r] || 0;
      const gapAngle = (ring.gap_angle_deg * Math.PI) / 180;

      targetCtx.save();
      targetCtx.rotate(angle);

      targetCtx.beginPath();
      targetCtx.arc(0, 0, radius, gapAngle / 2, Math.PI * 2 - gapAngle / 2);
      targetCtx.strokeStyle = "#00e5ff";
      targetCtx.shadowColor = "#00e5ff";
      targetCtx.shadowBlur = 10;
      targetCtx.lineWidth = ring.thickness * scaleX;
      targetCtx.stroke();

      targetCtx.restore();
    }

    // Exit gate
    targetCtx.restore();
    targetCtx.beginPath();
    targetCtx.arc(centerX, centerY + 38 * ppm * scaleY, 40 * scaleX, 0, Math.PI * 2);
    targetCtx.fillStyle = "rgba(0, 255, 128, 0.25)";
    targetCtx.strokeStyle = "#00ff80";
    targetCtx.lineWidth = 3 * scaleX;
    targetCtx.shadowColor = "#00ff80";
    targetCtx.shadowBlur = 15;
    targetCtx.fill();
    targetCtx.stroke();
    targetCtx.shadowBlur = 0;
  }

  private renderHUD(
    ctx: CanvasRenderingContext2D,
    state: SimStateSnapshot,
    tension: number,
    scaleX: number,
    scaleY: number
  ): void {
    ctx.save();

    // 1. Hook Text at top (First 4 seconds or persistent banner)
    const hookText = this.config.arc.hook_text;
    const lines = hookText.split("\n");
    ctx.textAlign = "center";
    ctx.font = `900 ${Math.round(28 * scaleX)}px sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 12;

    const startY = 140 * scaleY;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], this.width / 2, startY + i * 36 * scaleY);
    }
    ctx.shadowBlur = 0;

    // 2. Countdown Timer (MM:SS.ms)
    const remainingSec = Math.max(0, this.config.meta.duration_sec - state.timeSec);
    const mins = Math.floor(remainingSec / 60);
    const secs = Math.floor(remainingSec % 60);
    const millis = Math.floor((remainingSec % 1) * 100);

    const timerStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(millis).padStart(2, "0")}`;
    ctx.font = `bold ${Math.round(44 * scaleX)}px monospace`;
    ctx.fillStyle = tension > 0.8 ? "#ff0055" : "#ffffff";
    ctx.shadowColor = tension > 0.8 ? "#ff0055" : "#000000";
    ctx.shadowBlur = 8;
    ctx.fillText(timerStr, this.width / 2, 230 * scaleY);
    ctx.shadowBlur = 0;

    // 3. Lane Virtual Ball Counts (Bottom HUD)
    if (this.config.scene.type === "TOWER_BREAKER") {
      const lanes = (this.config.scene as any).lanes;
      const laneWidth = this.width / lanes.length;

      for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i];
        const laneX = i * laneWidth + laneWidth / 2;

        ctx.font = `bold ${Math.round(18 * scaleX)}px sans-serif`;
        ctx.fillStyle = lane.color;
        ctx.shadowColor = lane.color;
        ctx.shadowBlur = 6;
        ctx.fillText(lane.label, laneX, this.height - 100 * scaleY);

        ctx.font = `900 ${Math.round(22 * scaleX)}px sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(
          `${state.virtualBallCount.toLocaleString()} BALLS`,
          laneX,
          this.height - 70 * scaleY
        );
        ctx.shadowBlur = 0;
      }
    } else if (this.config.scene.type === "MAZE_ESCAPE") {
      ctx.font = `bold ${Math.round(24 * scaleX)}px sans-serif`;
      ctx.fillStyle = "#00ff80";
      ctx.shadowColor = "#00ff80";
      ctx.shadowBlur = 8;
      ctx.fillText(
        `LOLOS: ${state.escapedBallsCount} / ${state.virtualBallCount}`,
        this.width / 2,
        this.height - 80 * scaleY
      );
      ctx.shadowBlur = 0;
    }

    // 4. Safe Zones Guides (if enabled)
    if (this.config.look.hud.show_safe_zones) {
      ctx.strokeStyle = "rgba(255, 0, 0, 0.4)";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 250 * scaleY, this.width - 150 * scaleX, this.height - 650 * scaleY);
    }

    ctx.restore();
  }

  private captureFirstFrame(): void {
    if (!this.firstFrameCanvas) {
      this.firstFrameCanvas = document.createElement("canvas");
      this.firstFrameCanvas.width = this.width;
      this.firstFrameCanvas.height = this.height;
      this.firstFrameCtx = this.firstFrameCanvas.getContext("2d");
    }
    if (this.firstFrameCtx) {
      this.firstFrameCtx.drawImage(this.canvas, 0, 0);
    }
  }
}
