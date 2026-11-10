import { describe, it, expect } from "vitest";
import { CLASSIC_3_TOWERS_PRESET } from "@asmr/schema";
import { SimCore } from "../src/SimCore.js";
import { PopulationGovernor } from "../src/governor/PopulationGovernor.js";

describe("SimCore Determinism & Governor Contract", () => {
  it("should produce 100% identical hashes across two runs with identical seed", async () => {
    const sim1 = new SimCore(CLASSIC_3_TOWERS_PRESET);
    await sim1.init();

    const sim2 = new SimCore(CLASSIC_3_TOWERS_PRESET);
    await sim2.init();

    const hashes1: number[] = [];
    const hashes2: number[] = [];

    // Step 120 frames (2 seconds)
    for (let i = 0; i < 120; i++) {
      const snap1 = sim1.step();
      const snap2 = sim2.step();

      if (i % 60 === 0) {
        hashes1.push(snap1.hash);
        hashes2.push(snap2.hash);
      }
    }

    expect(hashes1.length).toBeGreaterThan(0);
    expect(hashes1).toEqual(hashes2);
  });

  it("should strictly respect physical_cap even with massive virtual spawn", () => {
    const cap = 500;
    const gov = new PopulationGovernor(cap);

    // Initial spawn
    const plan1 = gov.planSpawn("lane1", 100);
    expect(plan1.allocPhysical).toBe(100);
    expect(plan1.scaleExisting).toBe(1);

    const balls1 = [];
    for (let i = 0; i < 100; i++) {
      balls1.push(gov.acquirePoolBall(i, "lane1", 0, plan1.weightPerBall, 6, [0, 255, 0], i));
    }
    gov.commitSpawn("lane1", 100, balls1);

    expect(gov.getTotalVirtual()).toBe(100);
    expect(gov.getActivePhysicalCount()).toBe(100);

    // Huge spawn exceeding cap
    const plan2 = gov.planSpawn("lane1", 10000);
    expect(plan2.allocPhysical).toBe(400); // Only 400 slots left
    expect(plan2.weightPerBall).toBe(25); // 10000 / 400

    const balls2 = [];
    for (let i = 100; i < 500; i++) {
      balls2.push(gov.acquirePoolBall(i, "lane1", 0, plan2.weightPerBall, 6, [0, 255, 0], i));
    }
    gov.commitSpawn("lane1", 10000, balls2);

    expect(gov.getTotalVirtual()).toBe(10100);
    expect(gov.getActivePhysicalCount()).toBe(500); // Reached cap exactly

    // Subsequent spawn when already capped
    const plan3 = gov.planSpawn("lane1", 50000);
    expect(plan3.allocPhysical).toBe(0);
    expect(plan3.scaleExisting).toBeGreaterThan(1);

    gov.scaleLaneWeights("lane1", plan3.scaleExisting);
    gov.commitSpawn("lane1", 50000, []);

    expect(gov.getTotalVirtual()).toBe(60100);
    expect(gov.getActivePhysicalCount()).toBe(500); // Still capped at 500!
  });
});
