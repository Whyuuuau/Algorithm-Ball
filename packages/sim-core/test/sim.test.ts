import { describe, it, expect } from "vitest";
import {
  CLASSIC_3_TOWERS_PRESET,
  MAZE_RINGS_PRESET,
  SAND_PRESET,
  TSP_PRESET,
  LIGHTNING_PRESET,
  BOIDS_PRESET,
  type ProjectConfig
} from "@asmr/schema";
import {
  SimCore,
  SeededRNGPool,
  BallPool,
  PopulationGovernor,
  RuleEngine
} from "../src/index.js";

describe("@asmr/sim-core", () => {
  it("produces identical PRNG sequences for identical seeds", () => {
    const poolA = new SeededRNGPool(424242);
    const poolB = new SeededRNGPool(424242);
    for (let i = 0; i < 100; i++) {
      expect(poolA.physics()).toBe(poolB.physics());
      expect(poolA.vfx()).toBe(poolB.vfx());
      expect(poolA.audio()).toBe(poolB.audio());
    }
  });

  it("enforces physical_cap via PopulationGovernor while tracking millions of virtual balls", () => {
    const pool = new BallPool(120);
    const gov = new PopulationGovernor(120, 3);

    gov.spawn(pool, 0, 50, 10, (i, out) => {
      out[0] = 50 + i;
      out[1] = 100;
      out[2] = 0;
      out[3] = 200;
    });
    expect(pool.count).toBe(50);
    expect(gov.virtual[0]).toBe(50);

    // Spawn 50,000 additional virtual balls -> physical count caps at 120 while virtual reaches 50,050
    gov.spawn(pool, 0, 50_000, 10, (i, out) => {
      out[0] = 50 + (i % 40);
      out[1] = 120;
      out[2] = 10;
      out[3] = 220;
    });
    expect(gov.virtual[0]).toBe(50_050);
    expect(pool.count).toBe(120);
    expect(gov.totalVirtual()).toBe(50_050);
  });

  it("runs TOWER_BREAKER deterministically across 600 frames in < 500ms", () => {
    const cfg: ProjectConfig = structuredClone(CLASSIC_3_TOWERS_PRESET);
    const sim1 = new SimCore(cfg, 360, 640);
    const sim2 = new SimCore(cfg, 360, 640);
    sim1.initSync();
    sim2.initSync();

    const t0 = performance.now();
    let s1 = sim1.step();
    let s2 = sim2.step();
    for (let f = 1; f < 600; f++) {
      s1 = sim1.step();
      s2 = sim2.step();
    }
    const elapsedMs = performance.now() - t0;

    expect(s1.hash).toBe(s2.hash);
    expect(s1.frame).toBe(599);
    expect(sim1.getHitLog().length).toBeGreaterThan(10);
    expect(elapsedMs).toBeLessThan(1000);
  });

  it("damages and breaks floors in TOWER_BREAKER and executes lane actions", () => {
    const cfg: ProjectConfig = structuredClone(CLASSIC_3_TOWERS_PRESET);
    if (cfg.scene.type === "TOWER_BREAKER") {
      cfg.scene.floors_hp = {
        mode: "manual",
        values: [1, 2, 3],
        base: 1,
        growth: 2,
        count: 3
      };
    }
    const sim = new SimCore(cfg, 360, 640);
    sim.initSync();

    for (let f = 0; f < 300; f++) {
      sim.step();
    }
    const brokeFloor = sim.getHitLog().some((h) => h.kind === "break");
    expect(brokeFloor).toBe(true);
  });

  it("runs MAZE_ESCAPE deterministically and rotates/breaks rings", () => {
    const cfg: ProjectConfig = structuredClone(MAZE_RINGS_PRESET);
    const sim1 = new SimCore(cfg, 360, 640);
    const sim2 = new SimCore(cfg, 360, 640);
    sim1.initSync();
    sim2.initSync();

    for (let f = 0; f < 300; f++) {
      sim1.step();
      sim2.step();
    }
    const snap1 = sim1.step();
    const snap2 = sim2.step();
    expect(snap1.hash).toBe(snap2.hash);
    expect(snap1.rings.length).toBeGreaterThan(0);
    expect(sim1.getHitLog().length).toBeGreaterThan(0);
  });

  it("runs all 4 ALGORITHM_ARENA modes deterministically with pixel output and hits", () => {
    const presets = [SAND_PRESET, TSP_PRESET, LIGHTNING_PRESET, BOIDS_PRESET];
    for (const preset of presets) {
      const cfg = structuredClone(preset);
      const simA = new SimCore(cfg, 360, 640);
      const simB = new SimCore(cfg, 360, 640);
      simA.initSync();
      simB.initSync();

      let snapA = simA.step();
      let snapB = simB.step();
      for (let f = 1; f < 120; f++) {
        snapA = simA.step();
        snapB = simB.step();
      }
      expect(snapA.hash).toBe(snapB.hash);
      expect(snapA.image).not.toBeNull();
      expect(snapA.image!.length).toBe(snapA.imageW * snapA.imageH);
      expect(simA.getHitLog().length).toBeGreaterThan(0);
    }
  });

  it("enforces RuleEngine triggers and recursion/cooldown guards", () => {
    const engine = new RuleEngine([
      {
        id: "timer_double",
        enabled: true,
        trigger: "ON_TIMER",
        lane: "",
        threshold: 0,
        at_sec: 0.5,
        every_sec: 0.5,
        min_tension: 0,
        guard: {
          max_fires: 2,
          cooldown_ms: 400,
          depth_limit: 2,
          budget_per_frame: 4
        },
        actions: [{ type: "MULTIPLY_BALLS", value: 2, target_lane: "", target_rule: "" }]
      }
    ]);

    engine.onFrame({ timeSec: 0.5, frame: 30, tension: 0.5, virtualTotal: 10, bpm: 120 });
    const a1 = engine.drain(4);
    expect(a1.length).toBe(1);

    // Cooldown guard blocks immediate re-trigger at 0.6s
    engine.onFrame({ timeSec: 0.6, frame: 36, tension: 0.5, virtualTotal: 10, bpm: 120 });
    const a2 = engine.drain(4);
    expect(a2.length).toBe(0);

    // Allowed at 1.0s (2nd fire)
    engine.onFrame({ timeSec: 1.0, frame: 60, tension: 0.5, virtualTotal: 10, bpm: 120 });
    const a3 = engine.drain(4);
    expect(a3.length).toBe(1);

    // Blocked at 1.5s because max_fires = 2
    engine.onFrame({ timeSec: 1.5, frame: 90, tension: 0.5, virtualTotal: 10, bpm: 120 });
    const a4 = engine.drain(4);
    expect(a4.length).toBe(0);
  });
});
