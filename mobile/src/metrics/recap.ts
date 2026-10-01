import { muscleOf } from '../domain/regions';
import type { LogData, MuscleId, RegionId, Settings, Workout, WorkoutSet } from '../domain/types';
import { setRegionDoses, setValue } from './hardSets';
import { detectPRs, setE1rm, type PR } from './strength';
import { muscleVolume, sessionMuscleVolume, volumeRange } from './volume';
import { windowHours } from './windows';

export interface ExerciseRecap {
  exerciseId: string;
  sets: WorkoutSet[];
  bestE1rm: number;
  /** Best e1RM the last time this exercise was done, if ever. */
  previousE1rm: number | null;
}

export interface Recap {
  workout: Workout;
  durationMin: number;
  hardSets: number;
  muscleSets: Partial<Record<MuscleId, number>>;
  /** Longest growth window opened per muscle, in hours. */
  windows: Partial<Record<MuscleId, number>>;
  /** Growth window opened per region, in hours. */
  regionWindows: Partial<Record<RegionId, number>>;
  exercises: ExerciseRecap[];
  prs: PR[];
  weekly: { muscle: MuscleId; sets: number; low: number; high: number }[];
}

export function buildRecap(data: LogData, workoutId: string, s: Settings): Recap | null {
  const workout = data.workouts.find((w) => w.id === workoutId);
  if (!workout) return null;
  const sets = data.sets.filter((x) => x.workoutId === workoutId).sort((a, b) => a.position - b.position);
  const end = workout.endedAt ?? Math.max(workout.startedAt, ...sets.map((x) => x.completedAt));

  const regionDose: Partial<Record<RegionId, number>> = {};
  for (const set of sets) {
    for (const [r, d] of Object.entries(setRegionDoses(set, s)) as [RegionId, number][]) {
      regionDose[r] = (regionDose[r] ?? 0) + d;
    }
  }
  const windows: Partial<Record<MuscleId, number>> = {};
  const regionWindows: Partial<Record<RegionId, number>> = {};
  for (const [r, d] of Object.entries(regionDose) as [RegionId, number][]) {
    const h = windowHours(d, s);
    const m = muscleOf(r);
    if (h > 0) {
      windows[m] = Math.max(windows[m] ?? 0, h);
      regionWindows[r] = h;
    }
  }

  const order: string[] = [];
  for (const set of sets) if (!order.includes(set.exerciseId)) order.push(set.exerciseId);
  const exercises = order.map((exerciseId): ExerciseRecap => {
    const mine = sets.filter((x) => x.exerciseId === exerciseId);
    const bestE1rm = Math.max(0, ...mine.map((x) => setE1rm(x, s)));
    const prevSets = data.sets.filter((x) => x.exerciseId === exerciseId && x.completedAt < workout.startedAt);
    let previousE1rm: number | null = null;
    if (prevSets.length) {
      const lastWorkout = prevSets.reduce((a, b) => (b.completedAt > a.completedAt ? b : a)).workoutId;
      previousE1rm = Math.max(0, ...prevSets.filter((x) => x.workoutId === lastWorkout).map((x) => setE1rm(x, s)));
    }
    return { exerciseId, sets: mine, bestE1rm, previousE1rm };
  });

  const muscleSets = sessionMuscleVolume(sets, s);
  const week = muscleVolume(data, s, end);
  const weekly = (Object.keys(muscleSets) as MuscleId[]).map((m) => ({ muscle: m, sets: week[m] ?? 0, ...volumeRange(m, s) }));

  return {
    workout,
    durationMin: Math.max(1, Math.round((end - workout.startedAt) / 60_000)),
    hardSets: sets.reduce((acc, x) => acc + setValue(x, s), 0),
    muscleSets,
    windows,
    regionWindows,
    exercises,
    prs: detectPRs(data, workoutId, s),
    weekly,
  };
}
