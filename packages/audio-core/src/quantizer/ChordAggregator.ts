import { AudioEvent } from "@asmr/sim-core";

export class ChordAggregator {
  public readonly windowMs: number;
  public readonly minHits: number;

  constructor(windowMs: number = 30, minHits: number = 6) {
    this.windowMs = windowMs;
    this.minHits = minHits;
  }

  /**
   * Process an ordered list of AudioEvents and aggregate density bursts into clean chords
   */
  public aggregate(events: AudioEvent[]): AudioEvent[] {
    if (events.length <= 1) return events;

    const windowSec = this.windowMs / 1000;
    const result: AudioEvent[] = [];
    let i = 0;

    while (i < events.length) {
      const windowStart = events[i].t;
      let j = i;
      let totalVel = 0;

      while (j < events.length && events[j].t - windowStart <= windowSec) {
        totalVel += events[j].vel;
        j++;
      }

      const clusterSize = j - i;

      if (clusterSize >= this.minHits) {
        // High density! Convert cluster to an arpeggiated triad chord
        const first = events[i];
        const combinedVel = Math.min(1.0, Math.pow(totalVel, 0.6) / 2.5);

        // Triad notes: Root, Major 3rd (+4), Perfect 5th (+7)
        const root = first.note;
        result.push({
          ...first,
          vel: combinedVel,
          note: root
        });
        result.push({
          ...first,
          t: first.t + 0.008,
          vel: combinedVel * 0.85,
          note: root + 4
        });
        result.push({
          ...first,
          t: first.t + 0.016,
          vel: combinedVel * 0.7,
          note: root + 7
        });

        i = j; // Advance past the cluster
      } else {
        result.push(events[i]);
        i++;
      }
    }

    return result;
  }
}
