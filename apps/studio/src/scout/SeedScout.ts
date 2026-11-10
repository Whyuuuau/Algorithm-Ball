import type { ProjectConfig } from "@asmr/schema";
import { SimCore } from "@asmr/sim-core";

export interface ScoutedSeedResult {
  seed: number;
  climaxScore: number;
  winnerLabel: string;
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
  public static evaluateSeedSync(baseConfig: ProjectConfig, seed: number): ScoutedSeedResult {
    const config: ProjectConfig = { ...baseConfig, seed };
    const sim = new SimCore(config, { render: false });
    sim.initSync();

    const totalFrames = sim.totalFrames;
    const fps = config.meta.fps;
    const laneCount = config.scene.type === "TOWER_BREAKER" ? config.scene.lanes.length : 1;

    let leadLane = -1;
    let leadChanges = 0;
    let finishFrame = totalFrames;
    const activeSeconds = new Uint8Array(Math.max(1, Math.ceil(config.meta.duration_sec)));

    for (let f = 0; f < totalFrames; f++) {
      const snap = sim.step();
      if (laneCount > 1 && (f & 7) === 0) {
        let bestL = -1;
        let bestP = 0;
        for (let l = 0; l < laneCount; l++) {
          const p = sim.laneProgress(l);
          if (p > bestP) {
            bestP = p;
            bestL = l;
          }
        }
        if (bestL >= 0 && bestL !== leadLane) {
          if (leadLane >= 0) leadChanges++;
          leadLane = bestL;
        }
      }
      if (snap.winnerLane >= 0 && finishFrame === totalFrames) {
        finishFrame = f;
      }
    }

    const hits = sim.getHitLog();
    const pitchClasses = new Set<number>();
    let lastQuarterHits = 0;
    const qStart = config.meta.duration_sec * 0.75;

    for (const h of hits) {
      const sec = Math.floor(h.t);
      if (sec >= 0 && sec < activeSeconds.length) activeSeconds[sec] = 1;
      pitchClasses.add(((h.index * 3 + h.lane * 5 + Math.round(h.x * 12)) % 16 + 16) % 16);
      if (h.t >= qStart) lastQuarterHits++;
    }

    let activeSecCount = 0;
    for (let i = 0; i < activeSeconds.length; i++) activeSecCount += activeSeconds[i];

    // Closeness: for multi-lane, 1 - gap between #1 and #2 progress; for single-lane, closeness of finish to duration
    let closeness = 0.6;
    if (laneCount > 1) {
      const progs: number[] = [];
      for (let l = 0; l < laneCount; l++) progs.push(sim.laneProgress(l));
      progs.sort((a, b) => b - a);
      closeness = Math.max(0, Math.min(1, 1 - Math.abs((progs[0] ?? 0) - (progs[1] ?? 0))));
    } else {
      closeness = Math.max(0, Math.min(1, finishFrame / Math.max(1, totalFrames)));
    }

    const leadChangesNorm = laneCount > 1 ? Math.min(1, leadChanges / 4) : Math.min(1, hits.length / 400);
    const avgQuarter = Math.max(1, hits.length / 4);
    const finalDensity = Math.max(0, Math.min(1, (lastQuarterHits / avgQuarter) * 0.65));
    const noStalemate = activeSecCount / Math.max(1, activeSeconds.length);
    const noteVariety = Math.min(1, pitchClasses.size / 12);

    const score =
      0.3 * closeness +
      0.25 * leadChangesNorm +
      0.2 * finalDensity +
      0.15 * noStalemate +
      0.1 * noteVariety;

    let winnerLabel = "Draw";
    if (config.scene.type === "TOWER_BREAKER") {
      const w = sim.winner();
      if (w >= 0 && config.scene.lanes[w]) winnerLabel = config.scene.lanes[w].label;
      else if (leadLane >= 0 && config.scene.lanes[leadLane]) winnerLabel = config.scene.lanes[leadLane].label;
    } else {
      winnerLabel = `${Math.round(sim.laneProgress(0) * 100)}%`;
    }

    return {
      seed,
      climaxScore: Math.round(score * 1000) / 1000,
      winnerLabel,
      totalHits: hits.length,
      finishTimeSec: Math.round((finishFrame / fps) * 10) / 10,
      scoreBreakdown: {
        closeness: Math.round(closeness * 100) / 100,
        leadChanges: Math.round(leadChangesNorm * 100) / 100,
        finalDensity: Math.round(finalDensity * 100) / 100,
        noStalemate: Math.round(noStalemate * 100) / 100,
        noteVariety: Math.round(noteVariety * 100) / 100
      }
    };
  }

  public static async scoutTopSeeds(
    baseConfig: ProjectConfig,
    count: number = 16,
    onProgress?: (progressPercent: number) => void
  ): Promise<ScoutedSeedResult[]> {
    const results: ScoutedSeedResult[] = [];
    const baseSeed = baseConfig.seed || 20261110;

    for (let i = 0; i < count; i++) {
      const candidate = (baseSeed + i * 7919) >>> 0;
      results.push(this.evaluateSeedSync(baseConfig, candidate));
      if (onProgress) onProgress(Math.round(((i + 1) / count) * 100));
      await new Promise((r) => setTimeout(r, 0));
    }

    results.sort((a, b) => b.climaxScore - a.climaxScore);
    return results;
  }
}
