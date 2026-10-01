import { getExercise } from '../domain/exercises';
import { muscleOf } from '../domain/regions';
import type { MuscleId, RegionId, Settings, WorkoutSet } from '../domain/types';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** How much one set counts as a hard set based on proximity to failure. */
export function setValue(set: WorkoutSet, settings: Settings): number {
  if (set.kind === 'warmup' || set.reps <= 0) return 0;
  const rir = set.rir ?? settings.defaultRir;
  if (rir <= settings.fullSetMaxRir) return 1;
  if (rir <= settings.halfSetMaxRir) return 0.5;
  return 0;
}

/** Hard-set credit this set gives each region. */
export function setRegionDoses(set: WorkoutSet, settings: Settings): Partial<Record<RegionId, number>> {
  const exercise = getExercise(set.exerciseId);
  const value = setValue(set, settings);
  const out: Partial<Record<RegionId, number>> = {};
  if (!exercise || value === 0) return out;
  for (const [region, weight] of Object.entries(exercise.regions) as [RegionId, number][]) {
    out[region] = weight * value;
  }
  return out;
}

/**
 * Hard-set credit this set gives each muscle. A muscle gets the max of its
 * regions, so a bench set counts as one chest set, not three.
 */
export function setMuscleDoses(set: WorkoutSet, settings: Settings): Partial<Record<MuscleId, number>> {
  const out: Partial<Record<MuscleId, number>> = {};
  for (const [region, dose] of Object.entries(setRegionDoses(set, settings)) as [RegionId, number][]) {
    const m = muscleOf(region);
    out[m] = Math.max(out[m] ?? 0, dose);
  }
  return out;
}

export function sumDoses<K extends string>(
  sets: WorkoutSet[],
  fn: (s: WorkoutSet) => Partial<Record<K, number>>,
): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const s of sets) {
    for (const [k, v] of Object.entries(fn(s)) as [K, number][]) {
      out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
