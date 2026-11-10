export interface PhysicalBallState {
  id: number;
  laneId: string;
  laneIdx: number;
  weight: number;
  baseRadius: number;
  colorR: number;
  colorG: number;
  colorB: number;
  active: boolean;
  bodyHandle: number; // Rapier RigidBody handle
}

export class PopulationGovernor {
  public readonly physicalCap: number;
  private virtualCounts: Map<string, number> = new Map();
  private totalVirtual: number = 0;
  private activePhysicalCount: number = 0;

  // Ball pool
  private pool: PhysicalBallState[] = [];
  private activeBalls: PhysicalBallState[] = [];

  constructor(physicalCap: number = 3000) {
    this.physicalCap = physicalCap;
  }

  public reset(): void {
    this.virtualCounts.clear();
    this.totalVirtual = 0;
    this.activePhysicalCount = 0;
    for (const b of this.pool) {
      b.active = false;
      b.weight = 1;
    }
    this.activeBalls.length = 0;
  }

  public getVirtualCount(laneId: string): number {
    return this.virtualCounts.get(laneId) || 0;
  }

  public getTotalVirtual(): number {
    return this.totalVirtual;
  }

  public getActivePhysicalCount(): number {
    return this.activePhysicalCount;
  }

  public getActiveBalls(): readonly PhysicalBallState[] {
    return this.activeBalls;
  }

  /**
   * Plan spawn allocation adhering to physical cap and weight scaling.
   * Returns: { allocPhysical: number, weightPerBall: number, scaleExisting: number }
   */
  public planSpawn(
    laneId: string,
    virtualCountToAdd: number
  ): {
    allocPhysical: number;
    weightPerBall: number;
    scaleExisting: number;
  } {
    const currentV = this.virtualCounts.get(laneId) || 0;
    const currentP = this.activePhysicalCount;
    const availableSlots = Math.max(0, this.physicalCap - currentP);

    let allocPhysical = 0;
    let weightPerBall = 1;
    let scaleExisting = 1;

    if (availableSlots > 0 && virtualCountToAdd > 0) {
      allocPhysical = Math.min(virtualCountToAdd, availableSlots);
      weightPerBall = Math.max(1, Math.ceil(virtualCountToAdd / allocPhysical));
    } else if (currentV > 0 && virtualCountToAdd > 0) {
      scaleExisting = (currentV + virtualCountToAdd) / currentV;
    }

    return { allocPhysical, weightPerBall, scaleExisting };
  }

  /**
   * Commit the spawn results
   */
  public commitSpawn(
    laneId: string,
    virtualCountToAdd: number,
    allocatedBalls: PhysicalBallState[]
  ): void {
    const currentV = this.virtualCounts.get(laneId) || 0;
    this.virtualCounts.set(laneId, currentV + virtualCountToAdd);
    this.totalVirtual += virtualCountToAdd;

    for (const ball of allocatedBalls) {
      ball.active = true;
      this.activeBalls.push(ball);
      this.activePhysicalCount++;
    }
  }

  /**
   * Apply scaling to all existing active balls in a lane
   */
  public scaleLaneWeights(laneId: string, scaleFactor: number): void {
    if (scaleFactor <= 1) return;
    for (const ball of this.activeBalls) {
      if (ball.laneId === laneId) {
        ball.weight *= scaleFactor;
      }
    }
  }

  /**
   * Recycle an inactive ball
   */
  public recycleBall(ball: PhysicalBallState): void {
    ball.active = false;
    const idx = this.activeBalls.indexOf(ball);
    if (idx !== -1) {
      this.activeBalls.splice(idx, 1);
      this.activePhysicalCount--;
    }
  }

  /**
   * Get an unused ball from pool or create new pool entry
   */
  public acquirePoolBall(
    id: number,
    laneId: string,
    laneIdx: number,
    weight: number,
    baseRadius: number,
    color: [number, number, number],
    bodyHandle: number
  ): PhysicalBallState {
    let ball = this.pool.find((b) => !b.active);
    if (!ball) {
      ball = {
        id,
        laneId,
        laneIdx,
        weight,
        baseRadius,
        colorR: color[0],
        colorG: color[1],
        colorB: color[2],
        active: true,
        bodyHandle
      };
      this.pool.push(ball);
    } else {
      ball.id = id;
      ball.laneId = laneId;
      ball.laneIdx = laneIdx;
      ball.weight = weight;
      ball.baseRadius = baseRadius;
      ball.colorR = color[0];
      ball.colorG = color[1];
      ball.colorB = color[2];
      ball.active = true;
      ball.bodyHandle = bodyHandle;
    }
    return ball;
  }

  /**
   * Sub-linear visual radius formula: r = r_base * (1 + 0.15 * log10(weight))
   */
  public static calculateVisualRadius(baseRadius: number, weight: number): number {
    if (weight <= 1) return baseRadius;
    return baseRadius * (1 + 0.15 * Math.log10(weight));
  }
}
