import type { RuleAction, RuleConfig } from "@asmr/schema";

export type RuleTrigger = RuleConfig["trigger"];

export interface RuleEvent {
  trigger: RuleTrigger;
  lane: number;
  laneId: string;
  index: number;
  /** chain depth (0 = organic, +1 for every rule-caused event) */
  depth: number;
}

export interface Command {
  ruleId: string;
  action: RuleAction;
  lane: number;
  depth: number;
}

export interface RuleContext {
  timeSec: number;
  frame: number;
  tension: number;
  virtualTotal: number;
  bpm: number;
}

/**
 * Declarative Trigger -> Condition -> Action[] engine. Effects are queued in a command buffer
 * and applied at the start of the NEXT frame (deterministic ordering, no re-entrancy).
 */
export class RuleEngine {
  private readonly rules: RuleConfig[];
  private readonly enabled: boolean[];
  private readonly fires: number[];
  private readonly lastFire: number[];
  private readonly countArmed: boolean[];
  private queue: Command[] = [];
  private lastBeat = -1;

  constructor(rules: RuleConfig[]) {
    this.rules = rules;
    this.enabled = rules.map((r) => r.enabled);
    this.fires = rules.map(() => 0);
    this.lastFire = rules.map(() => -1e9);
    this.countArmed = rules.map(() => true);
  }

  public reset(): void {
    this.queue = [];
    this.lastBeat = -1;
    this.rules.forEach((r, i) => {
      this.enabled[i] = r.enabled;
      this.fires[i] = 0;
      this.lastFire[i] = -1e9;
      this.countArmed[i] = true;
    });
  }

  private tryFire(i: number, ctx: RuleContext, lane: number, depth: number): void {
    const r = this.rules[i];
    if (!this.enabled[i]) return;
    if (depth > r.guard.depth_limit) return;
    if (r.guard.max_fires > 0 && this.fires[i] >= r.guard.max_fires) return;
    if (ctx.timeSec - this.lastFire[i] < r.guard.cooldown_ms / 1000) return;
    if (ctx.tension < r.min_tension) return;
    this.fires[i]++;
    this.lastFire[i] = ctx.timeSec;
    for (const a of r.actions) {
      if (a.type === "TOGGLE_RULE" && a.target_rule) {
        const t = this.rules.findIndex((x) => x.id === a.target_rule);
        if (t >= 0) this.enabled[t] = !this.enabled[t];
        continue;
      }
      this.queue.push({ ruleId: r.id, action: a, lane, depth: depth + 1 });
    }
  }

  /** Feed discrete events (floor break, ring break, exit). */
  public onEvent(ev: RuleEvent, ctx: RuleContext): void {
    for (let i = 0; i < this.rules.length; i++) {
      const r = this.rules[i];
      if (r.trigger !== ev.trigger) continue;
      if (r.lane && r.lane !== ev.laneId) continue;
      if (r.threshold > 0 && ev.index < r.threshold) continue;
      this.tryFire(i, ctx, ev.lane, ev.depth);
    }
  }

  /** Time based triggers, call once per frame. */
  public onFrame(ctx: RuleContext): void {
    const beat = ctx.bpm > 0 ? Math.floor(ctx.timeSec / (60 / ctx.bpm)) : -1;
    for (let i = 0; i < this.rules.length; i++) {
      const r = this.rules[i];
      if (r.trigger === "ON_TIMER") {
        if (r.every_sec > 0) {
          if (ctx.timeSec >= r.at_sec && ctx.timeSec - this.lastFire[i] >= r.every_sec - 1e-9) this.tryFire(i, ctx, 0, 0);
        } else if (this.fires[i] === 0 && ctx.timeSec >= r.at_sec) {
          this.tryFire(i, ctx, 0, 0);
        }
      } else if (r.trigger === "ON_COUNT_REACHED") {
        if (ctx.virtualTotal >= r.threshold) {
          if (this.countArmed[i]) {
            this.countArmed[i] = false;
            this.tryFire(i, ctx, 0, 0);
          }
        } else this.countArmed[i] = true;
      } else if (r.trigger === "ON_BEAT") {
        if (beat !== this.lastBeat) this.tryFire(i, ctx, 0, 0);
      }
    }
    this.lastBeat = beat;
  }

  /** Take at most `budget` commands (global budget = min over rules is applied per rule guard). */
  public drain(budget: number): Command[] {
    if (this.queue.length === 0) return this.queue;
    if (this.queue.length <= budget) {
      const q = this.queue;
      this.queue = [];
      return q;
    }
    const out = this.queue.slice(0, budget);
    this.queue = this.queue.slice(budget);
    return out;
  }

  public pending(): number {
    return this.queue.length;
  }
}
