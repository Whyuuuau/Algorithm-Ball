import { RuleConfig, RuleActionSchema } from "@asmr/schema";
import { z } from "zod";

export type RuleAction = z.infer<typeof RuleActionSchema>;

export interface RuleEvent {
  trigger: string;
  sourceId?: string;
  targetId?: string;
  value?: number;
  timeSec: number;
  frameIndex: number;
}

export interface CommandBufferItem {
  ruleId: string;
  action: RuleAction;
  depth: number;
}

export class RuleEngine {
  private rules: Map<string, RuleConfig> = new Map();
  private fireCount: Map<string, number> = new Map();
  private lastFiredSec: Map<string, number> = new Map();
  private pendingCommands: CommandBufferItem[] = [];

  constructor(rules: RuleConfig[] = []) {
    for (const rule of rules) {
      this.rules.set(rule.id, rule);
      this.fireCount.set(rule.id, 0);
      this.lastFiredSec.set(rule.id, -999);
    }
  }

  public reset(): void {
    this.pendingCommands = [];
    for (const ruleId of this.rules.keys()) {
      this.fireCount.set(ruleId, 0);
      this.lastFiredSec.set(ruleId, -999);
    }
  }

  public evaluate(events: RuleEvent[], context: { tension: number; ballCount: number; phase: string }): void {
    for (const event of events) {
      for (const [id, rule] of this.rules.entries()) {
        if (!rule.enabled) continue;
        if (rule.trigger !== event.trigger) continue;

        // Check guards
        const count = this.fireCount.get(id) || 0;
        if (rule.guard.max_fires > 0 && count >= rule.guard.max_fires) continue;

        const lastSec = this.lastFiredSec.get(id) || -999;
        if (event.timeSec - lastSec < rule.guard.cooldown_ms / 1000) continue;

        // Condition check (if specified)
        if (rule.condition) {
          if (!this.checkCondition(rule.condition, event, context)) continue;
        }

        // Increment fire count
        this.fireCount.set(id, count + 1);
        this.lastFiredSec.set(id, event.timeSec);

        // Queue actions into command buffer
        for (const action of rule.actions) {
          this.pendingCommands.push({
            ruleId: id,
            action,
            depth: 0
          });
        }
      }
    }
  }

  private checkCondition(
    condition: string,
    event: RuleEvent,
    context: { tension: number; ballCount: number; phase: string }
  ): boolean {
    try {
      // Safe declarative condition evaluation without eval()
      const parts = condition.split("&&").map((p) => p.trim());
      for (const part of parts) {
        if (part.startsWith("tension >")) {
          const val = parseFloat(part.replace("tension >", "").trim());
          if (context.tension <= val) return false;
        } else if (part.startsWith("count <")) {
          const val = parseInt(part.replace("count <", "").trim(), 10);
          if (context.ballCount >= val) return false;
        } else if (part.startsWith("lane ==")) {
          const lane = part.replace("lane ==", "").trim().replace(/['"]/g, "");
          if (event.sourceId !== lane && event.targetId !== lane) return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Drain command buffer respecting per-frame budget
   */
  public drainCommandBuffer(budgetPerFrame: number = 200): CommandBufferItem[] {
    if (this.pendingCommands.length <= budgetPerFrame) {
      const items = this.pendingCommands;
      this.pendingCommands = [];
      return items;
    }

    const items = this.pendingCommands.slice(0, budgetPerFrame);
    this.pendingCommands = this.pendingCommands.slice(budgetPerFrame);
    return items;
  }
}
