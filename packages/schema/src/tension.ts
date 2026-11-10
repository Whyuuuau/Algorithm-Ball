/**
 * Smooth (C1) interpolation of the tension curve. Points are [progress 0..1, tension 0..1],
 * sorted by progress. Uses monotone smoothstep between neighbours so editing a point never
 * overshoots outside 0..1.
 */
export function evaluateTensionCurve(curve: ReadonlyArray<readonly [number, number]>, progress: number): number {
  if (!curve || curve.length === 0) return 0.5;
  const pts = curve.length > 1 && curve.every((p, i) => i === 0 || p[0] >= curve[i - 1][0]) ? curve : [...curve].sort((a, b) => a[0] - b[0]);
  const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  if (p <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (p >= last[0]) return last[1];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (p >= a[0] && p <= b[0]) {
      const span = b[0] - a[0];
      if (span <= 1e-9) return b[1];
      const u = (p - a[0]) / span;
      const s = u * u * (3 - 2 * u);
      return a[1] + (b[1] - a[1]) * s;
    }
  }
  return last[1];
}

