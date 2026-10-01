import { ALL_REGIONS, muscleInfo } from '../domain/regions';
import type { LogData, MuscleId, RegionId, Settings, WorkoutSet } from '../domain/types';
import { HOUR, setRegionDoses } from './hardSets';

// Growth-window model: a session that hits a region opens a window of muscle
// growth (36–48 h, longer for bigger doses). Outside a window the region is
// drifting toward atrophy. Frequency keeps regions inside windows.

export interface GrowthWindow {
  start: number;
  end: number;
  dose: number;
  workoutId: string;
}

export function windowHours(dose: number, s: Settings): number {
  if (dose < s.windowMinDose) return 0;
  const span = Math.max(s.windowFullDose - s.windowMinDose, 0.0001);
  const t = Math.min(Math.max((dose - s.windowMinDose) / span, 0), 1);
  return s.windowMinHours + (s.windowMaxHours - s.windowMinHours) * t;
}

/** Windows per region, sorted by start. One window per region per session. */
export function buildRegionWindows(data: LogData, s: Settings): Record<RegionId, GrowthWindow[]> {
  const byWorkout = new Map<string, WorkoutSet[]>();
  for (const set of data.sets) {
    const list = byWorkout.get(set.workoutId) ?? [];
    list.push(set);
    byWorkout.set(set.workoutId, list);
  }

  const out = Object.fromEntries(ALL_REGIONS.map((r) => [r, [] as GrowthWindow[]])) as Record<RegionId, GrowthWindow[]>;
  for (const [workoutId, sets] of byWorkout) {
    const dose: Partial<Record<RegionId, number>> = {};
    const last: Partial<Record<RegionId, number>> = {};
    for (const set of sets) {
      for (const [r, d] of Object.entries(setRegionDoses(set, s)) as [RegionId, number][]) {
        dose[r] = (dose[r] ?? 0) + d;
        last[r] = Math.max(last[r] ?? 0, set.completedAt);
      }
    }
    for (const r of Object.keys(dose) as RegionId[]) {
      const hours = windowHours(dose[r]!, s);
      if (hours > 0) {
        out[r].push({ start: last[r]!, end: last[r]! + hours * HOUR, dose: dose[r]!, workoutId });
      }
    }
  }
  for (const r of ALL_REGIONS) out[r].sort((a, b) => a.start - b.start);
  return out;
}

/** Merge overlapping windows into continuous growth spans. */
export function mergeWindows(windows: GrowthWindow[]): { start: number; end: number }[] {
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  for (const w of sorted) {
    const prev = out[out.length - 1];
    if (prev && w.start <= prev.end) prev.end = Math.max(prev.end, w.end);
    else out.push({ start: w.start, end: w.end });
  }
  return out;
}

/** Fraction of [from, to] spent inside a growth window. */
export function coverage(windows: GrowthWindow[], from: number, to: number): number {
  if (to <= from) return 0;
  let covered = 0;
  for (const span of mergeWindows(windows)) {
    const a = Math.max(span.start, from);
    const b = Math.min(span.end, to);
    if (b > a) covered += b - a;
  }
  return covered / (to - from);
}

export type WindowStatus =
  | { state: 'growing'; endsAt: number; hoursLeft: number; /** 1 = just opened, 0 = closing */ fraction: number }
  | { state: 'idle'; hoursSince: number | null };

export function windowStatus(windows: GrowthWindow[], now: number): WindowStatus {
  let best: GrowthWindow | null = null;
  let lastEnd: number | null = null;
  for (const w of windows) {
    if (w.start <= now && w.end > now && (!best || w.end > best.end)) best = w;
    if (w.end <= now) lastEnd = Math.max(lastEnd ?? 0, w.end);
  }
  if (best) {
    return {
      state: 'growing',
      endsAt: best.end,
      hoursLeft: (best.end - now) / HOUR,
      fraction: (best.end - now) / (best.end - best.start),
    };
  }
  return { state: 'idle', hoursSince: lastEnd === null ? null : (now - lastEnd) / HOUR };
}

/** A muscle's windows are the union of its regions' windows. */
export function muscleWindows(regionWindows: Record<RegionId, GrowthWindow[]>, muscle: MuscleId): GrowthWindow[] {
  return muscleInfo(muscle).regions.flatMap((r) => regionWindows[r]);
}
