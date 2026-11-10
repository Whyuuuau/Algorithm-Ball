import { ProjectConfig, MazeEscapeSceneConfig, MazeRingSchema } from "@asmr/schema";
import { z } from "zod";
import { RAPIER } from "../physics/RapierContext.js";
import { PopulationGovernor, PhysicalBallState } from "../governor/PopulationGovernor.js";
import { SeededRNGPool } from "../prng/index.js";

export type MazeRing = z.infer<typeof MazeRingSchema>;

export interface MazeEscapeState {
  escapedBallsCount: number;
  totalBallsToEscape: number;
  ringRotations: number[]; // current angle radians
  isComplete: boolean;
}

export class MazeEscapeScene {
  private config: ProjectConfig;
  private sceneConfig: MazeEscapeSceneConfig;
  private world: RAPIER.World;
  private governor: PopulationGovernor;
  private rng: SeededRNGPool;

  public state: MazeEscapeState;
  private nextBallId: number = 1;
  private ringBodies: { body: RAPIER.RigidBody; speed: number; colliders: RAPIER.Collider[] }[] = [];
  private ballBodyMap: Map<number, { ball: PhysicalBallState; body: RAPIER.RigidBody }> = new Map();
  private exitSensorColliderHandle: number = -1;

  public readonly arenaCenterX: number = 27; // 54m / 2
  public readonly arenaCenterY: number = 48; // 96m / 2

  constructor(
    config: ProjectConfig,
    world: RAPIER.World,
    governor: PopulationGovernor,
    rng: SeededRNGPool
  ) {
    this.config = config;
    this.sceneConfig = config.scene as MazeEscapeSceneConfig;
    this.world = world;
    this.governor = governor;
    this.rng = rng;

    this.state = {
      escapedBallsCount: 0,
      totalBallsToEscape: this.sceneConfig.balls_to_escape,
      ringRotations: this.sceneConfig.rings.map(() => 0),
      isComplete: false
    };
  }

  public initArena(): void {
    const ppm = this.config.physics.pixels_per_meter;

    // Outer boundary walls to prevent balls leaving world
    const wallBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(this.arenaCenterX, this.arenaCenterY)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(26, 0.5)
        .setTranslation(0, -47)
        .setRestitution(this.config.physics.restitution_default),
      wallBody
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(26, 0.5)
        .setTranslation(0, 47)
        .setRestitution(this.config.physics.restitution_default),
      wallBody
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.5, 47)
        .setTranslation(-26, 0)
        .setRestitution(this.config.physics.restitution_default),
      wallBody
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.5, 47)
        .setTranslation(26, 0)
        .setRestitution(this.config.physics.restitution_default),
      wallBody
    );

    // Build concentric rotating rings
    for (let r = 0; r < this.sceneConfig.rings.length; r++) {
      const ring = this.sceneConfig.rings[r];
      const radiusMeters = ring.radius / ppm;
      const thicknessMeters = Math.max(0.3, ring.thickness / ppm);

      const ringBody = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          this.arenaCenterX,
          this.arenaCenterY
        )
      );

      const colliders: RAPIER.Collider[] = [];
      const numSegments = 24;
      const gapAngleRad = (ring.gap_angle_deg * Math.PI) / 180;
      const stepAngle = (2 * Math.PI) / numSegments;

      for (let s = 0; s < numSegments; s++) {
        const segAngle = s * stepAngle;
        // Skip segment in gap angle
        if (segAngle < gapAngleRad / 2 || segAngle > 2 * Math.PI - gapAngleRad / 2) {
          continue;
        }

        const x = radiusMeters * Math.cos(segAngle);
        const y = radiusMeters * Math.sin(segAngle);
        const segLength = (2 * Math.PI * radiusMeters) / numSegments;

        const colliderDesc = RAPIER.ColliderDesc.cuboid(thicknessMeters / 2, segLength / 2)
          .setTranslation(x, y)
          .setRotation(segAngle)
          .setRestitution(this.config.physics.restitution_default)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

        const col = this.world.createCollider(colliderDesc, ringBody);
        colliders.push(col);
      }

      this.ringBodies.push({
        body: ringBody,
        speed: ring.angular_speed,
        colliders
      });
    }

    // Exit sensor zone
    const exitRadiusMeters = this.sceneConfig.exit_zone_radius / ppm;
    const exitBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(this.arenaCenterX, this.arenaCenterY + 38)
    );
    const exitColliderDesc = RAPIER.ColliderDesc.ball(exitRadiusMeters)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const exitCol = this.world.createCollider(exitColliderDesc, exitBody);
    this.exitSensorColliderHandle = exitCol.handle;

    // Spawn initial balls in center
    this.spawnBalls(this.sceneConfig.initial_balls);
  }

  public spawnBalls(count: number): void {
    const plan = this.governor.planSpawn("maze", count);
    const ppm = this.config.physics.pixels_per_meter;
    const radiusMeters = Math.max(0.15, this.sceneConfig.ball_radius / ppm);

    const allocated: PhysicalBallState[] = [];

    for (let i = 0; i < plan.allocPhysical; i++) {
      const jitterX = SeededRNGPool.range(this.rng.physics, -1.5, 1.5);
      const jitterY = SeededRNGPool.range(this.rng.physics, -1.5, 1.5);

      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(this.arenaCenterX + jitterX, this.arenaCenterY + jitterY)
        .setLinearDamping(0.02);

      const body = this.world.createRigidBody(bodyDesc);
      const colDesc = RAPIER.ColliderDesc.ball(radiusMeters)
        .setRestitution(this.config.physics.restitution_default)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

      if (!this.config.physics.ball_ball_collision) {
        colDesc.setCollisionGroups(0x00010002);
      }

      this.world.createCollider(colDesc, body);

      const ballState = this.governor.acquirePoolBall(
        this.nextBallId++,
        "maze",
        0,
        plan.weightPerBall,
        this.sceneConfig.ball_radius,
        [0, 229, 255],
        body.handle
      );

      this.ballBodyMap.set(body.handle, { ball: ballState, body });
      allocated.push(ballState);
    }

    this.governor.commitSpawn("maze", count, allocated);
  }

  public handleExitSensor(colliderHandle: number, ballBodyHandle: number): boolean {
    if (colliderHandle !== this.exitSensorColliderHandle) return false;

    const entry = this.ballBodyMap.get(ballBodyHandle);
    if (!entry) return false;

    this.state.escapedBallsCount += entry.ball.weight;
    if (this.state.escapedBallsCount >= this.state.totalBallsToEscape) {
      this.state.isComplete = true;
    }

    // Teleport or bounce ball back or respawn
    entry.body.setTranslation(
      { x: this.arenaCenterX, y: this.arenaCenterY - 10 },
      true
    );
    entry.body.setLinvel({ x: 0, y: 0 }, true);

    return true;
  }

  public update(dt: number): void {
    // Kinematic rotation of concentric rings
    for (let i = 0; i < this.ringBodies.length; i++) {
      const { body, speed } = this.ringBodies[i];
      const newAngle = this.state.ringRotations[i] + speed * dt;
      this.state.ringRotations[i] = newAngle;

      body.setNextKinematicRotation(newAngle);
    }
  }

  public getBallBody(handle: number): RAPIER.RigidBody | undefined {
    return this.ballBodyMap.get(handle)?.body;
  }

  public getAllActiveBallEntries(): IterableIterator<{ ball: PhysicalBallState; body: RAPIER.RigidBody }> {
    return this.ballBodyMap.values();
  }
}
