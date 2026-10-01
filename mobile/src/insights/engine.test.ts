import { describe, expect, it } from 'vitest';
import { generateSampleData } from '../domain/sample';
import { DEFAULT_SETTINGS } from '../domain/settings';
import type { LogData, WorkoutSet } from '../domain/types';
import { DAY, HOUR } from '../metrics/hardSets';
import { makeContext, sessionInsights, todayInsights } from './engine';

const s = DEFAULT_SETTINGS;
const NOW = Date.UTC(2026, 8, 30, 12);

function set(p: Partial<WorkoutSet> & { exerciseId: string; completedAt: number }): WorkoutSet {
  return { id: Math.random().toString(36), workoutId: 'w', position: 0, weightKg: 50, reps: 10, rir: 2, kind: 'working', ...p };
}

function log(sets: WorkoutSet[], activities: LogData['activities'] = []): LogData {
  const ids = [...new Set(sets.map((x) => x.workoutId))];
  return {
    workouts: ids.map((id) => ({ id, startedAt: Math.min(...sets.filter((x) => x.workoutId === id).map((x) => x.completedAt)) - 60_000, endedAt: null, notes: '' })),
    sets,
    activities,
  };
}

describe('today insights', () => {
  it('produces gentle insights for the sample history', () => {
    const insights = todayInsights(makeContext(generateSampleData(NOW), s, NOW));
    expect(insights.length).toBeGreaterThan(0);
    for (const i of insights) {
      expect(i.why.length).toBeGreaterThan(20);
      expect(i.title).not.toMatch(/\b(must|should)\b/i);
    }
  });

  it('flags a window that is about to close', () => {
    const data = log([set({ exerciseId: 'lateral_raise', completedAt: NOW - 30 * HOUR })]);
    const kinds = todayInsights(makeContext(data, s, NOW)).map((i) => i.kind);
    expect(kinds).toContain('window_closing');
  });

  it('does not judge coverage or volume without a week of history', () => {
    const data = log([set({ exerciseId: 'bench_press', completedAt: NOW - 3 * DAY })]);
    const kinds = todayInsights(makeContext(data, s, NOW)).map((i) => i.kind);
    expect(kinds).not.toContain('low_coverage');
    expect(kinds).not.toContain('volume_low');
  });

  it('notes muscles without a recent window but never ones you have never trained', () => {
    const data = log([
      set({ exerciseId: 'standing_calf_raise', workoutId: 'a', completedAt: NOW - 12 * DAY }),
      set({ exerciseId: 'bench_press', workoutId: 'b', completedAt: NOW - 1 * DAY }),
    ]);
    const untrained = todayInsights(makeContext(data, s, NOW)).find((i) => i.kind === 'untrained');
    expect(untrained?.muscles).toEqual(['calves']);
  });

  it('mentions recent hard outside activity, not light ones', () => {
    const hard = log([], [{ id: 'a', type: 'basketball', startedAt: NOW - 20 * HOUR, durationMin: 90, difficulty: 8, notes: '' }]);
    const light = log([], [{ id: 'a', type: 'basketball', startedAt: NOW - 20 * HOUR, durationMin: 30, difficulty: 3, notes: '' }]);
    expect(todayInsights(makeContext(hard, s, NOW)).map((i) => i.kind)).toContain('activity_fatigue');
    expect(todayInsights(makeContext(light, s, NOW)).map((i) => i.kind)).not.toContain('activity_fatigue');
  });

  it('respects muted insight kinds', () => {
    const data = log([set({ exerciseId: 'lateral_raise', completedAt: NOW - 30 * HOUR })]);
    const kinds = todayInsights(makeContext(data, { ...s, mutedInsights: ['window_closing'] }, NOW)).map((i) => i.kind);
    expect(kinds).not.toContain('window_closing');
  });
});

describe('session insights', () => {
  it('flags lots of sets for one muscle in one session', () => {
    const data = log(Array.from({ length: 7 }, (_, i) => set({ exerciseId: 'bench_press', position: i, completedAt: NOW - i * 60_000 })));
    expect(sessionInsights(makeContext(data, s, NOW), 'w').map((i) => i.kind)).toContain('session_cap');
  });

  it('notes a priority muscle trained late', () => {
    const sets = [
      ...Array.from({ length: 6 }, (_, i) => set({ exerciseId: 'back_squat', position: i, completedAt: NOW - (10 - i) * 60_000 })),
      ...Array.from({ length: 2 }, (_, i) => set({ exerciseId: 'lateral_raise', position: 6 + i, completedAt: NOW - (4 - i) * 60_000 })),
    ];
    const kinds = sessionInsights(makeContext(log(sets), { ...s, priorityMuscles: ['shoulders'] }, NOW), 'w').map((i) => i.kind);
    expect(kinds).toContain('priority_order');
  });
});
