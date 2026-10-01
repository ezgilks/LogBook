import { fromDisplayWeight } from './settings';
import type { Activity, LogData, Workout, WorkoutSet } from './types';

// Deterministic sample history: 6 weeks of an upper/lower split with slow
// progression, plus pickup basketball. Used for onboarding and tests.

const DAY = 86_400_000;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

type Plan = [exerciseId: string, startLb: number, reps: number, sets: number, stepLb: number][];

const UPPER_A: Plan = [
  ['bench_press', 185, 8, 3, 5], ['cable_row', 140, 10, 3, 5], ['incline_db_press', 60, 10, 2, 2.5],
  ['lat_pulldown', 150, 10, 2, 5], ['lateral_raise', 20, 15, 3, 0], ['overhead_triceps_extension', 50, 12, 2, 2.5],
];
const LOWER_A: Plan = [
  ['back_squat', 245, 6, 3, 5], ['rdl', 205, 8, 3, 5], ['leg_extension', 120, 12, 2, 5],
  ['seated_leg_curl', 110, 12, 2, 5], ['standing_calf_raise', 180, 12, 3, 5],
];
const UPPER_B: Plan = [
  ['ohp', 115, 6, 3, 2.5], ['pull_up', 0, 8, 3, 0], ['db_bench', 70, 10, 2, 2.5],
  ['chest_supported_row', 90, 10, 3, 5], ['incline_db_curl', 30, 12, 3, 0], ['triceps_pushdown', 60, 12, 2, 2.5],
];
const LOWER_B: Plan = [
  ['hack_squat', 230, 10, 3, 10], ['hip_thrust', 225, 10, 3, 10], ['bulgarian_split_squat', 40, 10, 2, 5],
  ['lying_leg_curl', 90, 12, 2, 5], ['cable_crunch', 100, 12, 3, 5],
];

// Day-of-week offsets from Monday: Upper A Mon, Lower A Tue, Upper B Thu, Lower B Sat.
const SCHEDULE: [number, Plan][] = [[0, UPPER_A], [1, LOWER_A], [3, UPPER_B], [5, LOWER_B]];

export function generateSampleData(now: number, weeks = 6, seed = 7): LogData {
  const rand = rng(seed);
  const workouts: Workout[] = [];
  const sets: WorkoutSet[] = [];
  const activities: Activity[] = [];

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const monday = today.getTime() - ((today.getDay() + 6) % 7) * DAY;
  const start = monday - (weeks - 1) * 7 * DAY;

  let n = 0;
  for (let week = 0; week < weeks; week++) {
    for (const [offset, plan] of SCHEDULE) {
      const begin = start + (week * 7 + offset) * DAY + (17 + Math.floor(rand() * 2)) * 3_600_000;
      if (begin > now - 3_600_000) continue;
      const id = `sample-w${++n}`;
      let t = begin;
      let position = 0;
      for (const [exerciseId, startLb, reps, count, step] of plan) {
        const lb = startLb + step * Math.floor(week / 2);
        for (let i = 0; i < count; i++) {
          t += (2 + rand() * 1.5) * 60_000;
          const fatigueDrop = i === count - 1 && rand() < 0.4 ? 1 : 0;
          sets.push({
            id: `${id}-s${position}`,
            workoutId: id,
            exerciseId,
            position: position++,
            weightKg: fromDisplayWeight(lb, 'lb'),
            reps: reps - fatigueDrop + (week % 2 === 1 && rand() < 0.5 ? 1 : 0),
            rir: Math.max(0, Math.min(4, 2 - i + Math.round(rand() * 2 - 0.5))),
            kind: 'working',
            completedAt: t,
          });
        }
      }
      workouts.push({ id, startedAt: begin, endedAt: t + 60_000, notes: '' });
    }
    // Pickup basketball Wednesday (full court) and Sunday (shooting around).
    const wed = start + (week * 7 + 2) * DAY + 19 * 3_600_000;
    const sun = start + (week * 7 + 6) * DAY + 11 * 3_600_000;
    if (wed < now) activities.push({ id: `sample-a${week}-1`, type: 'basketball', startedAt: wed, durationMin: 90, difficulty: 8, notes: 'Full court' });
    if (sun < now) activities.push({ id: `sample-a${week}-2`, type: 'basketball', startedAt: sun, durationMin: 40, difficulty: 3, notes: 'Shooting around' });
  }
  return { workouts, sets, activities };
}
