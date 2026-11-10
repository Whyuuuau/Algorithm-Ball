import { ProjectConfig } from "@asmr/schema";
import { SimCore } from "@asmr/sim-core";

export interface ScoutedSeedResult {
  seed: number;
  climaxScore: number;
  winnerLaneId: string | null;
  totalHits: number;
  finishTimeSec: number;
  scoreBreakdown: {
    closeness: number;
    leadChanges: number;
    finalDensity: number;
    noStalemate: number;
    noteVariety: number;
  };
}

export class SeedScout {
  public static async evaluateSeed(
    baseConfig: ProjectConfig,
    seed: number
  ): Promise<ScoutedSeedResult> {
    const config: ProjectConfig = {
      ...baseConfig,
      seed
    };

    const sim = new SimCore(config);
    await sim.init();

    const totalFrames = Math.round(config.meta.duration_sec * config.meta.fps);
    const uniqueNotes = new Set<number>();
    let lastLeadLane: string | null = null;
    let leadChanges = 0;
    let lastQuarterHits = 0;

    for (let f = 0; f < totalFrames; f++) {
      const snap = sim.step();

      // Track lead changes
      if (snap.floors.length > 0) {
        let maxFloor = 0;
        let leadLane: string | null = null;
        for (const floor of snap.floors) {
          if (floor.broken && floor.floorIndex > maxFloor) {
            maxFloor = floor.floorIndex;
            leadLane = floor.laneId;
          }
        }
        if (leadLane && leadLane !== lastLeadLane) {
          leadChanges++;
          lastLeadLane = leadLane;
        }
      }

      if (snap.winnerLaneId) {
        // Winner reached
        break;
      }
    }

    const hitLog = sim.getHitLog();
    for (const h of hitLog) {
      uniqueNotes.add(h.note);
      if (h.t >= config.meta.duration_sec * 0.75) {
        lastQuarterHits++;
      }
    }

    // Climax metrics
    const closeness = Math.min(1.0, leadChanges / 4);
    const leadChangesNorm = Math.min(1.0, leadChanges / 3);
    const finalDensity = hitLog.length > 0 ? Math.min(1.0, (lastQuarterHits / hitLog.length) * 2) : 0.5;
    const noStalemate = hitLog.length > 50 ? 1.0 : 0.5;
    const noteVariety = Math.min(1.0, uniqueNotes.size / 15);

    const score =
      0.3 * closeness +
      0.25 * leadChangesNorm +
      0.2 * finalDensity +
      0.15 * noStalemate +
      0.1 * noteVariety;

    return {
      seed,
      climaxScore: Math.round(score * 100) / 100,
      winnerLaneId: lastLeadLane,
      totalHits: hitLog.length,
      finishTimeSec: config.meta.duration_sec,
      scoreBreakdown: {
        closeness,
        leadChanges: leadChangesNorm,
        finalDensity,
        noStalemate,
        noteVariety
      }
    };
  }

  public static async scoutTopSeeds(
    baseConfig: ProjectConfig,
    count: number = 8,
    onProgress?: (progressPercent: number) => void
  ): Promise<ScoutedSeedResult[]> {
    const results: ScoutedSeedResult[] = [];
    const baseSeed = baseConfig.seed || 20261110;

    for (let i = 0; i < count; i++) {
      const seedCandidate = baseSeed + i * 17 + 1;
      const res = await this.evaluateSeed(baseConfig, seedCandidate);
      results.push(res);

      if (onProgress) {
        onProgress(Math.round(((i + 1) / count) * 100));
      }
      await new Promise((r) => setTimeout(r, 0));
    }

    results.sort((a, b) => b.climaxScore - a.climaxScore);
    return results;
  }
}
