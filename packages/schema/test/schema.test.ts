import { describe, it, expect } from "vitest";
import {
  PRESETS,
  CLASSIC_3_TOWERS_PRESET,
  parseProjectConfig,
  resolveFloorHp,
  evaluateTensionCurve
} from "../src/index.js";

describe("@asmr/schema", () => {
  it("validates all built-in presets against ProjectConfigSchema with zero duplicate titles or hooks", () => {
    const entries = Object.values(PRESETS);
    expect(entries.length).toBeGreaterThanOrEqual(17);
    const titles = new Set<string>();
    const hooks = new Set<string>();
    for (const entry of entries) {
      const parsed = parseProjectConfig(entry.config);
      expect(parsed.version).toBe("2.0");
      expect(parsed.meta.width).toBe(1080);
      expect(parsed.meta.height).toBe(1920);
      expect(titles.has(parsed.meta.title)).toBe(false);
      expect(hooks.has(parsed.arc.hook_text)).toBe(false);
      titles.add(parsed.meta.title);
      hooks.add(parsed.arc.hook_text);
    }
  });

  it("resolves manual and exponential floor HP lists accurately", () => {
    const baseScene = structuredClone(CLASSIC_3_TOWERS_PRESET.scene);
    if (baseScene.type !== "TOWER_BREAKER") throw new Error("expected tower");

    baseScene.floors_hp = {
      mode: "manual",
      values: [10, 25, 50],
      base: 10,
      growth: 2,
      count: 5
    };
    const manual = resolveFloorHp(baseScene, baseScene.lanes[0]);
    expect(manual).toEqual([10, 25, 50]);

    baseScene.floors_hp = {
      mode: "exponential",
      values: [10],
      base: 10,
      growth: 2,
      count: 4
    };
    const exp = resolveFloorHp(baseScene, baseScene.lanes[0]);
    expect(exp).toEqual([10, 20, 40, 80]);
  });

  it("evaluates smoothstep tension curve within [0, 1] bounds", () => {
    const curve: ReadonlyArray<readonly [number, number]> = [
      [0, 0.1],
      [0.5, 0.5],
      [1.0, 0.9]
    ];
    expect(evaluateTensionCurve(curve, 0)).toBeCloseTo(0.1, 5);
    expect(evaluateTensionCurve(curve, 0.5)).toBeCloseTo(0.5, 5);
    expect(evaluateTensionCurve(curve, 1.0)).toBeCloseTo(0.9, 5);
    const mid = evaluateTensionCurve(curve, 0.25);
    expect(mid).toBeGreaterThan(0.1);
    expect(mid).toBeLessThan(0.5);
  });
});
