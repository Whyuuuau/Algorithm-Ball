import { ProjectConfig } from "@asmr/schema";
import { RAPIER, initRapier } from "./physics/RapierContext.js";
import { SeededRNGPool, hashFnv1a } from "./prng/index.js";
import { PopulationGovernor } from "./governor/PopulationGovernor.js";
import { RuleEngine } from "./rules/RuleEngine.js";
import { TowerBreakerScene, FloorData } from "./scenes/TowerBreaker.js";
import { MazeEscapeScene } from "./scenes/MazeEscape.js";

export interface AudioEvent {
  t: number;
  voice: string;
  note: number;
  vel: number;
  x: number;
  y: number;
  lane: string;
}

export interface SimStateSnapshot {
  frame: number;
  timeSec: number;
  totalFrames: number;
  virtualBallCount: number;
  physicalBallCount: number;
  ballBuffer: Float32Array; // Interleaved: [x, y, vx, vy, radius, r, g, b, alpha, laneIdx] (10 floats per ball)
  floors: FloorData[];
  escapedBallsCount: number;
  ringRotations: number[];
  winnerLaneId: string | null;
  hash: number;
}

export class SimCore {
  public readonly config: ProjectConfig;
  public readonly dt: number;
  public frame: number = 0;

  private world!: RAPIER.World;
  private eventQueue!: RAPIER.EventQueue;
  private rng!: SeededRNGPool;
  private governor!: PopulationGovernor;
  private ruleEngine!: RuleEngine;

  private towerScene: TowerBreakerScene | null = null;
  private mazeScene: MazeEscapeScene | null = null;

  private audioLog: AudioEvent[] = [];
  private currentHash: number = 0;

  // Preallocated buffer for zero-garbage state transfer (cap * 10 floats)
  private ballBuffer: Float32Array;

  constructor(config: ProjectConfig) {
    this.config = config;
    this.dt = 1 / config.meta.fps;
    const cap = config.physics.physical_cap || 3000;
    this.ballBuffer = new Float32Array(cap * 10);
  }

  public async init(): Promise<void> {
    await initRapier();

    const grav = this.config.physics.gravity;
    this.world = new RAPIER.World({ x: grav[0], y: grav[1] });
    this.eventQueue = new RAPIER.EventQueue(true);

    this.rng = new SeededRNGPool(this.config.seed);
    this.governor = new PopulationGovernor(this.config.physics.physical_cap);
    this.ruleEngine = new RuleEngine(this.config.rules);

    if (this.config.scene.type === "TOWER_BREAKER") {
      this.towerScene = new TowerBreakerScene(
        this.config,
        this.world,
        this.governor,
        this.rng
      );
      this.towerScene.initArena();
    } else if (this.config.scene.type === "MAZE_ESCAPE") {
      this.mazeScene = new MazeEscapeScene(
        this.config,
        this.world,
        this.governor,
        this.rng
      );
      this.mazeScene.initArena();
    }

    this.frame = 0;
    this.audioLog = [];
    this.currentHash = 0;
  }

  public step(): SimStateSnapshot {
    const timeSec = this.frame * this.dt;
    const substeps = this.config.physics.substeps || 4;
    const subDt = this.dt / substeps;
    this.world.timestep = subDt;

    // 1. Drain Rule Engine commands from previous frame
    const commands = this.ruleEngine.drainCommandBuffer(200);
    for (const cmd of commands) {
      if (cmd.action.type === "SPAWN" && this.towerScene) {
        const laneId = cmd.action.at || "left";
        this.towerScene.spawnBallsForLane(laneId, cmd.action.count || 10, 27, 10);
      }
    }

    // 2. Update scene kinematics (rings, anti-stalemate)
    if (this.towerScene) {
      this.towerScene.update(this.dt);
    } else if (this.mazeScene) {
      this.mazeScene.update(this.dt);
    }

    // 3. Step physics substeps
    for (let s = 0; s < substeps; s++) {
      this.world.step(this.eventQueue);
    }

    // 4. Collect and deterministically sort collision pairs
    const rawHits: { h1: number; h2: number; started: boolean }[] = [];
    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (started) {
        const a = Math.min(h1, h2);
        const b = Math.max(h1, h2);
        rawHits.push({ h1: a, h2: b, started });
      }
    });

    // Deterministic sorting
    rawHits.sort((a, b) => (a.h1 !== b.h1 ? a.h1 - b.h1 : a.h2 - b.h2));

    // 5. Process hits & generate audio events
    const maxSpeed = this.config.physics.max_speed;
    const ppm = this.config.physics.pixels_per_meter;

    for (const hit of rawHits) {
      if (this.towerScene) {
        // Find which is collider and which is ball body
        const res = this.towerScene.handleFloorHit(hit.h1, hit.h2) || this.towerScene.handleFloorHit(hit.h2, hit.h1);
        if (res) {
          const ballBody = this.towerScene.getBallBody(hit.h1) || this.towerScene.getBallBody(hit.h2);
          const pos = ballBody ? ballBody.translation() : { x: 27, y: res.floor.yPos };
          const linvel = ballBody ? ballBody.linvel() : { x: 0, y: 10 };
          const speed = Math.hypot(linvel.x, linvel.y);
          const velNorm = Math.min(1.0, speed / 30);

          // Note calculation: base scale note + floor escalation
          const floorEscalation = (res.floor.floorIndex - 1) * (this.config.sound.escalation.pitch_semitones_per_floor || 0.5);
          const midiBase = 60; // C4
          const note = Math.round(midiBase + floorEscalation + (res.broken ? 7 : 0));

          this.audioLog.push({
            t: timeSec,
            voice: this.config.sound.palette,
            note,
            vel: Math.max(0.2, velNorm),
            x: Math.max(0, Math.min(1, pos.x / 54)),
            y: Math.max(0, Math.min(1, pos.y / 96)),
            lane: res.floor.laneId
          });
        }
      } else if (this.mazeScene) {
        const escaped = this.mazeScene.handleExitSensor(hit.h1, hit.h2) || this.mazeScene.handleExitSensor(hit.h2, hit.h1);
        if (escaped) {
          this.audioLog.push({
            t: timeSec,
            voice: this.config.sound.palette,
            note: 72, // C5
            vel: 0.9,
            x: 0.5,
            y: 0.9,
            lane: "maze"
          });
        }
      }
    }

    // 6. Clamp velocities & pack ball buffer for rendering
    let ballIdx = 0;
    let ballEntries = this.towerScene
      ? this.towerScene.getAllActiveBallEntries()
      : this.mazeScene
      ? this.mazeScene.getAllActiveBallEntries()
      : [].values();

    let stateCoordSum = 0;

    for (const { ball, body } of ballEntries) {
      if (!ball.active) continue;

      const trans = body.translation();
      const linvel = body.linvel();
      const spd = Math.hypot(linvel.x, linvel.y);

      // Clamp speed
      if (spd > maxSpeed) {
        const factor = maxSpeed / spd;
        body.setLinvel({ x: linvel.x * factor, y: linvel.y * factor }, true);
      }

      // Pack into preallocated buffer
      const offset = ballIdx * 10;
      this.ballBuffer[offset + 0] = trans.x * ppm; // x in canvas pixels
      this.ballBuffer[offset + 1] = trans.y * ppm; // y in canvas pixels
      this.ballBuffer[offset + 2] = linvel.x * ppm;
      this.ballBuffer[offset + 3] = linvel.y * ppm;
      this.ballBuffer[offset + 4] = PopulationGovernor.calculateVisualRadius(ball.baseRadius, ball.weight);
      this.ballBuffer[offset + 5] = ball.colorR / 255;
      this.ballBuffer[offset + 6] = ball.colorG / 255;
      this.ballBuffer[offset + 7] = ball.colorB / 255;
      this.ballBuffer[offset + 8] = 1.0; // alpha
      this.ballBuffer[offset + 9] = ball.laneIdx;

      stateCoordSum += trans.x * 100 + trans.y * 10;
      ballIdx++;
    }

    // 7. Calculate FNV-1a hash every 60 frames
    if (this.frame % 60 === 0) {
      this.currentHash = hashFnv1a(`f:${this.frame}:v:${this.governor.getTotalVirtual()}:s:${Math.round(stateCoordSum)}`);
    }

    const totalFrames = Math.round(this.config.meta.duration_sec * this.config.meta.fps);

    const snapshot: SimStateSnapshot = {
      frame: this.frame,
      timeSec,
      totalFrames,
      virtualBallCount: this.governor.getTotalVirtual(),
      physicalBallCount: this.governor.getActivePhysicalCount(),
      ballBuffer: this.ballBuffer.subarray(0, ballIdx * 10),
      floors: this.towerScene ? [...this.towerScene.state.floors] : [],
      escapedBallsCount: this.mazeScene ? this.mazeScene.state.escapedBallsCount : 0,
      ringRotations: this.mazeScene ? [...this.mazeScene.state.ringRotations] : [],
      winnerLaneId: this.towerScene ? this.towerScene.state.winnerLaneId : null,
      hash: this.currentHash
    };

    this.frame++;
    return snapshot;
  }

  public getHitLog(): AudioEvent[] {
    return this.audioLog;
  }
}
