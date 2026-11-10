import { ProjectConfig, TowerBreakerSceneConfig, TowerLaneSchema } from "@asmr/schema";
import { z } from "zod";
import { RAPIER } from "../physics/RapierContext.js";
import { PopulationGovernor, PhysicalBallState } from "../governor/PopulationGovernor.js";
import { SeededRNGPool } from "../prng/index.js";

export type TowerLane = z.infer<typeof TowerLaneSchema>;

export interface FloorData {
  laneId: string;
  floorIndex: number;
  initialHp: number;
  currentHp: number;
  broken: boolean;
  yPos: number; // in world meters
  colliderHandle: number;
}

export interface TowerBreakerState {
  lanes: TowerLane[];
  floors: FloorData[];
  winnerLaneId: string | null;
  highestBrokenFloor: Map<string, number>;
  timeSinceLastBreakSec: number;
  wallShrinkOffset: number;
}

export class TowerBreakerScene {
  private config: ProjectConfig;
  private sceneConfig: TowerBreakerSceneConfig;
  private world: RAPIER.World;
  private governor: PopulationGovernor;
  private rng: SeededRNGPool;

  public state: TowerBreakerState;
  private nextBallId: number = 1;
  private ballBodyMap: Map<number, { ball: PhysicalBallState; body: RAPIER.RigidBody }> = new Map();
  private colliderToFloorMap: Map<number, FloorData> = new Map();

  // Arena bounds in meters (based on 1080x1920 with pixels_per_meter = 20 => 54m x 96m)
  public readonly arenaWidth: number = 54;
  public readonly arenaHeight: number = 96;

  constructor(
    config: ProjectConfig,
    world: RAPIER.World,
    governor: PopulationGovernor,
    rng: SeededRNGPool
  ) {
    this.config = config;
    this.sceneConfig = config.scene as TowerBreakerSceneConfig;
    this.world = world;
    this.governor = governor;
    this.rng = rng;

    this.state = {
      lanes: this.sceneConfig.lanes,
      floors: [],
      winnerLaneId: null,
      highestBrokenFloor: new Map(),
      timeSinceLastBreakSec: 0,
      wallShrinkOffset: 0
    };
  }

  public initArena(): void {
    const laneCount = this.sceneConfig.lanes.length;
    const laneWidth = this.arenaWidth / laneCount;
    const ppm = this.config.physics.pixels_per_meter;

    // Floor HP values
    const hpValues = this.sceneConfig.floors_hp.values;
    const floorCount = hpValues.length;

    // Build static boundary walls and lane dividers
    for (let i = 0; i <= laneCount; i++) {
      const x = i * laneWidth;
      // Vertical divider
      const wallBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, this.arenaHeight / 2);
      const wallBody = this.world.createRigidBody(wallBodyDesc);
      const wallColliderDesc = RAPIER.ColliderDesc.cuboid(0.4, this.arenaHeight / 2)
        .setRestitution(this.config.physics.restitution_default);
      this.world.createCollider(wallColliderDesc, wallBody);
    }

    // Top and bottom boundaries
    const topBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(this.arenaWidth / 2, 0);
    const topBody = this.world.createRigidBody(topBodyDesc);
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(this.arenaWidth / 2, 0.5).setRestitution(this.config.physics.restitution_default),
      topBody
    );

    const bottomBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(this.arenaWidth / 2, this.arenaHeight);
    const bottomBody = this.world.createRigidBody(bottomBodyDesc);
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(this.arenaWidth / 2, 0.5).setRestitution(this.config.physics.restitution_default),
      bottomBody
    );

    // Create floors per lane
    // Floors are placed in the lower 70% of the lane
    const floorStartY = this.arenaHeight * 0.35;
    const floorSpacing = (this.arenaHeight * 0.6) / floorCount;

    for (let l = 0; l < laneCount; l++) {
      const lane = this.sceneConfig.lanes[l];
      const laneCenterX = l * laneWidth + laneWidth / 2;
      this.state.highestBrokenFloor.set(lane.id, 0);

      for (let f = 0; f < floorCount; f++) {
        const y = floorStartY + f * floorSpacing;
        const hp = hpValues[f];

        const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(laneCenterX, y);
        const floorBody = this.world.createRigidBody(floorBodyDesc);

        // Active collision events on floors!
        const floorColliderDesc = RAPIER.ColliderDesc.cuboid((laneWidth - 1) / 2, 0.4)
          .setRestitution(this.config.physics.restitution_default)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

        const floorCollider = this.world.createCollider(floorColliderDesc, floorBody);

        const floorData: FloorData = {
          laneId: lane.id,
          floorIndex: f + 1,
          initialHp: hp,
          currentHp: hp,
          broken: false,
          yPos: y,
          colliderHandle: floorCollider.handle
        };

        this.state.floors.push(floorData);
        this.colliderToFloorMap.set(floorCollider.handle, floorData);
      }

      // Initial ball spawn for this lane
      this.spawnBallsForLane(lane.id, lane.initial_balls, l * laneWidth + laneWidth / 2, 8);
    }
  }

  /**
   * Spawn balls for a specific lane respecting Governor
   */
  public spawnBallsForLane(
    laneId: string,
    virtualCount: number,
    spawnX: number,
    spawnY: number
  ): void {
    const laneIdx = this.sceneConfig.lanes.findIndex((l) => l.id === laneId);
    if (laneIdx === -1) return;
    const lane = this.sceneConfig.lanes[laneIdx];

    const plan = this.governor.planSpawn(laneId, virtualCount);

    if (plan.scaleExisting > 1) {
      this.governor.scaleLaneWeights(laneId, plan.scaleExisting);
      this.governor.commitSpawn(laneId, virtualCount, []);
      return;
    }

    const hexToRgb = (hex: string): [number, number, number] => {
      const num = parseInt(hex.replace("#", ""), 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    };
    const rgb = hexToRgb(lane.color);

    const allocated: PhysicalBallState[] = [];
    const ppm = this.config.physics.pixels_per_meter;
    const radiusMeters = Math.max(0.15, lane.ball_radius / ppm);

    for (let i = 0; i < plan.allocPhysical; i++) {
      // Small seeded jitter in position
      const jitterX = SeededRNGPool.range(this.rng.physics, -0.6, 0.6);
      const jitterY = SeededRNGPool.range(this.rng.physics, -0.6, 0.6);

      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawnX + jitterX, spawnY + jitterY)
        .setLinearDamping(0.05);

      const body = this.world.createRigidBody(bodyDesc);

      const colliderDesc = RAPIER.ColliderDesc.ball(radiusMeters)
        .setRestitution(this.config.physics.restitution_default)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

      // Default: disable ball-ball collision unless enabled in config
      if (!this.config.physics.ball_ball_collision) {
        // Group 0b0001 (ball), mask 0b0010 (walls & floors only)
        colliderDesc.setCollisionGroups(0x00010002);
      }

      this.world.createCollider(colliderDesc, body);

      const ballState = this.governor.acquirePoolBall(
        this.nextBallId++,
        laneId,
        laneIdx,
        plan.weightPerBall,
        lane.ball_radius,
        rgb,
        body.handle
      );

      this.ballBodyMap.set(body.handle, { ball: ballState, body });
      allocated.push(ballState);
    }

    this.governor.commitSpawn(laneId, virtualCount, allocated);
  }

  /**
   * Process floor hit collision
   */
  public handleFloorHit(
    colliderHandle: number,
    ballBodyHandle: number
  ): { floor: FloorData; broken: boolean; damage: number } | null {
    const floor = this.colliderToFloorMap.get(colliderHandle);
    if (!floor || floor.broken) return null;

    const ballEntry = this.ballBodyMap.get(ballBodyHandle);
    const damage = ballEntry ? ballEntry.ball.weight : 1;

    floor.currentHp -= damage;

    if (floor.currentHp <= 0) {
      floor.broken = true;
      floor.currentHp = 0;
      this.state.timeSinceLastBreakSec = 0;

      // Update highest floor
      const currentHighest = this.state.highestBrokenFloor.get(floor.laneId) || 0;
      if (floor.floorIndex > currentHighest) {
        this.state.highestBrokenFloor.set(floor.laneId, floor.floorIndex);
      }

      // Check win condition
      if (floor.floorIndex === this.sceneConfig.floors_hp.values.length) {
        if (!this.state.winnerLaneId) {
          this.state.winnerLaneId = floor.laneId;
        }
      }

      // Disable floor collider from world
      const collider = this.world.getCollider(colliderHandle);
      if (collider) {
        collider.setEnabled(false);
      }

      // Trigger lane break action!
      const lane = this.sceneConfig.lanes.find((l) => l.id === floor.laneId);
      if (lane) {
        const action = lane.on_floor_break;
        const currentV = this.governor.getVirtualCount(floor.laneId);
        const laneIdx = this.sceneConfig.lanes.findIndex((l) => l.id === floor.laneId);
        const laneWidth = this.arenaWidth / this.sceneConfig.lanes.length;
        const spawnX = laneIdx * laneWidth + laneWidth / 2;

        if (action.op === "MULTIPLY") {
          const spawnCount = Math.floor(currentV * (action.value - 1));
          this.spawnBallsForLane(floor.laneId, Math.max(1, spawnCount), spawnX, floor.yPos - 2);
        } else if (action.op === "ADD") {
          this.spawnBallsForLane(floor.laneId, action.value, spawnX, floor.yPos - 2);
        }
      }

      return { floor, broken: true, damage };
    }

    return { floor, broken: false, damage };
  }

  /**
   * Update kinematic and anti-stalemate mechanics
   */
  public update(dt: number): void {
    this.state.timeSinceLastBreakSec += dt;

    // Sudden death shrink if stalled
    if (this.state.timeSinceLastBreakSec > this.sceneConfig.anti_stalemate_sec) {
      this.state.wallShrinkOffset = Math.min(2.5, (this.state.timeSinceLastBreakSec - this.sceneConfig.anti_stalemate_sec) * 0.3);
      // Impart gentle dynamic upward/inward bounce to balls
      for (const { body } of this.ballBodyMap.values()) {
        const vel = body.linvel();
        if (Math.abs(vel.y) < 1.0) {
          body.applyImpulse({ x: 0, y: -2.0 }, true);
        }
      }
    } else {
      this.state.wallShrinkOffset = 0;
    }
  }

  public getBallBody(handle: number): RAPIER.RigidBody | undefined {
    return this.ballBodyMap.get(handle)?.body;
  }

  public getAllActiveBallEntries(): IterableIterator<{ ball: PhysicalBallState; body: RAPIER.RigidBody }> {
    return this.ballBodyMap.values();
  }
}
