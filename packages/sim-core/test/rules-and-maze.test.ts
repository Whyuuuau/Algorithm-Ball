import { describe, it, expect } from "vitest";
import { RuleEngine } from "../src/rules/RuleEngine.js";
import { MazeEscapeScene } from "../src/scenes/MazeEscape.js";
import { MAZE_RINGS_PRESET } from "@asmr/schema";
import { initRapier, RAPIER } from "../src/physics/RapierContext.js";
import { PopulationGovernor } from "../src/governor/PopulationGovernor.js";
import { SeededRNGPool } from "../src/prng/index.js";

describe("RuleEngine Guards & Maze Escape Scene", () => {
  it("should respect max_fires and budget_per_frame in RuleEngine", () => {
    const engine = new RuleEngine([
      {
        id: "spawn_rule",
        enabled: true,
        trigger: "ON_HIT_WALL",
        guard: {
          max_fires: 3,
          cooldown_ms: 0,
          budget_per_frame: 2,
          depth_limit: 3
        },
        actions: [{ type: "SPAWN", count: 10 }]
      }
    ]);

    // Send 10 events
    for (let i = 0; i < 10; i++) {
      engine.evaluate(
        [{ trigger: "ON_HIT_WALL", timeSec: i * 0.1, frameIndex: i }],
        { tension: 0.5, ballCount: 10, phase: "BUILD" }
      );
    }

    // Should only queue up to max_fires = 3 commands total
    const batch1 = engine.drainCommandBuffer(2);
    expect(batch1.length).toBe(2);

    const batch2 = engine.drainCommandBuffer(2);
    expect(batch2.length).toBe(1);

    const batch3 = engine.drainCommandBuffer(2);
    expect(batch3.length).toBe(0);
  });

  it("should initialize and rotate kinematic concentric rings in MazeEscape", async () => {
    await initRapier();
    const world = new RAPIER.World({ x: 0, y: 9.81 });
    const gov = new PopulationGovernor(1000);
    const rng = new SeededRNGPool(12345);

    const maze = new MazeEscapeScene(MAZE_RINGS_PRESET, world, gov, rng);
    maze.initArena();

    expect(maze.state.ringRotations.length).toBe(MAZE_RINGS_PRESET.scene.type === "MAZE_ESCAPE" ? MAZE_RINGS_PRESET.scene.rings.length : 0);
    const initialRot = maze.state.ringRotations[0];

    // Update 1 second
    maze.update(1.0);
    const newRot = maze.state.ringRotations[0];
    expect(newRot).not.toBe(initialRot);
  });
});
