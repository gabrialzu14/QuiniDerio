/** All timings are in ms, relative to the trend entering the viewport. */
export const TREND_ENTRANCE_MS = 140;
export const TREND_PAUSE_MS = 90;
export const TREND_SEGMENT_MS = [740, 640, 740] as const;
export type TrendStage = {start: number; duration: number; end: number};
export type TrendTimeline = {stages: [TrendStage, TrendStage, TrendStage]; end: number};

/**
 * The stages never overlap: 1 (blue), X (white), then 2 (red).
 * Skip animation time for an empty result so a 0% segment never stalls the sequence.
 */
export function makeTrendTimeline(percentages: readonly number[]): TrendTimeline {
  let time = TREND_ENTRANCE_MS;
  let activeBefore = false;
  const stages = TREND_SEGMENT_MS.map((duration, index) => {
    if (!Number.isFinite(percentages[index]) || percentages[index] <= 0) {
      return {start: time, duration: 0, end: time};
    }
    if (activeBefore) time += TREND_PAUSE_MS;
    const start = time;
    time += duration;
    activeBefore = true;
    return {start, duration, end: time};
  }) as unknown as [TrendStage, TrendStage, TrendStage];
  return {stages, end: time};
}

/** Gentle cosine ease-in-out, with zero velocity at either end of a segment. */
export function trendStageProgress(elapsed: number, stage: TrendStage): number {
  if (stage.duration === 0) return 1;
  const t = Math.max(0, Math.min(1, (elapsed - stage.start) / stage.duration));
  return (1 - Math.cos(Math.PI * t)) / 2;
}
