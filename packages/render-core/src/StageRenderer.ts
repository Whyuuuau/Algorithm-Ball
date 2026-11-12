import type { ProjectConfig } from "@asmr/schema";
import {
  ARENA_H,
  ARENA_W,
  ORBIT_CENTER_X,
  ORBIT_CENTER_Y,
  PRISM_CENTER_X,
  PRISM_CENTER_Y,
  orbitLayout,
  pendulumLayout,
  type SimSnapshot
} from "@asmr/sim-core";

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
  /** exponentially smoothed HUD numbers (reset whenever playback restarts) */
  private smooth = new Map<string, number>();
  private lastFrameDrawn = -1;
  private ripples: Array<{ x: number; y: number; r: number; maxR: number; hue: number; alpha: number }> = [];

  /** Eases a displayed number towards its target so counters glide instead of jumping. */
  private smoothed(key: string, target: number): number {
    const cur = this.smooth.get(key);
    if (cur === undefined) {
      this.smooth.set(key, target);
      return target;
    }
    const k = 1 - Math.exp(-(1 / Math.max(1, this.config.meta.fps)) / 0.11);
    let next = cur + (target - cur) * k;
    if (Math.abs(target - next) < 0.5) next = target;
    this.smooth.set(key, next);
    return next;
  }

  private static readonly STARS: ReadonlyArray<{ x: number; y: number; r: number; phase: number }> = Array.from(
    { length: 90 },
    (_, i) => ({
      x: ((i * 137.508) % 1080) / 1080,
      y: ((i * 269.897) % 1920) / 1920,
      r: 0.8 + ((i * 37) % 20) / 10,
      phase: (i * 0.43) % (Math.PI * 2)
    })
  );

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
    this.renderBackground(this.trailCtx, 1.0, 0);
    this.firstFrameCanvas = null;
    this.lastFlashTimeSec = -10;
    this.ripples.length = 0;
  }

  private renderBackground(ctx: CanvasRenderingContext2D, alpha: number, timeSec: number): void {
    const cfg = this.config;
    const style = cfg.look.background_style || "solid";
    const bg = cfg.look.background || "#060609";

    ctx.save();
    ctx.globalAlpha = alpha;

    if (style === "radial_vignette") {
      const cx = this.width / 2;
      const cy = this.height * 0.45;
      const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(this.width, this.height) * 0.75);
      const [r, g, b] = hexToRgb(bg);
      grad.addColorStop(0, `rgb(${Math.min(255, r + 45)}, ${Math.min(255, g + 45)}, ${Math.min(255, b + 60)})`);
      grad.addColorStop(1, bg);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (style === "deep_space_stars") {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, this.width, this.height);
      const cx = this.width * 0.5;
      const cy = this.height * 0.35;
      const grad = ctx.createRadialGradient(cx, cy, 50, cx, cy, this.width * 0.7);
      grad.addColorStop(0, "rgba(75, 0, 130, 0.22)");
      grad.addColorStop(0.5, "rgba(0, 80, 160, 0.12)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);

      for (const st of StageRenderer.STARS) {
        const sx = st.x * this.width;
        const sy = st.y * this.height;
        const twinkle = 0.5 + 0.5 * Math.sin(timeSec * 3 + st.phase);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.65 * twinkle})`;
        ctx.beginPath();
        ctx.arc(sx, sy, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (style === "cyber_grid") {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, this.width, this.height);
      const horizonY = this.height * 0.52;
      ctx.save();
      ctx.strokeStyle = "rgba(0, 229, 255, 0.18)";
      ctx.lineWidth = 1;
      const cx = this.width / 2;
      for (let angle = -60; angle <= 60; angle += 10) {
        const rad = (angle * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(cx, horizonY);
        ctx.lineTo(cx + Math.tan(rad) * (this.height - horizonY) * 1.5, this.height);
        ctx.stroke();
      }
      for (let y = horizonY + 20; y < this.height; y += Math.pow((y - horizonY) * 0.18, 1.4) + 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
        ctx.stroke();
      }
      ctx.restore();
    } else if (style === "aurora_gradient") {
      const grad = ctx.createLinearGradient(0, 0, 0, this.height);
      const [r, g, b] = hexToRgb(bg);
      grad.addColorStop(0, `rgb(${Math.min(255, r + 25)}, ${Math.min(255, g + 8)}, ${Math.min(255, b + 40)})`);
      grad.addColorStop(0.5, bg);
      grad.addColorStop(1, `rgb(${Math.max(0, r - 5)}, ${Math.min(255, g + 25)}, ${Math.min(255, b + 35)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.restore();
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

  /** Pre-rendered cached stamp for fast O(1) ball blitting without shadowBlur overhead. */
  private getBallSprite(r: number, g: number, b: number, style: string = "glow"): HTMLCanvasElement {
    const key = `${style},${r},${g},${b}`;
    let sp = this.spriteCache.get(key);
    if (sp) return sp;

    sp = document.createElement("canvas");
    const size = 64;
    sp.width = size;
    sp.height = size;
    const c = sp.getContext("2d")!;
    const cx = size / 2;

    if (style === "neon_cube") {
      c.save();
      c.translate(cx, cx);
      const s = 18;
      c.shadowColor = `rgba(${r}, ${g}, ${b}, 0.9)`;
      c.shadowBlur = 10;
      c.fillStyle = `rgba(${r}, ${g}, ${b}, 0.28)`;
      c.fillRect(-s, -s, s * 2, s * 2);
      c.lineWidth = 4;
      c.strokeStyle = `rgb(${r}, ${g}, ${b})`;
      c.strokeRect(-s, -s, s * 2, s * 2);
      c.shadowBlur = 0;
      c.lineWidth = 1.8;
      c.strokeStyle = "#ffffff";
      c.strokeRect(-s + 2, -s + 2, s * 2 - 4, s * 2 - 4);
      c.restore();
    } else if (style === "solid_cube") {
      c.save();
      c.translate(cx, cx);
      const s = 19;
      const grad = c.createLinearGradient(-s, -s, s, s);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.22, `rgb(${r}, ${g}, ${b})`);
      grad.addColorStop(0.85, `rgb(${Math.round(r * 0.55)}, ${Math.round(g * 0.55)}, ${Math.round(b * 0.55)})`);
      grad.addColorStop(1, "rgba(0, 0, 0, 0.85)");
      c.fillStyle = grad;
      c.fillRect(-s, -s, s * 2, s * 2);
      c.strokeStyle = "rgba(255, 255, 255, 0.65)";
      c.lineWidth = 2;
      c.strokeRect(-s, -s, s * 2, s * 2);
      c.restore();
    } else if (style === "neon_ring") {
      c.beginPath();
      c.arc(cx, cx, 16, 0, Math.PI * 2);
      c.lineWidth = 5;
      c.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
      c.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
      c.shadowBlur = 8;
      c.stroke();
      c.shadowBlur = 0;

      c.beginPath();
      c.arc(cx, cx, 4, 0, Math.PI * 2);
      c.fillStyle = "#ffffff";
      c.fill();
    } else if (style === "shaded_sphere") {
      const grad = c.createRadialGradient(cx - 6, cx - 6, 2, cx, cx, 22);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.3, `rgb(${r}, ${g}, ${b})`);
      grad.addColorStop(0.85, `rgb(${Math.round(r * 0.4)}, ${Math.round(g * 0.4)}, ${Math.round(b * 0.4)})`);
      grad.addColorStop(1, "rgba(0, 0, 0, 0.9)");
      c.fillStyle = grad;
      c.beginPath();
      c.arc(cx, cx, 22, 0, Math.PI * 2);
      c.fill();
    } else if (style === "sparkle_particle") {
      c.save();
      c.translate(cx, cx);
      c.fillStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
      c.beginPath();
      c.moveTo(0, -22);
      c.quadraticCurveTo(0, 0, 22, 0);
      c.quadraticCurveTo(0, 0, 0, 22);
      c.quadraticCurveTo(0, 0, -22, 0);
      c.quadraticCurveTo(0, 0, 0, -22);
      c.fill();
      c.beginPath();
      c.arc(0, 0, 5, 0, Math.PI * 2);
      c.fillStyle = "#ffffff";
      c.fill();
      c.restore();
    } else {
      const grad = c.createRadialGradient(cx, cx, 2, cx, cx, cx);
      grad.addColorStop(0, `rgba(255, 255, 255, 1)`);
      grad.addColorStop(0.28, ` rgba(${r}, ${g}, ${b}, 0.95)`);
      grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.35)`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      c.fillStyle = grad;
      c.beginPath();
      c.arc(cx, cx, cx, 0, Math.PI * 2);
      c.fill();
    }

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

    if (state.frame === 0 || state.frame < this.lastFrameDrawn) {
      this.smooth.clear();
      this.ripples.length = 0;
    }
    this.lastFrameDrawn = state.frame;

    // Emit expanding visual impact ripples when balls/objects strike freshly (heat spike)
    if (state.pool.count > 0 && state.sceneType !== "ALGORITHM_ARENA") {
      let spawned = 0;
      const ph = state.pool.heat;
      const px = state.pool.x;
      const py = state.pool.y;
      const phue = state.pool.hue;
      for (let i = 0; i < state.pool.count && spawned < 3; i++) {
        if (ph[i] > 0.94 && this.ripples.length < 36) {
          this.ripples.push({
            x: px[i] * scaleX,
            y: py[i] * scaleY,
            r: Math.max(4, state.pool.r[i] * scaleX),
            maxR: (state.sceneType === "OPTICAL_MIRRORS" || state.sceneType === "PENDULUM_WAVE" ? 62 : 44) * scaleX,
            hue: phue[i] || this.activeHue,
            alpha: 0.55
          });
          spawned++;
        }
      }
    }

    // 1. Trail fade or full clear
    const fadeAlpha = cfg.look.trail.enabled ? cfg.look.trail.fade_alpha : 1.0;
    this.renderBackground(this.trailCtx, state.frame === 0 ? 1.0 : fadeAlpha, state.timeSec);

    // 2. Scene content onto trail canvas
    if (state.sceneType === "ALGORITHM_ARENA" && state.image) {
      this.renderArenaImage(this.trailCtx, state);
    } else {
      if (state.sceneType === "TOWER_BREAKER") {
        this.renderTowerArena(this.trailCtx, state, scaleX, scaleY);
      } else if (state.sceneType === "MAZE_ESCAPE") {
        this.renderMazeArena(this.trailCtx, state, scaleX, scaleY);
      } else if (state.sceneType === "CUBE_ARENA") {
        this.renderCubeArena(this.trailCtx, state, scaleX, scaleY);
      } else if (state.sceneType === "OVERFLOW_BOWL") {
        this.renderOverflowBowl(this.trailCtx, state, scaleX, scaleY);
      } else if (state.sceneType === "OPTICAL_MIRRORS") {
        this.renderOpticalMirrors(this.trailCtx, state, scaleX, scaleY);
      } else if (state.sceneType === "PENDULUM_WAVE") {
        this.renderPendulumWave(this.trailCtx, state, scaleX, scaleY);
      } else if (state.sceneType === "POLY_ORBIT") {
        this.renderPolyOrbit(this.trailCtx, state, scaleX, scaleY);
      } else if (state.sceneType === "PRISM_CHAMBER") {
        this.renderPrismChamber(this.trailCtx, state, scaleX, scaleY);
      }
      this.renderBalls(this.trailCtx, state, scaleX, scaleY);
    }

    // Update & render expanding impact shockwave ripples onto main ctx after trail blit
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.r += (rp.maxR - rp.r) * 0.14;
      rp.alpha *= 0.87;
      if (rp.alpha < 0.025) {
        this.ripples.splice(i, 1);
      }
    }

    // 3. Outro calm period & Deterministic screen shake
    const calmOutroSec = cfg.arc.calm_outro_sec ?? 3.0;
    const remainingSec = Math.max(0, (state.totalFrames - state.frame) / cfg.meta.fps);
    let outroCalmFactor = 1.0;
    if (calmOutroSec > 0) {
      if (remainingSec <= calmOutroSec) {
        outroCalmFactor = 0.0;
      } else if (remainingSec < calmOutroSec + 0.6) {
        const u = (remainingSec - calmOutroSec) / 0.6;
        outroCalmFactor = u * u * (3 - 2 * u);
      }
    }

    let shakeX = 0;
    let shakeY = 0;
    const tShake = tension > cfg.feel.shake_tension ? (tension - cfg.feel.shake_tension) / Math.max(0.05, 1 - cfg.feel.shake_tension) : 0;
    const totalShake = Math.min(1.5, tShake + state.shake) * outroCalmFactor;
    if (totalShake > 0.01 && cfg.feel.shake_amount > 0) {
      const amp = totalShake * cfg.feel.shake_amount * scaleX;
      shakeX = Math.sin(state.frame * 2.3) * amp;
      shakeY = Math.cos(state.frame * 3.1) * amp;
    }

    this.ctx.save();
    this.renderBackground(this.ctx, 1.0, state.timeSec);
    this.ctx.translate(shakeX, shakeY);
    this.ctx.drawImage(this.trailCanvas, 0, 0);
    for (const rp of this.ripples) {
      const [rr, rg, rb] = hslToRgb(rp.hue, 0.9, 0.65);
      this.ctx.strokeStyle = `rgba(${rr}, ${rg}, ${rb}, ${rp.alpha.toFixed(3)})`;
      this.ctx.lineWidth = Math.max(1.2, 2.2 * scaleX);
      this.ctx.beginPath();
      this.ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      this.ctx.stroke();
    }
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

    // 5. Safe Flash guard (limits bright flashes to <= 3/sec, caps intensity, suppressed in calm outro)
    if (state.flash > 0.05 && outroCalmFactor > 0.01) {
      let allowFlash = true;
      if (cfg.look.safe_flash) {
        if (state.timeSec - this.lastFlashTimeSec < 0.34 && state.flash > 0.35) {
          allowFlash = false;
        } else if (state.flash > 0.35) {
          this.lastFlashTimeSec = state.timeSec;
        }
      }
      if (allowFlash) {
        const maxAlpha = (cfg.look.safe_flash ? 0.22 : 0.55) * outroCalmFactor;
        this.ctx.save();
        this.ctx.fillStyle = "#ffffff";
        this.ctx.globalAlpha = Math.min(maxAlpha, state.flash * maxAlpha);
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.restore();
      }
    }

    // 5.5 Post-processing passes: Chromatic Aberration, Scanlines, Vignette
    const ca = cfg.look.chromatic_aberration ?? 0;
    if ((ca > 0.1 || (tension > 0.88 && ca > 0)) && outroCalmFactor > 0.01) {
      const shift = Math.max(1, ca * scaleX * (0.6 + 0.6 * tension * outroCalmFactor));
      this.ctx.save();
      this.ctx.globalCompositeOperation = "screen";
      this.ctx.globalAlpha = 0.28 * outroCalmFactor;
      this.ctx.drawImage(this.trailCanvas, shift, 0);
      this.ctx.drawImage(this.trailCanvas, -shift, 0);
      this.ctx.restore();
    }

    const sl = cfg.look.scanlines ?? 0;
    if (sl > 0.05) {
      this.ctx.save();
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      this.ctx.globalAlpha = sl * 0.4;
      const step = Math.max(3, Math.round(4 * scaleY));
      for (let y = 0; y < this.height; y += step) {
        this.ctx.fillRect(0, y, this.width, Math.max(1, 1.2 * scaleY));
      }
      this.ctx.restore();
    }

    const vig = cfg.look.vignette ?? 0.35;
    if (vig > 0.05) {
      this.ctx.save();
      const cx = this.width / 2;
      const cy = this.height / 2;
      const maxR = Math.hypot(cx, cy);
      const grad = this.ctx.createRadialGradient(cx, cy, maxR * 0.45, cx, cy, maxR);
      grad.addColorStop(0, "rgba(0, 0, 0, 0)");
      grad.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.92, vig * 0.85)})`);
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.restore();
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
    const ballStyle = cfg.look.ball_style || "glow";
    const isCube = ballStyle === "neon_cube" || ballStyle === "solid_cube";
    const colorMode = cfg.look.color_mode || "lane";
    const useRainbow =
      colorMode === "rainbow" ||
      state.sceneType === "OPTICAL_MIRRORS" ||
      (colorMode === "lane" &&
        (state.sceneType === "CUBE_ARENA" ||
          state.sceneType === "OVERFLOW_BOWL" ||
          state.sceneType === "PENDULUM_WAVE" ||
          state.sceneType === "POLY_ORBIT" ||
          state.sceneType === "PRISM_CHAMBER"));

    // Resolve per-lane base RGB
    const laneSprites: HTMLCanvasElement[] = [];
    if (useRainbow) {
      for (let b = 0; b < 36; b++) {
        const [r, g, bCol] = hslToRgb(b * 10, 0.92, 0.58);
        laneSprites.push(this.getBallSprite(r, g, bCol, ballStyle));
      }
    } else if (cfg.scene.type === "TOWER_BREAKER") {
      for (const l of cfg.scene.lanes) {
        const [r, g, b] = hexToRgb(l.color);
        laneSprites.push(this.getBallSprite(r, g, b, ballStyle));
      }
    } else if (cfg.scene.type === "MAZE_ESCAPE") {
      const [r, g, b] = hexToRgb(cfg.scene.color);
      laneSprites.push(this.getBallSprite(r, g, b, ballStyle));
    }
    if (laneSprites.length === 0) {
      laneSprites.push(this.getBallSprite(0, 229, 255, ballStyle));
    }

    const [hr, hg, hb] = hslToRgb(this.activeHue, 0.95, 0.62);
    const hueSprite = this.getBallSprite(hr, hg, hb, ballStyle);

    const px = pool.x, py = pool.y, pvx = pool.vx, pvy = pool.vy, pr = pool.r, pl = pool.lane, ph = pool.heat, prot = pool.rot, phue = pool.hue;

    for (let i = 0; i < n; i++) {
      const x = px[i] * scaleX;
      const y = py[i] * scaleY;
      const rad = Math.max(2, pr[i] * scaleX);
      const drawR = rad * (isCube ? Math.max(1.25, glowScale * 0.85) : glowScale);
      const heat = ph[i];

      let sp: HTMLCanvasElement;
      if (useRainbow) {
        const bucket = Math.floor((((phue[i] % 360) + 360) % 360) / 10) % 36;
        sp = laneSprites[bucket];
      } else if (colorMode === "velocity") {
        const spd = Math.hypot(pvx[i], pvy[i]);
        const vHue = Math.max(0, Math.min(300, 200 - spd * 0.25));
        const [vr, vg, vb] = hslToRgb(vHue, 0.95, 0.58);
        sp = this.getBallSprite(vr, vg, vb, ballStyle);
      } else {
        sp = pitchHue && heat > 0.35 ? hueSprite : laneSprites[pl[i] % laneSprites.length];
      }

      if (isCube) {
        targetCtx.save();
        targetCtx.translate(x, y);
        targetCtx.rotate(prot[i]);
        targetCtx.drawImage(sp, -drawR, -drawR, drawR * 2, drawR * 2);
        targetCtx.restore();
        continue;
      }

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
    const isDuelCards = this.config.look.tower_hud_style === "duel_cards";

    targetCtx.save();

    if (isDuelCards) {
      // Framed neon cards per lane (Broadcast Duel HUD)
      const boxTop = this.height * 0.30;
      const boxBot = this.height * 0.915;
      const pad = 16 * scaleX;
      for (let i = 0; i < laneCount; i++) {
        const col = lanes[i].color || "#00e5ff";
        const [r, g, b] = hexToRgb(col);
        const bx = i * laneWidth + pad;
        const bw = laneWidth - pad * 2;
        const bh = boxBot - boxTop;

        targetCtx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.05)`;
        targetCtx.fillRect(bx, boxTop, bw, bh);

        targetCtx.save();
        targetCtx.shadowColor = col;
        targetCtx.shadowBlur = 12 * scaleX;
        targetCtx.strokeStyle = col;
        targetCtx.lineWidth = Math.max(2, 3.5 * scaleX);
        targetCtx.strokeRect(bx, boxTop, bw, bh);
        targetCtx.restore();
      }
    } else {
      // Vertical lane dividers
      targetCtx.strokeStyle = "rgba(255, 255, 255, 0.14)";
      targetCtx.lineWidth = Math.max(1, 2 * scaleX);
      for (let i = 1; i < laneCount; i++) {
        const x = i * laneWidth;
        targetCtx.beginPath();
        targetCtx.moveTo(x, 0);
        targetCtx.lineTo(x, this.height);
        targetCtx.stroke();
      }
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

    // Find top-most unbroken floor index per lane for active white highlight in duel_cards mode
    const activeFloorPerLane = new Int32Array(laneCount).fill(999);
    for (const fl of state.floors) {
      if (!fl.broken && fl.index < activeFloorPerLane[fl.lane]) {
        activeFloorPerLane[fl.lane] = fl.index;
      }
    }

    // Floors
    const floorH = Math.max(4, scene.floor_thickness * scaleY);
    const showLabels = this.config.look.floor_labels;
    targetCtx.textAlign = "center";
    targetCtx.textBaseline = "middle";

    for (const fl of state.floors) {
      if (fl.broken) continue;
      const laneCol = lanes[fl.lane]?.color || "#00e5ff";
      const inset = isDuelCards ? 20 * scaleX : 10 * scaleX;
      const x0 = fl.x0 * scaleX + inset;
      const fullW = (fl.x1 - fl.x0) * scaleX - inset * 2;
      const y = fl.y * scaleY;
      const hpFrac = Math.max(0, Math.min(1, fl.hp / Math.max(1, fl.maxHp)));
      const isActiveTop = fl.index === activeFloorPerLane[fl.lane];

      if (isDuelCards) {
        if (isActiveTop) {
          // Bright crisp white active barrier with split HP readout
          targetCtx.fillStyle = "rgba(255, 255, 255, 0.25)";
          targetCtx.fillRect(x0, y - floorH * 0.35, fullW, floorH * 0.7);
          targetCtx.fillStyle = "#ffffff";
          targetCtx.fillRect(x0, y - floorH * 0.35, fullW * hpFrac, floorH * 0.7);
          if (showLabels) {
            const label = Math.ceil(fl.hp).toLocaleString();
            targetCtx.font = `900 ${Math.max(11, Math.round(28 * scaleX))}px sans-serif`;
            const tw = targetCtx.measureText(label).width + 20 * scaleX;
            targetCtx.fillStyle = "rgba(8, 12, 22, 0.92)";
            targetCtx.fillRect(x0 + fullW / 2 - tw / 2, y - 16 * scaleY, tw, 32 * scaleY);
            targetCtx.fillStyle = "#ffffff";
            targetCtx.fillText(label, x0 + fullW / 2, y);
          }
        } else {
          // Clean thin colored line + centered numeric HP
          targetCtx.fillStyle = laneCol;
          targetCtx.globalAlpha = 0.65;
          targetCtx.fillRect(x0, y - 1.5 * scaleY, fullW, 3 * scaleY);
          targetCtx.globalAlpha = 1;
          if (showLabels) {
            const label = Math.ceil(fl.hp).toLocaleString();
            targetCtx.font = `700 ${Math.max(10, Math.round(22 * scaleX))}px sans-serif`;
            const tw = targetCtx.measureText(label).width + 16 * scaleX;
            targetCtx.fillStyle = "rgba(6, 10, 18, 0.9)";
            targetCtx.fillRect(x0 + fullW / 2 - tw / 2, y - 13 * scaleY, tw, 26 * scaleY);
            targetCtx.fillStyle = laneCol;
            targetCtx.fillText(label, x0 + fullW / 2, y);
          }
        }
        continue;
      }

      targetCtx.font = `700 ${Math.max(9, Math.round(18 * scaleX))}px sans-serif`;
      targetCtx.fillStyle = "rgba(15, 23, 42, 0.88)";
      targetCtx.fillRect(x0, y - floorH / 2, fullW, floorH);

      const floorStyle = this.config.look.floor_style || "solid";
      if (floorStyle === "neon_laser") {
        targetCtx.save();
        targetCtx.shadowColor = laneCol;
        targetCtx.shadowBlur = 10 * scaleX;
        targetCtx.fillStyle = fl.glow > 0.25 ? "#ffffff" : laneCol;
        targetCtx.fillRect(x0, y - floorH / 2, fullW * hpFrac, floorH);
        targetCtx.fillStyle = "#ffffff";
        targetCtx.fillRect(x0, y - (floorH * 0.3) / 2, fullW * hpFrac, floorH * 0.3);
        targetCtx.restore();
      } else if (floorStyle === "glass_brick") {
        targetCtx.fillStyle = fl.glow > 0.25 ? "#ffffff" : laneCol;
        targetCtx.fillRect(x0, y - floorH / 2, fullW * hpFrac, floorH);
        targetCtx.fillStyle = "rgba(0, 0, 0, 0.4)";
        const segmentW = 24 * scaleX;
        for (let bx = x0 + segmentW; bx < x0 + fullW * hpFrac; bx += segmentW) {
          targetCtx.fillRect(bx - 1, y - floorH / 2, 2, floorH);
        }
      } else if (floorStyle === "striped_warning") {
        targetCtx.fillStyle = fl.glow > 0.25 ? "#ffffff" : laneCol;
        targetCtx.fillRect(x0, y - floorH / 2, fullW * hpFrac, floorH);
        targetCtx.save();
        targetCtx.beginPath();
        targetCtx.rect(x0, y - floorH / 2, fullW * hpFrac, floorH);
        targetCtx.clip();
        targetCtx.strokeStyle = "rgba(0, 0, 0, 0.35)";
        targetCtx.lineWidth = 4 * scaleX;
        for (let sx = x0 - floorH; sx < x0 + fullW + floorH; sx += 14 * scaleX) {
          targetCtx.beginPath();
          targetCtx.moveTo(sx, y + floorH / 2);
          targetCtx.lineTo(sx + floorH, y - floorH / 2);
          targetCtx.stroke();
        }
        targetCtx.restore();
      } else {
        targetCtx.fillStyle = fl.glow > 0.25 ? "#ffffff" : laneCol;
        targetCtx.fillRect(x0, y - floorH / 2, fullW * hpFrac, floorH);
      }

      if (showLabels) {
        const label = `L${fl.index} · ${Math.ceil(fl.hp).toLocaleString()}`;
        const fSz = Math.max(8, Math.round(16 * scaleX));
        targetCtx.font = `800 ${fSz}px sans-serif`;
        const lw = targetCtx.measureText(label).width + 14 * scaleX;
        const lh = Math.max(floorH + 4 * scaleY, 20 * scaleY);
        targetCtx.fillStyle = "rgba(5, 8, 18, 0.88)";
        targetCtx.beginPath();
        targetCtx.roundRect(x0 + fullW / 2 - lw / 2, y - lh / 2, lw, lh, 6 * scaleX);
        targetCtx.fill();
        targetCtx.fillStyle = "#ffffff";
        targetCtx.fillText(label, x0 + fullW / 2, y);
      }
    }
    targetCtx.restore();
  }

  private renderCubeArena(
    targetCtx: CanvasRenderingContext2D,
    state: SimSnapshot,
    scaleX: number,
    scaleY: number
  ): void {
    if (this.config.scene.type !== "CUBE_ARENA") return;
    const cfg = this.config.scene;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const outerR = cfg.outer_radius * scaleX;

    targetCtx.save();
    targetCtx.translate(cx, cy);

    // 1. Outer Chamber Boundary (Circle, Hexagon, or Diamond)
    targetCtx.beginPath();
    if (cfg.chamber_shape === "hexagon" || cfg.chamber_shape === "diamond") {
      const sides = cfg.chamber_shape === "hexagon" ? 6 : 4;
      const rotOffset = cfg.chamber_shape === "hexagon" ? Math.PI / 6 : 0;
      for (let k = 0; k < sides; k++) {
        const va = rotOffset + (k * Math.PI * 2) / sides;
        const vx = Math.cos(va) * outerR;
        const vy = Math.sin(va) * outerR;
        if (k === 0) targetCtx.moveTo(vx, vy);
        else targetCtx.lineTo(vx, vy);
      }
      targetCtx.closePath();
    } else {
      targetCtx.arc(0, 0, outerR, 0, Math.PI * 2);
    }
    targetCtx.strokeStyle = cfg.wall_color || "#ffffff";
    targetCtx.lineWidth = Math.max(2, 6 * scaleX);
    targetCtx.shadowColor = cfg.wall_color || "#ffffff";
    targetCtx.shadowBlur = 12 * scaleX;
    targetCtx.stroke();
    targetCtx.shadowBlur = 0;

    // 2. Rotating Cross Blades
    if (cfg.cross_blades > 0) {
      const halfCage = cfg.cage_enabled ? cfg.cage_size * 0.5 * scaleX : 0;
      const bladeW = Math.max(4, 12 * scaleX);
      targetCtx.strokeStyle = "#e2e8f0";
      targetCtx.lineWidth = bladeW;
      targetCtx.lineCap = "round";
      for (let b = 0; b < cfg.cross_blades; b++) {
        const a = state.crossAngle + (b / cfg.cross_blades) * Math.PI * 2;
        const r0 = cfg.cage_enabled ? halfCage * 1.1 : 6 * scaleX;
        targetCtx.beginPath();
        targetCtx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        targetCtx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
        targetCtx.stroke();
      }
    }

    // 3. Rotating Central Interlocking Hatch Cage Bars (like Cube Arena hashtag/diamond prison)
    if (cfg.cage_enabled) {
      targetCtx.save();
      targetCtx.rotate(state.cageAngle);
      const half = cfg.cage_size * 0.5 * scaleX;
      const overhang = half * 1.65;
      const barThick = Math.max(6, 16 * scaleX);
      const col = cfg.cage_color || "#cbd5e1";

      targetCtx.lineCap = "round";
      // Draw 4 overlapping bevelled metallic cage bars around the square perimeter with corner gaps
      const gap = half * 0.38;
      const segs: [number, number, number, number][] = [
        [-overhang, -half, half - gap, -half],
        [-half + gap, half, overhang, half],
        [-half, -overhang, -half, half - gap],
        [half, -half + gap, half, overhang]
      ];
      for (const [x1, y1, x2, y2] of segs) {
        targetCtx.strokeStyle = "#0f172a";
        targetCtx.lineWidth = barThick + 4 * scaleX;
        targetCtx.beginPath();
        targetCtx.moveTo(x1, y1);
        targetCtx.lineTo(x2, y2);
        targetCtx.stroke();

        targetCtx.strokeStyle = col;
        targetCtx.lineWidth = barThick;
        targetCtx.beginPath();
        targetCtx.moveTo(x1, y1);
        targetCtx.lineTo(x2, y2);
        targetCtx.stroke();
      }
      targetCtx.restore();
    }

    targetCtx.restore();
    void scaleY;
  }

  private renderOverflowBowl(
    targetCtx: CanvasRenderingContext2D,
    state: SimSnapshot,
    scaleX: number,
    scaleY: number
  ): void {
    if (this.config.scene.type !== "OVERFLOW_BOWL") return;
    const cfg = this.config.scene;
    const cx = this.width / 2;
    const cy = this.height * 0.49;
    const bowlR = cfg.bowl_radius * scaleX;
    const rimRad = (cfg.rim_angle_deg * Math.PI) / 180;
    const halfWedge = ((cfg.wedge_angle_deg * 0.5) * Math.PI) / 180;

    targetCtx.save();
    targetCtx.translate(cx, cy);

    // 1. Curved U-Bowl Arc (bottom center is +PI/2 in canvas coordinates)
    const startA = Math.PI * 0.5 - rimRad;
    const endA = Math.PI * 0.5 + rimRad;
    targetCtx.beginPath();
    targetCtx.arc(0, 0, bowlR, startA, endA);
    targetCtx.strokeStyle = cfg.bowl_color || "#94a3b8";
    targetCtx.lineWidth = Math.max(8, 22 * scaleX);
    targetCtx.lineCap = "round";
    targetCtx.stroke();

    // Inner bright highlight rim
    targetCtx.beginPath();
    targetCtx.arc(0, 0, bowlR - 3 * scaleX, startA, endA);
    targetCtx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    targetCtx.lineWidth = Math.max(2, 4 * scaleX);
    targetCtx.stroke();

    // 2. Oscillating Central Pendulum Wedge Blade
    // Note: in OverflowBowlScene, theta=0 is straight down (+Y), canvas angle is PI/2 - theta
    const canvasCenter = Math.PI * 0.5 - state.wedgeAngle;
    const wStart = canvasCenter - halfWedge;
    const wEnd = canvasCenter + halfWedge;
    const rOuter = bowlR - 14 * scaleX;

    targetCtx.beginPath();
    targetCtx.moveTo(0, 0);
    targetCtx.arc(0, 0, rOuter, wStart, wEnd);
    targetCtx.closePath();

    const grad = targetCtx.createLinearGradient(-rOuter * 0.3, 0, rOuter * 0.3, rOuter);
    grad.addColorStop(0, cfg.wedge_color || "#cbd5e1");
    grad.addColorStop(1, "#64748b");
    targetCtx.fillStyle = grad;
    targetCtx.fill();
    targetCtx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    targetCtx.lineWidth = Math.max(2, 3 * scaleX);
    targetCtx.stroke();

    // Central pivot hinge ring + live capacity fill progress ring
    const fillFrac = Math.min(1, state.pool.count / Math.max(40, this.config.physics.physical_cap * 0.45));
    targetCtx.beginPath();
    targetCtx.arc(0, 0, 34 * scaleX, -Math.PI / 2, -Math.PI / 2 + fillFrac * Math.PI * 2);
    targetCtx.strokeStyle = fillFrac > 0.85 ? "#fb7185" : "#22d3ee";
    targetCtx.lineWidth = Math.max(2, 4.5 * scaleX);
    targetCtx.stroke();

    targetCtx.beginPath();
    targetCtx.arc(0, 0, 26 * scaleX, 0, Math.PI * 2);
    targetCtx.fillStyle = "#475569";
    targetCtx.fill();
    targetCtx.lineWidth = 4 * scaleX;
    targetCtx.strokeStyle = "#e2e8f0";
    targetCtx.stroke();

    if (cfg.bowl_shape === "goblet_funnel") {
      // Stylized goblet rim chalice stem below bowl
      targetCtx.beginPath();
      targetCtx.moveTo(0, bowlR + 12 * scaleX);
      targetCtx.lineTo(0, bowlR + 95 * scaleX);
      targetCtx.moveTo(-110 * scaleX, bowlR + 95 * scaleX);
      targetCtx.lineTo(110 * scaleX, bowlR + 95 * scaleX);
      targetCtx.strokeStyle = "rgba(148, 163, 184, 0.55)";
      targetCtx.lineWidth = Math.max(4, 10 * scaleX);
      targetCtx.lineCap = "round";
      targetCtx.stroke();
    }

    targetCtx.beginPath();
    targetCtx.arc(0, 0, 10 * scaleX, 0, Math.PI * 2);
    targetCtx.fillStyle = "#ffffff";
    targetCtx.fill();

    targetCtx.restore();
    void scaleY;
  }

  private renderOpticalMirrors(
    targetCtx: CanvasRenderingContext2D,
    state: SimSnapshot,
    scaleX: number,
    scaleY: number
  ): void {
    if (this.config.scene.type !== "OPTICAL_MIRRORS") return;
    const cfg = this.config.scene;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const w = cfg.width_px * 0.5 * scaleX;
    const h = cfg.height_px * 0.5 * scaleY;
    const mCol = cfg.mirror_color || "#00e5ff";

    targetCtx.save();

    // 1. Subtle Geometric Reference Grid & Axes
    if (cfg.show_grid) {
      targetCtx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      targetCtx.lineWidth = Math.max(1, 1.2 * scaleX);
      // Cross axes
      targetCtx.beginPath();
      targetCtx.moveTo(cx, cy - h);
      targetCtx.lineTo(cx, cy + h);
      targetCtx.moveTo(cx - w, cy);
      targetCtx.lineTo(cx + w, cy);
      targetCtx.stroke();

      // Diagonal diamond reference box
      targetCtx.beginPath();
      targetCtx.moveTo(cx - w * 0.72, cy - h * 0.5);
      targetCtx.lineTo(cx + w * 0.72, cy - h * 0.5);
      targetCtx.moveTo(cx - w * 0.72, cy + h * 0.5);
      targetCtx.lineTo(cx + w * 0.72, cy + h * 0.5);
      targetCtx.moveTo(cx - w * 0.72, cy - h * 0.5);
      targetCtx.lineTo(cx + w * 0.72, cy + h * 0.5);
      targetCtx.moveTo(cx + w * 0.72, cy - h * 0.5);
      targetCtx.lineTo(cx - w * 0.72, cy + h * 0.5);
      targetCtx.stroke();
    }

    // 2. Radial Rays from Focal Origin to Every Ball
    const origY = cy + cfg.origin_offset_y * scaleY;
    if (cfg.show_rays) {
      const pool = state.pool;
      targetCtx.lineWidth = Math.max(1, 1.8 * scaleX);
      for (let i = 0; i < pool.count; i++) {
        const bx = pool.x[i] * scaleX;
        const by = pool.y[i] * scaleY;
        const [r, g, b] = hslToRgb(pool.hue[i], 0.9, 0.6);
        targetCtx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.35)`;
        targetCtx.beginPath();
        targetCtx.moveTo(cx, origY);
        targetCtx.lineTo(bx, by);
        targetCtx.stroke();
      }
      // Subtle center focus ring
      targetCtx.beginPath();
      targetCtx.arc(cx, origY, 14 * scaleX, 0, Math.PI * 2);
      targetCtx.strokeStyle = "rgba(255, 210, 80, 0.75)";
      targetCtx.lineWidth = 2.5 * scaleX;
      targetCtx.stroke();
    }

    // 3. Mirror Boundary Outline (rotates smoothly with mirror_spin)
    targetCtx.save();
    targetCtx.translate(cx, cy);
    if (cfg.mirror_spin !== 0) {
      targetCtx.rotate(cfg.mirror_spin * state.timeSec);
    }
    targetCtx.strokeStyle = mCol;
    targetCtx.lineWidth = Math.max(3, 6 * scaleX);
    targetCtx.shadowColor = mCol;
    targetCtx.shadowBlur = 14 * scaleX;

    targetCtx.beginPath();
    if (cfg.mirror_shape === "circle") {
      targetCtx.arc(0, 0, w, 0, Math.PI * 2);
    } else if (cfg.mirror_shape === "ellipse") {
      targetCtx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    } else {
      // Vesica Piscis: two intersecting circular arcs
      const arcR = (w * w + h * h) / Math.max(1, 2 * w);
      const offsetX = arcR - w;
      const halfAngle = Math.atan2(h, offsetX);
      targetCtx.arc(-offsetX, 0, arcR, -halfAngle, halfAngle);
      targetCtx.arc(offsetX, 0, arcR, Math.PI - halfAngle, Math.PI + halfAngle);
      targetCtx.closePath();
    }
    targetCtx.stroke();
    targetCtx.restore();
    targetCtx.restore();
  }

  private renderPendulumWave(
    targetCtx: CanvasRenderingContext2D,
    state: SimSnapshot,
    scaleX: number,
    scaleY: number
  ): void {
    if (this.config.scene.type !== "PENDULUM_WAVE") return;
    const cfg = this.config.scene;
    const layout = pendulumLayout(cfg);
    const pool = state.pool;
    const n = Math.min(cfg.count, pool.count);
    const pivotY = cfg.pivot_y * scaleY;
    const [sr, sg, sb] = hexToRgb(cfg.string_color);

    targetCtx.save();
    targetCtx.lineCap = "round";
    targetCtx.lineJoin = "round";

    // support beam
    const xMin = Math.min(...layout.pivotX) * scaleX - 34 * scaleX;
    const xMax = Math.max(...layout.pivotX) * scaleX + 34 * scaleX;
    targetCtx.strokeStyle = "rgba(226, 232, 240, 0.55)";
    targetCtx.lineWidth = Math.max(3, 7 * scaleX);
    targetCtx.beginPath();
    targetCtx.moveTo(xMin, pivotY);
    targetCtx.lineTo(xMax, pivotY);
    targetCtx.stroke();

    // the "string harp" curve joining every rest position
    if (cfg.show_rest_marks && n > 1) {
      targetCtx.strokeStyle = `rgba(${sr}, ${sg}, ${sb}, 0.14)`;
      targetCtx.lineWidth = Math.max(1, 1.6 * scaleX);
      targetCtx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = layout.pivotX[i] * scaleX;
        const y = (cfg.pivot_y + layout.len[i]) * scaleY;
        if (i === 0) targetCtx.moveTo(x, y);
        else targetCtx.lineTo(x, y);
      }
      targetCtx.stroke();
    }

    for (let i = 0; i < n; i++) {
      const px = layout.pivotX[i] * scaleX;
      const heat = pool.heat[i];
      const [hr, hg, hb] = hslToRgb(pool.hue[i], 0.92, 0.62);

      if (cfg.show_strings) {
        targetCtx.strokeStyle = `rgba(${sr}, ${sg}, ${sb}, ${0.22 + 0.4 * heat})`;
        targetCtx.lineWidth = Math.max(1, (1.5 + heat * 1.5) * scaleX);
        targetCtx.beginPath();
        targetCtx.moveTo(px, pivotY);
        targetCtx.lineTo(pool.x[i] * scaleX, pool.y[i] * scaleY);
        targetCtx.stroke();
      }

      // pivot bead
      targetCtx.fillStyle = "rgba(241, 245, 249, 0.85)";
      targetCtx.beginPath();
      targetCtx.arc(px, pivotY, Math.max(2, 3.4 * scaleX), 0, Math.PI * 2);
      targetCtx.fill();

      // rest mark: lights up as the bob sweeps through it
      if (cfg.show_rest_marks) {
        const ry = (cfg.pivot_y + layout.len[i]) * scaleY;
        targetCtx.strokeStyle = `rgba(${hr}, ${hg}, ${hb}, ${0.2 + 0.75 * heat})`;
        targetCtx.lineWidth = Math.max(1.5, (2 + heat * 3) * scaleX);
        targetCtx.beginPath();
        targetCtx.arc(px, ry, Math.max(3, cfg.bob_radius * (1.35 + heat * 0.9) * scaleX), 0, Math.PI * 2);
        targetCtx.stroke();
      }
    }

    // Smooth harmonic liquid silk ribbon connecting all pendulum bobs
    if (cfg.wave_ribbon && n > 1) {
      targetCtx.strokeStyle = `rgba(${sr}, ${sg}, ${sb}, 0.52)`;
      targetCtx.lineWidth = Math.max(2, 4 * scaleX);
      targetCtx.shadowColor = cfg.string_color;
      targetCtx.shadowBlur = 12 * scaleX;
      targetCtx.beginPath();
      targetCtx.moveTo(pool.x[0] * scaleX, pool.y[0] * scaleY);
      for (let i = 1; i < n - 1; i++) {
        const xc = (pool.x[i] + pool.x[i + 1]) * 0.5 * scaleX;
        const yc = (pool.y[i] + pool.y[i + 1]) * 0.5 * scaleY;
        targetCtx.quadraticCurveTo(pool.x[i] * scaleX, pool.y[i] * scaleY, xc, yc);
      }
      targetCtx.lineTo(pool.x[n - 1] * scaleX, pool.y[n - 1] * scaleY);
      targetCtx.stroke();
      targetCtx.shadowBlur = 0;
    }

    targetCtx.restore();
  }

  private renderPolyOrbit(
    targetCtx: CanvasRenderingContext2D,
    state: SimSnapshot,
    scaleX: number,
    scaleY: number
  ): void {
    if (this.config.scene.type !== "POLY_ORBIT") return;
    const cfg = this.config.scene;
    const layout = orbitLayout(cfg);
    const pool = state.pool;
    const n = Math.min(cfg.orbits, pool.count);
    const cx = ORBIT_CENTER_X * scaleX;
    const cy = ORBIT_CENTER_Y * scaleY;
    const gateRad = (cfg.gate_angle_deg * Math.PI) / 180;
    const [rr, rg, rb] = hexToRgb(cfg.ring_color);

    let heatSum = 0;
    for (let i = 0; i < n; i++) heatSum += pool.heat[i];
    const alignGlow = n > 0 ? heatSum / n : 0;

    targetCtx.save();

    // luminous core: swells whenever many planets strike together (loop alignment)
    const coreR = cfg.inner_radius * 0.62 * scaleX * (1 + alignGlow * 0.9);
    const coreGrad = targetCtx.createRadialGradient(cx, cy, 2, cx, cy, coreR);
    coreGrad.addColorStop(0, `rgba(255, 244, 214, ${0.55 + 0.45 * alignGlow})`);
    coreGrad.addColorStop(0.45, `rgba(${rr}, ${rg}, ${rb}, ${0.22 + 0.4 * alignGlow})`);
    coreGrad.addColorStop(1, `rgba(${rr}, ${rg}, ${rb}, 0)`);
    targetCtx.fillStyle = coreGrad;
    targetCtx.beginPath();
    targetCtx.arc(cx, cy, coreR, 0, Math.PI * 2);
    targetCtx.fill();

    // gates
    if (cfg.show_gates) {
      const outer = (cfg.outer_radius + 46) * scaleX;
      targetCtx.lineWidth = Math.max(1, 2 * scaleX);
      for (let k = 0; k < cfg.gates; k++) {
        const a = gateRad + (k * Math.PI * 2) / cfg.gates;
        targetCtx.strokeStyle = `rgba(255, 255, 255, ${0.13 + 0.3 * alignGlow})`;
        targetCtx.beginPath();
        targetCtx.moveTo(cx + Math.cos(a) * cfg.inner_radius * 0.5 * scaleX, cy + Math.sin(a) * cfg.inner_radius * 0.5 * scaleX);
        targetCtx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
        targetCtx.stroke();

        targetCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
        targetCtx.beginPath();
        const mx = cx + Math.cos(a) * outer;
        const my = cy + Math.sin(a) * outer;
        const d = 7 * scaleX;
        targetCtx.moveTo(mx, my - d);
        targetCtx.lineTo(mx + d, my);
        targetCtx.lineTo(mx, my + d);
        targetCtx.lineTo(mx - d, my);
        targetCtx.closePath();
        targetCtx.fill();
      }
    }

    // orbit rings
    for (let i = 0; i < n; i++) {
      const heat = pool.heat[i];
      const [hr, hg, hb] = hslToRgb(pool.hue[i], 0.9, 0.6);
      targetCtx.strokeStyle = `rgba(${hr}, ${hg}, ${hb}, ${0.17 + 0.65 * heat})`;
      targetCtx.lineWidth = Math.max(1.2, (1.8 + heat * 3.2) * scaleX);
      targetCtx.beginPath();
      targetCtx.arc(cx, cy, layout.radius[i] * scaleX, 0, Math.PI * 2);
      targetCtx.stroke();
    }

    // Harmonic constellation links connecting consecutive orbiting planets
    if (cfg.constellation_links && n > 1) {
      targetCtx.lineWidth = Math.max(1, 2 * scaleX);
      for (let i = 0; i < n - 1; i++) {
        const [hr, hg, hb] = hslToRgb(pool.hue[i], 0.92, 0.66);
        const linkGlow = Math.max(pool.heat[i], pool.heat[i + 1]);
        targetCtx.strokeStyle = `rgba(${hr}, ${hg}, ${hb}, ${(0.22 + 0.45 * linkGlow).toFixed(3)})`;
        targetCtx.beginPath();
        targetCtx.moveTo(pool.x[i] * scaleX, pool.y[i] * scaleY);
        targetCtx.lineTo(pool.x[i + 1] * scaleX, pool.y[i + 1] * scaleY);
        targetCtx.stroke();
      }
    }
    targetCtx.restore();
  }

  private renderPrismChamber(
    targetCtx: CanvasRenderingContext2D,
    state: SimSnapshot,
    scaleX: number,
    scaleY: number
  ): void {
    if (this.config.scene.type !== "PRISM_CHAMBER") return;
    const cfg = this.config.scene;
    const N = cfg.sides;
    const cx = PRISM_CENTER_X * scaleX;
    const cy = PRISM_CENTER_Y * scaleY;
    const R = (state.polyRadius > 0 ? state.polyRadius : cfg.radius) * scaleX;
    const angle = state.polyAngle;
    const glows = state.sideGlow;
    void scaleY;

    const vx = (k: number, scale: number): number => cx + Math.cos(angle + (k * Math.PI * 2) / N) * R * scale;
    const vy = (k: number, scale: number): number => cy + Math.sin(angle + (k * Math.PI * 2) / N) * R * scale;

    targetCtx.save();
    targetCtx.lineCap = "round";
    targetCtx.lineJoin = "round";

    // soft interior haze that picks up the colour of recent hits
    let totalGlow = 0;
    for (let k = 0; k < N; k++) totalGlow += glows[k] ?? 0;
    const haze = targetCtx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
    haze.addColorStop(0, `rgba(255, 255, 255, ${0.03 + 0.05 * Math.min(1, totalGlow)})`);
    haze.addColorStop(1, "rgba(255, 255, 255, 0)");
    targetCtx.fillStyle = haze;
    targetCtx.beginPath();
    for (let k = 0; k < N; k++) {
      if (k === 0) targetCtx.moveTo(vx(k, 1), vy(k, 1));
      else targetCtx.lineTo(vx(k, 1), vy(k, 1));
    }
    targetCtx.closePath();
    targetCtx.fill();

    // ghost inner polygon gives the chamber depth
    targetCtx.strokeStyle = "rgba(255, 255, 255, 0.07)";
    targetCtx.lineWidth = Math.max(1, 2 * scaleX);
    targetCtx.beginPath();
    for (let k = 0; k < N; k++) {
      if (k === 0) targetCtx.moveTo(vx(k, 0.8), vy(k, 0.8));
      else targetCtx.lineTo(vx(k, 0.8), vy(k, 0.8));
    }
    targetCtx.closePath();
    targetCtx.stroke();

    // glowing sides, each with its own hue
    for (let k = 0; k < N; k++) {
      const g = Math.max(0, Math.min(1, glows[k] ?? 0));
      const [r, gg, b] = hslToRgb((k / N) * 300, 0.9, 0.5 + 0.25 * g);
      targetCtx.save();
      targetCtx.shadowColor = `rgb(${r}, ${gg}, ${b})`;
      targetCtx.shadowBlur = (6 + 30 * g) * scaleX;
      targetCtx.strokeStyle = `rgba(${r}, ${gg}, ${b}, ${0.55 + 0.45 * g})`;
      targetCtx.lineWidth = Math.max(2, cfg.wall_thickness * (1 + g * 0.9) * scaleX);
      targetCtx.beginPath();
      targetCtx.moveTo(vx(k, 1), vy(k, 1));
      targetCtx.lineTo(vx(k + 1, 1), vy(k + 1, 1));
      targetCtx.stroke();
      targetCtx.restore();
    }

    // corner studs
    targetCtx.fillStyle = "rgba(255, 255, 255, 0.85)";
    for (let k = 0; k < N; k++) {
      targetCtx.beginPath();
      targetCtx.arc(vx(k, 1), vy(k, 1), Math.max(2, cfg.wall_thickness * 0.55 * scaleX), 0, Math.PI * 2);
      targetCtx.fill();
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

    // 1. Hook text: auto-fitted within safe horizontal margins (never clips edges)
    const hookDur = cfg.arc.hook_duration_sec;
    const showHook = hookDur <= 0 || state.timeSec <= hookDur;
    if (showHook && cfg.arc.hook_text.trim().length > 0) {
      const lines = cfg.arc.hook_text.split("\n");
      const easeIn = Math.min(1, state.timeSec / 0.5);
      const popIn = 1 - Math.pow(1 - easeIn, 3);
      const fadeOutRaw = hookDur > 0 && hookDur < cfg.meta.duration_sec ? Math.max(0, Math.min(1, (hookDur - state.timeSec) / 0.7)) : 1;
      const fadeOut = fadeOutRaw * fadeOutRaw * (3 - 2 * fadeOutRaw);

      let fontSize = Math.max(11, Math.round(hud.hook_size * scaleX * (0.94 + 0.06 * popIn)));
      const maxLineW = this.width * 0.84;
      ctx.font = `900 ${fontSize}px sans-serif`;
      let widest = 0;
      for (const line of lines) {
        const w = ctx.measureText(line).width;
        if (w > widest) widest = w;
      }
      if (widest > maxLineW && widest > 1) {
        fontSize = Math.max(10, Math.floor(fontSize * (maxLineW / widest)));
      }

      ctx.save();
      ctx.globalAlpha = fadeOut;
      ctx.font = `900 ${fontSize}px sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(4, 7, 15, 0.9)";
      ctx.lineWidth = Math.max(2, 6 * scaleX);
      ctx.lineJoin = "round";
      ctx.shadowColor = hud.accent;
      ctx.shadowBlur = 10 * scaleX;
      const y0 = hud.hook_y * scaleY - (1 - popIn) * 8 * scaleY;
      for (let i = 0; i < lines.length; i++) {
        const ly = y0 + i * (fontSize * 1.24);
        ctx.strokeText(lines[i], this.width / 2, ly);
        ctx.fillText(lines[i], this.width / 2, ly);
      }
      ctx.restore();
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

    // 3. Stats & HUD per scene
    if (hud.show_lane_counts && cfg.scene.type === "TOWER_BREAKER") {
      const lanes = cfg.scene.lanes;
      const laneW = this.width / lanes.length;
      const isDuelCards = cfg.look.tower_hud_style === "duel_cards";

      if (isDuelCards) {
        // Compute current floor index & total floors per lane to determine LEADER
        let bestLane = 0;
        let bestScore = -1;
        const laneBrokenCounts = new Int32Array(lanes.length);
        const laneTotalCounts = new Int32Array(lanes.length);
        for (const fl of state.floors) {
          laneTotalCounts[fl.lane]++;
          if (fl.broken) laneBrokenCounts[fl.lane]++;
        }
        for (let l = 0; l < lanes.length; l++) {
          const score = laneBrokenCounts[l] * 1_000_000_000 + (state.laneVirtual[l] ?? 0);
          if (score > bestScore) {
            bestScore = score;
            bestLane = l;
          }
        }

        // VS badge in center
        if (lanes.length === 2) {
          ctx.font = `900 ${Math.max(12, Math.round(30 * scaleX))}px sans-serif`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
          ctx.fillText("VS", this.width / 2, this.height * 0.60);
        }

        for (let l = 0; l < lanes.length; l++) {
          const lane = lanes[l];
          const x = l * laneW + laneW / 2;
          const vCount = Math.round(this.smoothed(`lane_${l}`, state.laneVirtual[l] ?? 0));
          const curFloor = Math.min(laneTotalCounts[l], laneBrokenCounts[l] + 1);

          // LEADER badge above winning column
          if (l === bestLane && state.timeSec > 0.5) {
            ctx.font = `800 ${Math.max(9, Math.round(20 * scaleX))}px sans-serif`;
            ctx.fillStyle = "#34d399";
            ctx.fillText("LEADER", x, this.height * 0.175);
          }

          // Huge bold count
          ctx.font = `900 ${Math.max(18, Math.round(60 * scaleX))}px sans-serif`;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(vCount.toLocaleString(), x, this.height * 0.22);

          // FLOOR X/Y
          ctx.font = `700 ${Math.max(9, Math.round(22 * scaleX))}px sans-serif`;
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(`FLOOR ${curFloor}/${laneTotalCounts[l]}`, x, this.height * 0.255);

          // Multiplier / action label
          ctx.font = `800 ${Math.max(9, Math.round(21 * scaleX))}px sans-serif`;
          ctx.fillStyle = lane.color;
          ctx.fillText(lane.label, x, this.height * 0.282);
        }
      } else {
        const pillY = this.height * 0.818;
        const pillH = 92 * scaleY;
        const padX = 36 * scaleX;
        const stripW = this.width - padX * 2;
        const cardW = stripW / lanes.length;
        ctx.save();
        ctx.fillStyle = "rgba(6, 10, 20, 0.78)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
        ctx.lineWidth = Math.max(1, 2 * scaleX);
        ctx.beginPath();
        ctx.roundRect(padX, pillY - pillH / 2, stripW, pillH, 18 * scaleX);
        ctx.fill();
        ctx.stroke();

        for (let l = 0; l < lanes.length; l++) {
          const lane = lanes[l];
          const x = padX + l * cardW + cardW / 2;
          const vCount = Math.round(this.smoothed(`lane_${l}`, state.laneVirtual[l] ?? 0));

          if (l > 0) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
            ctx.lineWidth = Math.max(1, 1.5 * scaleX);
            ctx.beginPath();
            ctx.moveTo(padX + l * cardW, pillY - pillH * 0.34);
            ctx.lineTo(padX + l * cardW, pillY + pillH * 0.34);
            ctx.stroke();
          }

          const lblPx = Math.max(8, Math.round(21 * scaleX));
          ctx.font = `800 ${lblPx}px sans-serif`;
          ctx.fillStyle = lane.color;
          ctx.fillText(lane.label, x, pillY - 14 * scaleY);

          const cntPx = Math.max(10, Math.round(28 * scaleX));
          ctx.font = `900 ${cntPx}px monospace`;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(`×${vCount.toLocaleString()}`, x, pillY + 20 * scaleY);
        }
        ctx.restore();
      }

      if (state.winnerLane >= 0 && lanes[state.winnerLane]) {
        const win = lanes[state.winnerLane];
        let winSz = Math.max(14, Math.round(54 * scaleX));
        const winTxt = `WINNER: ${win.label}!`;
        ctx.font = `900 ${winSz}px sans-serif`;
        const wMeasure = ctx.measureText(winTxt).width;
        if (wMeasure > this.width * 0.86 && wMeasure > 1) {
          winSz = Math.max(12, Math.floor(winSz * ((this.width * 0.86) / wMeasure)));
          ctx.font = `900 ${winSz}px sans-serif`;
        }
        ctx.fillStyle = win.color;
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = 14 * scaleX;
        ctx.fillText(winTxt, this.width / 2, this.height * 0.36);
        ctx.shadowBlur = 0;
      }
    } else if (hud.show_lane_counts) {
      // Safe-zone frosted glass bottom pill (above platform captions & nav bar)
      const drawSafePill = (title: string, value: string, accentCol: string) => {
        const pillW = Math.min(this.width - 140 * scaleX, 680 * scaleX);
        const pillH = 98 * scaleY;
        const px = this.width / 2 - pillW / 2;
        const py = this.height * 0.81 - pillH / 2;
        ctx.save();
        ctx.fillStyle = "rgba(6, 10, 20, 0.78)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
        ctx.lineWidth = Math.max(1, 2 * scaleX);
        ctx.beginPath();
        ctx.roundRect(px, py, pillW, pillH, 22 * scaleX);
        ctx.fill();
        ctx.stroke();

        ctx.font = `700 ${Math.max(9, Math.round(21 * scaleX))}px sans-serif`;
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(title, this.width / 2, py + 32 * scaleY);
        ctx.font = `900 ${Math.max(12, Math.round(38 * scaleX))}px monospace`;
        ctx.fillStyle = accentCol;
        ctx.fillText(value, this.width / 2, py + 72 * scaleY);
        ctx.restore();
      };

      if (cfg.scene.type === "MAZE_ESCAPE") {
        const escapedSmooth = Math.round(this.smoothed("maze_escaped", state.escaped));
        drawSafePill("ESCAPED VESSELS", `${escapedSmooth.toLocaleString()} / ${state.escapeGoal.toLocaleString()}`, "#00ff9d");
      } else if (cfg.scene.type === "CUBE_ARENA") {
        const cubeCount = Math.round(this.smoothed("cube_count", state.pool.count));
        drawSafePill("ACTIVE QUANTUM CUBES", `${cubeCount.toLocaleString()} CUBES`, "#38bdf8");
      } else if (cfg.scene.type === "OVERFLOW_BOWL") {
        const bowlCount = Math.round(this.smoothed("bowl_count", state.pool.count));
        const overCount = Math.round(this.smoothed("bowl_over", state.overflowCount));
        drawSafePill("CONTAINED  •  OVERFLOWED", `${bowlCount.toLocaleString()}  •  ${overCount.toLocaleString()}`, "#ffffff");
      } else if (cfg.scene.type === "OPTICAL_MIRRORS") {
        drawSafePill("OPTICAL CAUSTIC RAYS", `${state.pool.count} LIGHT RAYS`, "#ffd166");
      } else if (cfg.scene.type === "PENDULUM_WAVE") {
        const cyclePct = Math.min(100, Math.round((state.timeSec / Math.max(1, cfg.meta.duration_sec)) * 100));
        drawSafePill("HARMONIC STRINGS  •  PHASE ALIGNMENT", `${cfg.scene.count} STRINGS  •  ${cyclePct}%`, hud.accent);
      } else if (cfg.scene.type === "POLY_ORBIT") {
        drawSafePill("CONCENTRIC ORBITS  •  RADIAL GATES", `${cfg.scene.orbits} ORBITS  •  ${cfg.scene.gates} GATES`, hud.accent);
      } else if (cfg.scene.type === "PRISM_CHAMBER") {
        const ballSmooth = Math.round(this.smoothed("prism_balls", state.pool.count));
        drawSafePill("ACOUSTIC PRISM  •  REFRACTED ORBS", `${cfg.scene.sides}-GON  •  ${ballSmooth.toLocaleString()} ORBS`, "#ffffff");
      } else if (cfg.scene.type === "ALGORITHM_ARENA" && state.arenaHud.length > 0) {
        const cols = state.arenaHud.length;
        const colW = (this.width - 140 * scaleX) / cols;
        const py = this.height * 0.81;
        ctx.save();
        ctx.fillStyle = "rgba(6, 10, 20, 0.78)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
        ctx.lineWidth = Math.max(1, 2 * scaleX);
        ctx.beginPath();
        ctx.roundRect(70 * scaleX, py - 49 * scaleY, this.width - 140 * scaleX, 98 * scaleY, 22 * scaleX);
        ctx.fill();
        ctx.stroke();
        for (let i = 0; i < cols; i++) {
          const item = state.arenaHud[i];
          const x = 70 * scaleX + i * colW + colW / 2;
          ctx.font = `700 ${Math.max(9, Math.round(21 * scaleX))}px sans-serif`;
          ctx.fillStyle = hud.accent;
          ctx.fillText(item.label.toUpperCase(), x, py - 16 * scaleY);
          ctx.font = `900 ${Math.max(11, Math.round(32 * scaleX))}px monospace`;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(item.value, x, py + 22 * scaleY);
        }
        ctx.restore();
      }
    }

    // 4. Authentic 9:16 TikTok / Reels / Shorts Safe Zone Simulator
    if (hud.show_safe_zones) {
      ctx.save();
      // Blocked danger overlays (top status + tabs, right engagement rail, bottom captions)
      ctx.fillStyle = "rgba(239, 68, 68, 0.14)";
      ctx.fillRect(0, 0, this.width, 210 * scaleY);
      ctx.fillRect(this.width - 165 * scaleX, 720 * scaleY, 165 * scaleX, 900 * scaleY);
      ctx.fillRect(0, 1620 * scaleY, this.width, this.height - 1620 * scaleY);

      ctx.strokeStyle = "rgba(34, 211, 238, 0.72)";
      ctx.setLineDash([10 * scaleX, 8 * scaleX]);
      ctx.lineWidth = Math.max(1.5, 2.5 * scaleX);
      ctx.strokeRect(42 * scaleX, 210 * scaleY, this.width - 207 * scaleX, 1410 * scaleY);
      ctx.setLineDash([]);

      ctx.font = `700 ${Math.max(10, Math.round(20 * scaleX))}px monospace`;
      ctx.fillStyle = "rgba(248, 113, 113, 0.9)";
      ctx.fillText("PLATFORM TOP BAR (AVOID)", this.width / 2, 115 * scaleY);
      ctx.fillText("CAPTION / AUDIO BAR ZONE (AVOID)", this.width / 2, 1765 * scaleY);
      ctx.fillStyle = "rgba(34, 211, 238, 0.9)";
      ctx.fillText("9:16 SAFE VIEWPORT", this.width * 0.44, 240 * scaleY);
      ctx.restore();
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
