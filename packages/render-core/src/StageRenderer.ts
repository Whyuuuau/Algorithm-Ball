import type { ProjectConfig } from "@asmr/schema";
import { ARENA_H, ARENA_W, type SimSnapshot } from "@asmr/sim-core";

export interface StageRendererOptions {
  width: number;
  height: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return [0, 229, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (hh < 1) { r = c; g = x; }
  else if (hh < 2) { r = x; g = c; }
  else if (hh < 3) { g = c; b = x; }
  else if (hh < 4) { g = x; b = c; }
  else if (hh < 5) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export class StageRenderer {
  public config: ProjectConfig;
  public readonly canvas: HTMLCanvasElement;
  public readonly ctx: CanvasRenderingContext2D;

  private trailCanvas: HTMLCanvasElement;
  private trailCtx: CanvasRenderingContext2D;
  private bloomCanvas: HTMLCanvasElement;
  private bloomCtx: CanvasRenderingContext2D;
  private firstFrameCanvas: HTMLCanvasElement | null = null;
  private firstFrameCtx: CanvasRenderingContext2D | null = null;
  private arenaCanvas: HTMLCanvasElement | null = null;
  private arenaCtx: CanvasRenderingContext2D | null = null;
  private arenaImageData: ImageData | null = null;

  private spriteCache = new Map<string, HTMLCanvasElement>();
  public width: number;
  public height: number;
  private lastFlashTimeSec = -10;
  private activeHue = 190;

  constructor(canvas: HTMLCanvasElement, config: ProjectConfig, options?: StageRendererOptions) {
    this.canvas = canvas;
    this.config = config;
    this.width = options?.width || config.meta.width;
    this.height = options?.height || config.meta.height;

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Could not acquire 2D context for canvas");
    this.ctx = ctx;

    this.trailCanvas = document.createElement("canvas");
    this.trailCanvas.width = this.width;
    this.trailCanvas.height = this.height;
    const tCtx = this.trailCanvas.getContext("2d", { alpha: false });
    if (!tCtx) throw new Error("Could not acquire trail context");
    this.trailCtx = tCtx;

    this.bloomCanvas = document.createElement("canvas");
    this.bloomCanvas.width = Math.max(64, Math.round(this.width / 4));
    this.bloomCanvas.height = Math.max(64, Math.round(this.height / 4));
    const bCtx = this.bloomCanvas.getContext("2d", { alpha: false });
    if (!bCtx) throw new Error("Could not acquire bloom context");
    this.bloomCtx = bCtx;

    this.clearTrail();
  }

  public setConfig(config: ProjectConfig): void {
    this.config = config;
  }

  public clearTrail(): void {
    this.trailCtx.fillStyle = this.config.look.background || "#060609";
    this.trailCtx.fillRect(0, 0, this.width, this.height);
    this.firstFrameCanvas = null;
    this.lastFlashTimeSec = -10;
  }

  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.trailCanvas.width = width;
    this.trailCanvas.height = height;
    this.bloomCanvas.width = Math.max(64, Math.round(width / 4));
    this.bloomCanvas.height = Math.max(64, Math.round(height / 4));
    this.clearTrail();
  }

  /** Pre-rendered radial glow stamp for fast O(1) ball blitting without shadowBlur overhead. */
  private getBallSprite(r: number, g: number, b: number): HTMLCanvasElement {
    const key = `${r},${g},${b}`;
    let sp = this.spriteCache.get(key);
    if (sp) return sp;

    sp = document.createElement("canvas");
    const size = 64;
    sp.width = size;
    sp.height = size;
    const c = sp.getContext("2d")!;
    const cx = size / 2;
    const grad = c.createRadialGradient(cx, cx, 2, cx, cx, cx);
    grad.addColorStop(0, `rgba(255, 255, 255, 1)`);
    grad.addColorStop(0.28, ` rgba(${r}, ${g}, ${b}, 0.95)`);
    grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.35)`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    c.fillStyle = grad;
    c.beginPath();
    c.arc(cx, cx, cx, 0, Math.PI * 2);
    c.fill();
    this.spriteCache.set(key, sp);
    return sp;
  }

  public draw(state: SimSnapshot, tension: number = 0.5, midiNote?: number | null): void {
    const cfg = this.config;
    const scaleX = this.width / ARENA_W;
    const scaleY = this.height / ARENA_H;

    if (midiNote !== undefined && midiNote !== null) {
      this.activeHue = ((midiNote % 12) * 30) % 360;
    }

    // 1. Trail fade or full clear
    const fadeAlpha = cfg.look.trail.enabled ? cfg.look.trail.fade_alpha : 1.0;
    this.trailCtx.save();
    this.trailCtx.globalAlpha = state.frame === 0 ? 1.0 : fadeAlpha;
    this.trailCtx.fillStyle = cfg.look.background || "#060609";
    this.trailCtx.fillRect(0, 0, this.width, this.height);
    this.trailCtx.restore();

    // 2. Scene content onto trail canvas
    if (state.sceneType === "ALGORITHM_ARENA" && state.image) {
      this.renderArenaImage(this.trailCtx, state);
    } else {
      if (state.sceneType === "TOWER_BREAKER") {
        this.renderTowerArena(this.trailCtx, state, scaleX, scaleY);
      } else if (state.sceneType === "MAZE_ESCAPE") {
        this.renderMazeArena(this.trailCtx, state, scaleX, scaleY);
      }
      this.renderBalls(this.trailCtx, state, scaleX, scaleY);
    }

    // 3. Deterministic screen shake
    let shakeX = 0;
    let shakeY = 0;
    const tShake = tension > cfg.feel.shake_tension ? (tension - cfg.feel.shake_tension) / Math.max(0.05, 1 - cfg.feel.shake_tension) : 0;
    const totalShake = Math.min(1.5, tShake + state.shake);
    if (totalShake > 0.01 && cfg.feel.shake_amount > 0) {
      const amp = totalShake * cfg.feel.shake_amount * scaleX;
      shakeX = Math.sin(state.frame * 2.3) * amp;
      shakeY = Math.cos(state.frame * 3.1) * amp;
    }

    this.ctx.save();
    this.ctx.fillStyle = cfg.look.background || "#060609";
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.translate(shakeX, shakeY);
    this.ctx.drawImage(this.trailCanvas, 0, 0);
    this.ctx.restore();

    // 4. Real bloom pass (downscaled blur + additive lighter composite, modulated by tension)
    if (cfg.look.bloom.enabled && cfg.look.bloom.intensity > 0.02) {
      const bw = this.bloomCanvas.width;
      const bh = this.bloomCanvas.height;
      this.bloomCtx.save();
      this.bloomCtx.filter = `blur(${Math.max(1, Math.round(cfg.look.bloom.blur * 0.35))}px)`;
      this.bloomCtx.drawImage(this.trailCanvas, 0, 0, bw, bh);
      this.bloomCtx.restore();

      this.ctx.save();
      this.ctx.globalCompositeOperation = "lighter";
      const bloomAlpha = Math.min(0.85, cfg.look.bloom.intensity * 0.28 * (0.75 + 0.5 * tension));
      this.ctx.globalAlpha = bloomAlpha;
      this.ctx.drawImage(this.bloomCanvas, 0, 0, this.width, this.height);
      this.ctx.restore();
    }

    // 5. Safe Flash guard (limits bright flashes to <= 3/sec and caps intensity)
    if (state.flash > 0.05) {
      let allowFlash = true;
      if (cfg.look.safe_flash) {
        if (state.timeSec - this.lastFlashTimeSec < 0.34 && state.flash > 0.35) {
          allowFlash = false;
        } else if (state.flash > 0.35) {
          this.lastFlashTimeSec = state.timeSec;
        }
      }
      if (allowFlash) {
        const maxAlpha = cfg.look.safe_flash ? 0.22 : 0.55;
        this.ctx.save();
        this.ctx.fillStyle = "#ffffff";
        this.ctx.globalAlpha = Math.min(maxAlpha, state.flash * maxAlpha);
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.restore();
      }
    }

    // 6. HUD overlay
    this.renderHUD(this.ctx, state, tension, scaleX, scaleY);

    // 7. Capture frame 0 for Loop Outro, and cross-dissolve at end
    if (state.frame === 0) {
      this.captureFirstFrame();
    }
    const outroFrames = Math.round(cfg.arc.loop_outro_sec * cfg.meta.fps);
    if (outroFrames > 0 && state.frame >= state.totalFrames - outroFrames && this.firstFrameCanvas) {
      const u = (state.frame - (state.totalFrames - outroFrames)) / Math.max(1, outroFrames);
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, Math.min(1, u * u * (3 - 2 * u)));
      this.ctx.drawImage(this.firstFrameCanvas, 0, 0);
      this.ctx.restore();
    }
  }

  private renderArenaImage(targetCtx: CanvasRenderingContext2D, state: SimSnapshot): void {
    const w = state.imageW;
    const h = state.imageH;
    const img = state.image;
    if (!img || w <= 0 || h <= 0) return;

    if (!this.arenaCanvas || this.arenaCanvas.width !== w || this.arenaCanvas.height !== h) {
      this.arenaCanvas = document.createElement("canvas");
      this.arenaCanvas.width = w;
      this.arenaCanvas.height = h;
      this.arenaCtx = this.arenaCanvas.getContext("2d");
      this.arenaImageData = this.arenaCtx ? this.arenaCtx.createImageData(w, h) : null;
    }
    if (!this.arenaCtx || !this.arenaImageData || !this.arenaCanvas) return;

    const u32 = new Uint32Array(this.arenaImageData.data.buffer);
    u32.set(img);
    this.arenaCtx.putImageData(this.arenaImageData, 0, 0);

    targetCtx.save();
    targetCtx.imageSmoothingEnabled = false;
    targetCtx.drawImage(this.arenaCanvas, 0, 0, this.width, this.height);
    targetCtx.restore();
  }

  private renderBalls(
    targetCtx: CanvasRenderingContext2D,
    state: SimSnapshot,
    scaleX: number,
    scaleY: number
  ): void {
    const pool = state.pool;
    const n = pool.count;
    if (n === 0) return;

    const cfg = this.config;
    const glowScale = Math.max(1.2, 1.5 + cfg.look.glow * 0.55);
    const doSquash = cfg.feel.squash_stretch;
    const pitchHue = cfg.look.pitch_hue;

    // Resolve per-lane base RGB
    const laneSprites: HTMLCanvasElement[] = [];
    if (cfg.scene.type === "TOWER_BREAKER") {
      for (const l of cfg.scene.lanes) {
        const [r, g, b] = hexToRgb(l.color);
        laneSprites.push(this.getBallSprite(r, g, b));
      }
    } else if (cfg.scene.type === "MAZE_ESCAPE") {
      const [r, g, b] = hexToRgb(cfg.scene.color);
      laneSprites.push(this.getBallSprite(r, g, b));
    }
    if (laneSprites.length === 0) {
      laneSprites.push(this.getBallSprite(0, 229, 255));
    }

    const [hr, hg, hb] = hslToRgb(this.activeHue, 0.95, 0.62);
    const hueSprite = this.getBallSprite(hr, hg, hb);

    const px = pool.x, py = pool.y, pvx = pool.vx, pvy = pool.vy, pr = pool.r, pl = pool.lane, ph = pool.heat;

    for (let i = 0; i < n; i++) {
      const x = px[i] * scaleX;
      const y = py[i] * scaleY;
      const rad = Math.max(2, pr[i] * scaleX);
      const drawR = rad * glowScale;
      const heat = ph[i];
      const sp = pitchHue && heat > 0.35 ? hueSprite : laneSprites[pl[i] % laneSprites.length];

      if (doSquash) {
        const vx = pvx[i];
        const vy = pvy[i];
        const speed = Math.hypot(vx, vy);
        const stretch = Math.min(1.42, 1 + speed * 0.00045);
        if (stretch > 1.04) {
          const squash = 1 / Math.sqrt(stretch);
          const angle = Math.atan2(vy, vx);
          targetCtx.save();
          targetCtx.translate(x, y);
          targetCtx.rotate(angle);
          targetCtx.scale(stretch, squash);
          targetCtx.drawImage(sp, -drawR, -drawR, drawR * 2, drawR * 2);
          targetCtx.restore();
          continue;
        }
      }
      targetCtx.drawImage(sp, x - drawR, y - drawR, drawR * 2, drawR * 2);
    }
  }

  private renderTowerArena(
    targetCtx: CanvasRenderingContext2D,
    state: SimSnapshot,
    scaleX: number,
    scaleY: number
  ): void {
    if (this.config.scene.type !== "TOWER_BREAKER") return;
    const scene = this.config.scene;
    const lanes = scene.lanes;
    const laneCount = lanes.length;
    const laneWidth = this.width / laneCount;

    // Vertical lane dividers
    targetCtx.save();
    targetCtx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    targetCtx.lineWidth = Math.max(1, 2 * scaleX);
    for (let i = 1; i < laneCount; i++) {
      const x = i * laneWidth;
      targetCtx.beginPath();
      targetCtx.moveTo(x, 0);
      targetCtx.lineTo(x, this.height);
      targetCtx.stroke();
    }

    // Pegs
    for (const peg of state.pegs) {
      if (peg.r <= 0) continue;
      const x = peg.x * scaleX;
      const y = peg.y * scaleY;
      const r = Math.max(2, peg.r * scaleX);
      const glow = peg.glow;
      const laneCol = lanes[peg.lane]?.color || "#00e5ff";
      targetCtx.beginPath();
      targetCtx.arc(x, y, r * (1 + glow * 0.35), 0, Math.PI * 2);
      targetCtx.fillStyle = glow > 0.15 ? laneCol : "rgba(148, 163, 184, 0.45)";
      targetCtx.fill();
    }

    // Floors
    const floorH = Math.max(4, scene.floor_thickness * scaleY);
    const showLabels = this.config.look.floor_labels;
    targetCtx.font = `700 ${Math.max(9, Math.round(18 * scaleX))}px sans-serif`;
    targetCtx.textAlign = "center";
    targetCtx.textBaseline = "middle";

    for (const fl of state.floors) {
      if (fl.broken) continue;
      const laneCol = lanes[fl.lane]?.color || "#00e5ff";
      const x0 = fl.x0 * scaleX + 10 * scaleX;
      const fullW = (fl.x1 - fl.x0) * scaleX - 20 * scaleX;
      const y = fl.y * scaleY;
      const hpFrac = Math.max(0, Math.min(1, fl.hp / Math.max(1, fl.maxHp)));

      targetCtx.fillStyle = "rgba(15, 23, 42, 0.88)";
      targetCtx.fillRect(x0, y - floorH / 2, fullW, floorH);

      targetCtx.fillStyle = fl.glow > 0.25 ? "#ffffff" : laneCol;
      targetCtx.fillRect(x0, y - floorH / 2, fullW * hpFrac, floorH);

      if (showLabels) {
        targetCtx.fillStyle = "#ffffff";
        targetCtx.fillText(
          `L${fl.index} · ${Math.ceil(fl.hp).toLocaleString()}`,
          x0 + fullW / 2,
          y
        );
      }
    }
    targetCtx.restore();
  }

  private renderMazeArena(
    targetCtx: CanvasRenderingContext2D,
    state: SimSnapshot,
    scaleX: number,
    scaleY: number
  ): void {
    if (this.config.scene.type !== "MAZE_ESCAPE") return;
    const scene = this.config.scene;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const baseCol = scene.ring_color || "#7c5cff";

    targetCtx.save();
    targetCtx.translate(cx, cy);
    targetCtx.lineCap = "round";

    for (let i = 0; i < state.rings.length; i++) {
      const rg = state.rings[i];
      if (rg.broken) continue;
      const r = rg.radius * scaleX;
      const start = rg.angle + rg.gap / 2;
      const end = rg.angle + Math.PI * 2 - rg.gap / 2;
      const col = scene.rings[i]?.color || baseCol;

      targetCtx.beginPath();
      targetCtx.arc(0, 0, r, start, end);
      targetCtx.strokeStyle = col;
      targetCtx.lineWidth = Math.max(2, rg.thickness * scaleX);
      targetCtx.stroke();
    }
    targetCtx.restore();
    void scaleY;
  }

  private renderHUD(
    ctx: CanvasRenderingContext2D,
    state: SimSnapshot,
    tension: number,
    scaleX: number,
    scaleY: number
  ): void {
    const cfg = this.config;
    const hud = cfg.look.hud;
    ctx.save();
    ctx.textAlign = "center";

    // 1. Hook text (always shown during hook_duration_sec; if hook_duration_sec >= duration, stays on)
    const showHook = cfg.arc.hook_duration_sec <= 0 || state.timeSec <= cfg.arc.hook_duration_sec;
    if (showHook && cfg.arc.hook_text.trim().length > 0) {
      const lines = cfg.arc.hook_text.split("\n");
      const fontSize = Math.max(12, Math.round(hud.hook_size * scaleX));
      ctx.font = `900 ${fontSize}px sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = hud.accent;
      ctx.shadowBlur = 12 * scaleX;
      const y0 = hud.hook_y * scaleY;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], this.width / 2, y0 + i * (fontSize * 1.22));
      }
      ctx.shadowBlur = 0;
    }

    // 2. Countdown timer
    if (hud.show_timer) {
      const rem = Math.max(0, cfg.meta.duration_sec - state.timeSec);
      const mins = Math.floor(rem / 60);
      const secs = Math.floor(rem % 60);
      const cs = Math.floor((rem % 1) * 100);
      const str = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
      const tSize = Math.max(14, Math.round(hud.timer_size * scaleX));
      ctx.font = `800 ${tSize}px monospace`;
      ctx.fillStyle = tension > 0.82 ? "#ff2e63" : "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 8 * scaleX;
      ctx.fillText(str, this.width / 2, hud.timer_y * scaleY);
      ctx.shadowBlur = 0;
    }

    // 3. Bottom stats per scene
    if (hud.show_lane_counts && cfg.scene.type === "TOWER_BREAKER") {
      const lanes = cfg.scene.lanes;
      const laneW = this.width / lanes.length;
      for (let l = 0; l < lanes.length; l++) {
        const lane = lanes[l];
        const x = l * laneW + laneW / 2;
        const vCount = Math.round(state.laneVirtual[l] ?? 0);

        ctx.font = `700 ${Math.max(10, Math.round(28 * scaleX))}px sans-serif`;
        ctx.fillStyle = lane.color;
        ctx.fillText(lane.label, x, this.height - 135 * scaleY);

        ctx.font = `900 ${Math.max(11, Math.round(34 * scaleX))}px sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`×${vCount.toLocaleString()}`, x, this.height - 92 * scaleY);
      }
      if (state.winnerLane >= 0 && lanes[state.winnerLane]) {
        const win = lanes[state.winnerLane];
        ctx.font = `900 ${Math.max(16, Math.round(58 * scaleX))}px sans-serif`;
        ctx.fillStyle = win.color;
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = 14 * scaleX;
        ctx.fillText(`PEMENANG: ${win.label}!`, this.width / 2, this.height * 0.34);
        ctx.shadowBlur = 0;
      }
    } else if (hud.show_lane_counts && cfg.scene.type === "MAZE_ESCAPE") {
      ctx.font = `800 ${Math.max(12, Math.round(40 * scaleX))}px sans-serif`;
      ctx.fillStyle = "#00ff9d";
      ctx.fillText(
        `LOLOS: ${Math.round(state.escaped).toLocaleString()} / ${state.escapeGoal.toLocaleString()}`,
        this.width / 2,
        this.height - 105 * scaleY
      );
    } else if (hud.show_lane_counts && cfg.scene.type === "ALGORITHM_ARENA" && state.arenaHud.length > 0) {
      const cols = state.arenaHud.length;
      const colW = this.width / cols;
      for (let i = 0; i < cols; i++) {
        const item = state.arenaHud[i];
        const x = i * colW + colW / 2;
        ctx.font = `700 ${Math.max(10, Math.round(26 * scaleX))}px sans-serif`;
        ctx.fillStyle = hud.accent;
        ctx.fillText(item.label.toUpperCase(), x, this.height - 130 * scaleY);
        ctx.font = `900 ${Math.max(12, Math.round(36 * scaleX))}px monospace`;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(item.value, x, this.height - 88 * scaleY);
      }
    }

    // 4. Platform Safe Zone Guides
    if (hud.show_safe_zones) {
      ctx.strokeStyle = "rgba(255, 60, 100, 0.55)";
      ctx.setLineDash([8 * scaleX, 6 * scaleX]);
      ctx.lineWidth = Math.max(1.5, 2 * scaleX);
      ctx.strokeRect(
        40 * scaleX,
        250 * scaleY,
        this.width - 190 * scaleX,
        this.height - 650 * scaleY
      );
      ctx.setLineDash([]);
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
