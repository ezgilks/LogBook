import { getExercise } from '../domain/exercises';
import type { JointAction, LogData, MuscleId, RegionId, Settings, WorkoutSet } from '../domain/types';
import { DAY, setMuscleDoses, setRegionDoses, setValue, sumDoses } from './hardSets';

export function setsInRange(data: LogData, from: number, to: number): WorkoutSet[] {
  return data.sets.filter((s) => s.completedAt >= from && s.completedAt < to);
}

/** Hard sets per muscle over the trailing `days` days. */
export function muscleVolume(data: LogData, s: Settings, now: number, days = 7): Partial<Record<MuscleId, number>> {
  return sumDoses(setsInRange(data, now - days * DAY, now + 1), (set) => setMuscleDoses(set, s));
}

export function regionVolume(data: LogData, s: Settings, now: number, days = 7): Partial<Record<RegionId, number>> {
  return sumDoses(setsInRange(data, now - days * DAY, now + 1), (set) => setRegionDoses(set, s));
}

/** Hard sets per joint action; each set counts fully toward every action it trains. */
export function jointActionVolume(data: LogData, s: Settings, now: number, days = 7): Partial<Record<JointAction, number>> {
  return sumDoses(setsInRange(data, now - days * DAY, now + 1), (set) => {
    const ex = getExercise(set.exerciseId);
    const v = setValue(set, s);
    const out: Partial<Record<JointAction, number>> = {};
    if (ex && v > 0) for (const a of ex.actions) out[a] = v;
    return out;
  });
}

export function sessionMuscleVolume(sets: WorkoutSet[], s: Settings): Partial<Record<MuscleId, number>> {
  return sumDoses(sets, (set) => setMuscleDoses(set, s));
}

export function volumeRange(muscle: MuscleId, s: Settings): { low: number; high: number } {
  const high = s.priorityMuscles.includes(muscle) ? s.prioritySetsHigh : s.weeklySetsHigh;
  return { low: s.weeklySetsLow, high };
}

/** Distinct days in the trailing window on which the muscle got hard sets. */
export function muscleFrequency(data: LogData, s: Settings, muscle: MuscleId, now: number, days = 7): number {
  const sessions = new Set<string>();
  for (const set of setsInRange(data, now - days * DAY, now + 1)) {
    if ((setMuscleDoses(set, s)[muscle] ?? 0) > 0) sessions.add(set.workoutId);
  }
  return sessions.size;
}
