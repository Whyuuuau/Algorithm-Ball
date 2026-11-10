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

  constructor(cap: number, lanes: number) {
    this.cap = cap;
    this.virtual = new Float64Array(Math.max(1, lanes));
  }

  public reset(): void {
    this.virtual.fill(0);
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
   * Returns number of physical bodies created.
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
      made++;
    }
    return made;
  }

  private readonly tmp = new Float64Array(4);
}
