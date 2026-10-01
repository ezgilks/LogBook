import type { LogData, Settings, WorkoutSet } from '../domain/types';

/**
 * Estimated 1RM (Epley) using reps + RIR as reps possible. Accuracy drops past
 * ~12 reps possible, so the estimate is capped there.
 */
export function e1rm(weightKg: number, reps: number, rir: number | null, defaultRir: number): number {
  const possible = Math.min(reps + (rir ?? defaultRir), 12);
  if (weightKg <= 0 || reps <= 0) return 0;
  if (possible <= 1) return weightKg;
  return weightKg * (1 + possible / 30);
}

export function setE1rm(set: WorkoutSet, s: Settings): number {
  return set.kind === 'warmup' ? 0 : e1rm(set.weightKg, set.reps, set.rir, s.defaultRir);
}

export interface E1rmPoint {
  workoutId: string;
  at: number;
  e1rm: number;
  best: WorkoutSet;
}

/** Best e1RM per workout for an exercise, oldest first. */
export function e1rmHistory(data: LogData, exerciseId: string, s: Settings): E1rmPoint[] {
  const byWorkout = new Map<string, E1rmPoint>();
  for (const set of data.sets) {
    if (set.exerciseId !== exerciseId || set.kind === 'warmup') continue;
    const v = setE1rm(set, s);
    const prev = byWorkout.get(set.workoutId);
    if (!prev || v > prev.e1rm) byWorkout.set(set.workoutId, { workoutId: set.workoutId, at: set.completedAt, e1rm: v, best: set });
  }
  return [...byWorkout.values()].sort((a, b) => a.at - b.at);
}

export interface PR {
  exerciseId: string;
  kind: 'e1rm' | 'reps';
  set: WorkoutSet;
  /** e1RM in kg for 'e1rm'; weight in kg for 'reps'. */
  value: number;
  previous: number;
}

/** PRs set in a workout versus everything logged before it. */
export function detectPRs(data: LogData, workoutId: string, s: Settings): PR[] {
  const workout = data.workouts.find((w) => w.id === workoutId);
  if (!workout) return [];
  const mine = data.sets.filter((x) => x.workoutId === workoutId && x.kind === 'working');
  const before = data.sets.filter((x) => x.kind === 'working' && x.completedAt < workout.startedAt);
  const out: PR[] = [];

  for (const exerciseId of new Set(mine.map((x) => x.exerciseId))) {
    const prior = before.filter((x) => x.exerciseId === exerciseId);
    if (prior.length === 0) continue; // first time isn't a PR, it's a baseline
    const current = mine.filter((x) => x.exerciseId === exerciseId);

    const bestNow = current.reduce((a, b) => (setE1rm(b, s) > setE1rm(a, s) ? b : a));
    const priorBest = Math.max(...prior.map((x) => setE1rm(x, s)));
    if (setE1rm(bestNow, s) > priorBest + 0.01) {
      out.push({ exerciseId, kind: 'e1rm', set: bestNow, value: setE1rm(bestNow, s), previous: priorBest });
      continue;
    }

    // Rep PR: more weight than ever for at least this many reps.
    for (const set of [...current].sort((a, b) => b.weightKg - a.weightKg)) {
      const priorAtReps = prior.filter((x) => x.reps >= set.reps).map((x) => x.weightKg);
      const prev = priorAtReps.length ? Math.max(...priorAtReps) : 0;
      if (prev > 0 && set.weightKg > prev + 0.01) {
        out.push({ exerciseId, kind: 'reps', set, value: set.weightKg, previous: prev });
        break;
      }
    }
  }
  return out;
}
