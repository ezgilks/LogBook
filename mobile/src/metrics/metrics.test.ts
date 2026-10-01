import { describe, expect, it } from 'vitest';
import { generateSampleData } from '../domain/sample';
import { DEFAULT_SETTINGS } from '../domain/settings';
import type { LogData, Settings, WorkoutSet } from '../domain/types';
import { fatigue, fatigueLevel } from './fatigue';
import { DAY, HOUR, setMuscleDoses, setRegionDoses, setValue } from './hardSets';
import { buildRecap } from './recap';
import { detectPRs, e1rm } from './strength';
import { jointActionVolume, muscleFrequency, muscleVolume, volumeRange } from './volume';
import { buildRegionWindows, coverage, mergeWindows, muscleWindows, windowHours, windowStatus } from './windows';

const s: Settings = DEFAULT_SETTINGS;
const T0 = Date.UTC(2026, 8, 1, 17); // a Tuesday afternoon

function set(partial: Partial<WorkoutSet> & { exerciseId: string }): WorkoutSet {
  return {
    id: Math.random().toString(36).slice(2),
    workoutId: 'w1',
    position: 0,
    weightKg: 100,
    reps: 8,
    rir: 2,
    kind: 'working',
    completedAt: T0,
    ...partial,
  };
}

function log(sets: WorkoutSet[]): LogData {
  const ids = [...new Set(sets.map((x) => x.workoutId))];
  return {
    workouts: ids.map((id) => {
      const mine = sets.filter((x) => x.workoutId === id);
      const start = Math.min(...mine.map((x) => x.completedAt)) - 60_000;
      return { id, startedAt: start, endedAt: Math.max(...mine.map((x) => x.completedAt)), notes: '' };
    }),
    sets,
    activities: [],
  };
}

describe('hard sets', () => {
  it('counts sets by proximity to failure', () => {
    expect(setValue(set({ exerciseId: 'bench_press', rir: 0 }), s)).toBe(1);
    expect(setValue(set({ exerciseId: 'bench_press', rir: 3 }), s)).toBe(1);
    expect(setValue(set({ exerciseId: 'bench_press', rir: 4 }), s)).toBe(0.5);
    expect(setValue(set({ exerciseId: 'bench_press', rir: 6 }), s)).toBe(0);
    expect(setValue(set({ exerciseId: 'bench_press', kind: 'warmup', rir: 0 }), s)).toBe(0);
  });

  it('assumes the default RIR when none is logged', () => {
    expect(setValue(set({ exerciseId: 'bench_press', rir: null }), s)).toBe(1);
    expect(setValue(set({ exerciseId: 'bench_press', rir: null }), { ...s, defaultRir: 5 })).toBe(0.5);
  });

  it('credits regions fractionally', () => {
    const doses = setRegionDoses(set({ exerciseId: 'bench_press' }), s);
    expect(doses.chest_mid).toBe(1);
    expect(doses.delt_front).toBe(0.5);
    expect(doses.triceps_long).toBe(0.25);
  });

  it('counts a muscle once per set (max of its regions)', () => {
    const doses = setMuscleDoses(set({ exerciseId: 'bench_press' }), s);
    expect(doses.chest).toBe(1);
    expect(doses.triceps).toBe(0.5);
    expect(doses.shoulders).toBe(0.5);
  });
});

describe('growth windows', () => {
  it('scales from 36h at one set to 48h at the full dose', () => {
    expect(windowHours(0.5, s)).toBe(0);
    expect(windowHours(1, s)).toBe(36);
    expect(windowHours(2.5, s)).toBe(42);
    expect(windowHours(4, s)).toBe(48);
    expect(windowHours(10, s)).toBe(48);
  });

  it('opens one window per region per session, timed from the last set', () => {
    const data = log([
      set({ exerciseId: 'lateral_raise', completedAt: T0 }),
      set({ exerciseId: 'lateral_raise', completedAt: T0 + 3 * 60_000 }),
    ]);
    const w = buildRegionWindows(data, s).delt_side;
    expect(w).toHaveLength(1);
    expect(w[0].dose).toBe(2);
    expect(w[0].start).toBe(T0 + 3 * 60_000);
    expect(w[0].end - w[0].start).toBe(40 * HOUR);
  });

  it('does not open a window for a sub-threshold secondary dose', () => {
    const data = log([set({ exerciseId: 'bench_press' })]);
    expect(buildRegionWindows(data, s).delt_front).toHaveLength(0); // 0.5 < windowMinDose
    expect(buildRegionWindows(data, s).chest_mid).toHaveLength(1);
  });

  it('reports growing vs idle status', () => {
    const data = log([set({ exerciseId: 'lateral_raise' })]);
    const w = buildRegionWindows(data, s).delt_side;
    const growing = windowStatus(w, T0 + 30 * HOUR);
    expect(growing.state).toBe('growing');
    if (growing.state === 'growing') expect(growing.hoursLeft).toBeCloseTo(6);
    const idle = windowStatus(w, T0 + 46 * HOUR);
    expect(idle).toEqual({ state: 'idle', hoursSince: 10 });
    expect(windowStatus([], T0)).toEqual({ state: 'idle', hoursSince: null });
  });

  it('makes 1 set × 3 days beat 3 sets × 1 day', () => {
    const spread = log([0, 2, 4].map((d) => set({ exerciseId: 'lateral_raise', workoutId: `d${d}`, completedAt: T0 + d * DAY })));
    const crammed = log([0, 1, 2].map((i) => set({ exerciseId: 'lateral_raise', completedAt: T0 + i * 60_000 })));
    const from = T0;
    const to = T0 + 7 * DAY;
    const spreadCov = coverage(buildRegionWindows(spread, s).delt_side, from, to);
    const crammedCov = coverage(buildRegionWindows(crammed, s).delt_side, from, to);
    expect(spreadCov).toBeGreaterThan(crammedCov * 2);
  });

  it('merges overlapping windows so coverage is never double counted', () => {
    const merged = mergeWindows([
      { start: 0, end: 10, dose: 1, workoutId: 'a' },
      { start: 5, end: 20, dose: 1, workoutId: 'b' },
      { start: 30, end: 40, dose: 1, workoutId: 'c' },
    ]);
    expect(merged).toEqual([{ start: 0, end: 20 }, { start: 30, end: 40 }]);
    expect(coverage([{ start: 0, end: 10, dose: 1, workoutId: 'a' }, { start: 5, end: 20, dose: 1, workoutId: 'b' }], 0, 40)).toBe(0.5);
  });

  it('unions region windows into muscle windows', () => {
    const data = log([
      set({ exerciseId: 'lateral_raise', workoutId: 'a', completedAt: T0 }),
      set({ exerciseId: 'rear_delt_fly', workoutId: 'b', completedAt: T0 + DAY }),
    ]);
    expect(muscleWindows(buildRegionWindows(data, s), 'shoulders')).toHaveLength(2);
  });
});

describe('volume', () => {
  const data = log([
    set({ exerciseId: 'bench_press', completedAt: T0 }),
    set({ exerciseId: 'bench_press', completedAt: T0 + 60_000 }),
    set({ exerciseId: 'cable_fly', workoutId: 'w2', completedAt: T0 + DAY }),
    set({ exerciseId: 'bench_press', workoutId: 'old', completedAt: T0 - 10 * DAY }),
  ]);

  it('sums trailing 7-day hard sets per muscle', () => {
    const v = muscleVolume(data, s, T0 + 2 * DAY);
    expect(v.chest).toBe(3);
    expect(v.triceps).toBe(1);
  });

  it('counts joint actions', () => {
    const v = jointActionVolume(data, s, T0 + 2 * DAY);
    expect(v.shoulder_horizontal_adduction).toBe(3);
    expect(v.elbow_extension).toBe(2);
  });

  it('counts sessions per muscle', () => {
    expect(muscleFrequency(data, s, 'chest', T0 + 2 * DAY)).toBe(2);
  });

  it('raises the top of the range for priority muscles', () => {
    expect(volumeRange('chest', s)).toEqual({ low: 6, high: 10 });
    expect(volumeRange('chest', { ...s, priorityMuscles: ['chest'] })).toEqual({ low: 6, high: 12 });
  });
});

describe('strength', () => {
  it('estimates 1RM from reps + RIR', () => {
    expect(e1rm(100, 1, 0, 2)).toBe(100);
    expect(e1rm(100, 8, 2, 2)).toBeCloseTo(133.33, 1);
    expect(e1rm(100, 20, 0, 2)).toBeCloseTo(140, 5); // capped at 12 reps possible
  });

  it('detects e1RM and rep PRs, but not first-time baselines', () => {
    const prior = set({ exerciseId: 'bench_press', workoutId: 'a', completedAt: T0, weightKg: 100, reps: 8, rir: 2 });
    const e1rmPr = set({ exerciseId: 'bench_press', workoutId: 'b', completedAt: T0 + 2 * DAY, weightKg: 105, reps: 8, rir: 2 });
    const firstTime = set({ exerciseId: 'ohp', workoutId: 'b', completedAt: T0 + 2 * DAY + 60_000 });
    const prs = detectPRs(log([prior, e1rmPr, firstTime]), 'b', s);
    expect(prs).toHaveLength(1);
    expect(prs[0].kind).toBe('e1rm');

    // Same weight-for-reps, but harder RIR -> lower e1RM, more weight at 5 reps -> rep PR
    const repPr = set({ exerciseId: 'bench_press', workoutId: 'c', completedAt: T0 + 4 * DAY, weightKg: 110, reps: 5, rir: 0 });
    const repPrs = detectPRs(log([prior, repPr]), 'c', s);
    expect(repPrs).toHaveLength(1);
    expect(repPrs[0].kind).toBe('reps');
  });
});

describe('fatigue', () => {
  it('adds activity load and decays it', () => {
    const data: LogData = {
      workouts: [], sets: [],
      activities: [{ id: 'a', type: 'basketball', startedAt: T0, durationMin: 90, difficulty: 8, notes: '' }],
    };
    const soon = fatigue(data, s, T0 + 2 * HOUR);
    const later = fatigue(data, s, T0 + 50 * HOUR);
    expect(soon.regions.quads_vasti).toBeGreaterThan(40);
    expect(later.regions.quads_vasti).toBeLessThan(soon.regions.quads_vasti / 2);
    expect(soon.regions.chest_mid).toBe(0);
    expect(fatigueLevel(soon.regions.quads_vasti)).toBe('heavy');
  });

  it('shooting around adds far less than full court', () => {
    const mk = (min: number, diff: number): LogData => ({
      workouts: [], sets: [], activities: [{ id: 'a', type: 'basketball', startedAt: T0, durationMin: min, difficulty: diff, notes: '' }],
    });
    const full = fatigue(mk(90, 8), s, T0 + 3 * HOUR).systemic;
    const shoot = fatigue(mk(30, 3), s, T0 + 3 * HOUR).systemic;
    expect(full).toBeGreaterThan(shoot * 5);
  });
});

describe('recap', () => {
  it('summarizes a sample workout', () => {
    const now = Date.UTC(2026, 8, 30, 12);
    const data = generateSampleData(now);
    const last = data.workouts[data.workouts.length - 1];
    const recap = buildRecap(data, last.id, s)!;
    expect(recap.exercises.length).toBeGreaterThan(3);
    expect(recap.hardSets).toBeGreaterThan(8);
    expect(Object.keys(recap.windows).length).toBeGreaterThan(2);
    for (const w of Object.values(recap.windows)) {
      expect(w).toBeGreaterThanOrEqual(36);
      expect(w).toBeLessThanOrEqual(48);
    }
    expect(recap.exercises.every((e) => e.previousE1rm !== null)).toBe(true);
  });
});
