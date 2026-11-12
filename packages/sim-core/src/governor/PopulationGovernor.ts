import { BallPool } from "../engine/BallPool.js";

export interface SpawnPlan {
  /** physical balls to create */
  alloc: number;
  /** weight (damage / virtual units) of every new physical ball */
  weight: number;
  /** if > 1 the pool is full: multiply existing lane weights by this factor instead */
  scaleExisting: number;
}

/**
 * Separates virtual population (HUD number, can reach millions) from physical bodies
 * (hard capped). When the cap is reached extra population is folded into ball weight.
 */
export class PopulationGovernor {
  public readonly cap: number;
  /** virtual population per lane */
  public virtual: Float64Array;
  /** physical body count per lane */
  public physical: Uint32Array;

  constructor(cap: number, lanes: number) {
    this.cap = cap;
    this.virtual = new Float64Array(Math.max(1, lanes));
    this.physical = new Uint32Array(Math.max(1, lanes));
  }

  public reset(): void {
    this.virtual.fill(0);
    this.physical.fill(0);
  }

  public totalVirtual(): number {
    let s = 0;
    for (let i = 0; i < this.virtual.length; i++) s += this.virtual[i];
    return s;
  }

  /** Pure planning function (unit-tested). */
  public static plan(freeSlots: number, laneVirtual: number, add: number): SpawnPlan {
    if (add <= 0) return { alloc: 0, weight: 1, scaleExisting: 1 };
    if (freeSlots > 0) {
      const alloc = Math.min(Math.floor(add), freeSlots);
      return { alloc, weight: Math.max(1, Math.ceil(add / Math.max(1, alloc))), scaleExisting: 1 };
    }
    const scale = laneVirtual > 0 ? (laneVirtual + add) / laneVirtual : 1;
    return { alloc: 0, weight: 1, scaleExisting: scale };
  }

  /**
   * Add `add` virtual balls to `laneIdx`. `place(i, n)` returns [x,y,vx,vy] for the i-th new body.
   * Reserves an equal physical budget per lane so asymmetric 1 vs 1,000 duels stay visually balanced.
   */
  public spawn(
    pool: BallPool,
    laneIdx: number,
    add: number,
    baseR: number,
    place: (i: number, out: Float64Array) => void
  ): number {
    add = Math.floor(add);
    if (add <= 0) return 0;

    // In multi-lane mode, if pool is full and this lane is under its fair physical share,
    // consolidate excess balls from over-quota lanes while preserving their exact total weight.
    const numLanes = this.virtual.length;
    if (numLanes > 1 && pool.count >= pool.cap - Math.min(add, 64)) {
      const fairShare = Math.max(1, Math.floor(pool.cap / numLanes));
      if (this.physical[laneIdx] < fairShare) {
        const deficit = Math.min(add, fairShare - this.physical[laneIdx]);
        const freeNow = pool.cap - pool.count;
        const needReclaim = Math.max(0, deficit - freeNow);
        if (needReclaim > 0) {
          this.reclaimExcess(pool, fairShare, needReclaim);
        }
      }
    }

    const plan = PopulationGovernor.plan(pool.cap - pool.count, this.virtual[laneIdx], add);
    this.virtual[laneIdx] += add;

    if (plan.alloc === 0) {
      if (plan.scaleExisting > 1) {
        for (let i = 0; i < pool.count; i++) {
          if (pool.lane[i] === laneIdx) pool.setWeight(i, pool.w[i] * plan.scaleExisting);
        }
      }
      return 0;
    }
    const tmp = this.tmp;
    let made = 0;
    for (let k = 0; k < plan.alloc; k++) {
      place(k, tmp);
      if (pool.add(tmp[0], tmp[1], tmp[2], tmp[3], baseR, plan.weight, laneIdx) < 0) break;
      this.physical[laneIdx]++;
      made++;
    }
    return made;
  }

  private reclaimExcess(pool: BallPool, fairShare: number, need: number): void {
    let freed = 0;
    for (let d = 0; d < this.physical.length && freed < need; d++) {
      const excess = this.physical[d] - fairShare;
      if (excess <= 0) continue;
      const toRemove = Math.min(excess, need - freed);
      let totalW = 0;
      for (let i = 0; i < pool.count; i++) {
        if (pool.lane[i] === d) totalW += pool.w[i];
      }
      let removedW = 0;
      let removed = 0;
      for (let i = pool.count - 1; i >= 0 && removed < toRemove; i--) {
        if (pool.lane[i] === d) {
          removedW += pool.w[i];
          const last = pool.count - 1;
          if (i !== last) {
            pool.x[i] = pool.x[last];
            pool.y[i] = pool.y[last];
            pool.vx[i] = pool.vx[last];
            pool.vy[i] = pool.vy[last];
            pool.r[i] = pool.r[last];
            pool.baseR[i] = pool.baseR[last];
            pool.w[i] = pool.w[last];
            pool.lane[i] = pool.lane[last];
            pool.heat[i] = pool.heat[last];
            pool.lvl[i] = pool.lvl[last];
            pool.rot[i] = pool.rot[last];
            pool.hue[i] = pool.hue[last];
          }
          pool.count--;
          this.physical[d]--;
          removed++;
          freed++;
        }
      }
      const survivingW = totalW - removedW;
      if (removedW > 0 && survivingW > 0) {
        const scale = totalW / survivingW;
        for (let i = 0; i < pool.count; i++) {
          if (pool.lane[i] === d) pool.setWeight(i, pool.w[i] * scale);
        }
      }
    }
  }

  private readonly tmp = new Float64Array(4);
}
