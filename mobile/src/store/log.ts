import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { repo } from '../db/client';
import { generateSampleData } from '../domain/sample';
import { DEFAULT_SETTINGS } from '../domain/settings';
import type { Activity, LogData, Settings, SetKind, Workout, WorkoutSet } from '../domain/types';
import { track } from '../lib/analytics';

// The whole log lives in memory (years of lifting is only tens of thousands of
// rows) and every change is written through to the repo.

interface NewSet {
  exerciseId: string;
  weightKg: number;
  reps: number;
  rir: number | null;
  kind?: SetKind;
}

interface LogState {
  loaded: boolean;
  data: LogData;
  settings: Settings;
  /** Bumped every minute so growth-window countdowns stay live. */
  now: number;
  activeWorkoutId: string | null;
  /** Exercises added to the active workout that have no sets yet. */
  draftExerciseIds: string[];

  addDraftExercise(id: string): void;
  removeDraftExercise(id: string): void;
  load(): Promise<void>;
  tick(): void;
  startWorkout(): string;
  finishWorkout(): string | null;
  discardWorkout(): void;
  addSet(s: NewSet): WorkoutSet | null;
  updateSet(id: string, patch: Partial<Omit<WorkoutSet, 'id' | 'workoutId'>>): void;
  deleteSet(id: string): void;
  deleteWorkout(id: string): void;
  addActivity(a: Omit<Activity, 'id'>): void;
  deleteActivity(id: string): void;
  updateSettings(patch: Partial<Settings>): void;
  loadSample(): void;
  clearAll(): void;
}

const EMPTY: LogData = { workouts: [], sets: [], activities: [] };

function persist(p: Promise<unknown>) {
  p.catch((e) => console.warn('[logbook] persist failed', e));
}

export const useLog = create<LogState>((set, get) => ({
  loaded: false,
  data: EMPTY,
  settings: DEFAULT_SETTINGS,
  now: Date.now(),
  activeWorkoutId: null,
  draftExerciseIds: [],

  addDraftExercise: (id) => set((s) => ({ draftExerciseIds: s.draftExerciseIds.includes(id) ? s.draftExerciseIds : [...s.draftExerciseIds, id] })),
  removeDraftExercise: (id) => set((s) => ({ draftExerciseIds: s.draftExerciseIds.filter((x) => x !== id) })),

  async load() {
    const { data, settings } = await repo.load();
    const active = data.workouts.filter((w) => w.endedAt === null).sort((a, b) => b.startedAt - a.startedAt)[0];
    set({ loaded: true, data, settings: { ...DEFAULT_SETTINGS, ...settings }, activeWorkoutId: active?.id ?? null, now: Date.now() });
  },

  tick: () => set({ now: Date.now() }),

  startWorkout() {
    const existing = get().activeWorkoutId;
    if (existing) return existing;
    const w: Workout = { id: randomUUID(), startedAt: Date.now(), endedAt: null, notes: '' };
    set((s) => ({ activeWorkoutId: w.id, data: { ...s.data, workouts: [...s.data.workouts, w] } }));
    persist(repo.putWorkout(w));
    track('workout_started');
    return w.id;
  },

  finishWorkout() {
    const { activeWorkoutId: id, data } = get();
    if (!id) return null;
    const sets = data.sets.filter((x) => x.workoutId === id);
    if (sets.length === 0) {
      get().discardWorkout();
      return null;
    }
    const endedAt = Math.max(Date.now(), ...sets.map((x) => x.completedAt));
    const workouts = data.workouts.map((w) => (w.id === id ? { ...w, endedAt } : w));
    set({ activeWorkoutId: null, draftExerciseIds: [], now: Date.now(), data: { ...data, workouts } });
    persist(repo.putWorkout(workouts.find((w) => w.id === id)!));
    track('workout_finished', { sets: sets.length });
    return id;
  },

  discardWorkout() {
    const id = get().activeWorkoutId;
    if (!id) return;
    set((s) => ({
      activeWorkoutId: null,
      draftExerciseIds: [],
      data: { ...s.data, workouts: s.data.workouts.filter((w) => w.id !== id), sets: s.data.sets.filter((x) => x.workoutId !== id) },
    }));
    persist(repo.deleteWorkout(id));
  },

  addSet({ exerciseId, weightKg, reps, rir, kind = 'working' }) {
    const workoutId = get().activeWorkoutId;
    if (!workoutId) return null;
    const mine = get().data.sets.filter((x) => x.workoutId === workoutId);
    const position = mine.length ? Math.max(...mine.map((x) => x.position)) + 1 : 0;
    const s: WorkoutSet = { id: randomUUID(), workoutId, exerciseId, position, weightKg, reps, rir, kind, completedAt: Date.now() };
    set((st) => ({ now: Date.now(), data: { ...st.data, sets: [...st.data.sets, s] } }));
    persist(repo.putSet(s));
    return s;
  },

  updateSet(id, patch) {
    let updated: WorkoutSet | undefined;
    set((st) => ({
      data: {
        ...st.data,
        sets: st.data.sets.map((x) => (x.id === id ? (updated = { ...x, ...patch }) : x)),
      },
    }));
    if (updated) persist(repo.putSet(updated));
  },

  deleteSet(id) {
    set((st) => ({ data: { ...st.data, sets: st.data.sets.filter((x) => x.id !== id) } }));
    persist(repo.deleteSet(id));
  },

  deleteWorkout(id) {
    set((st) => ({
      activeWorkoutId: st.activeWorkoutId === id ? null : st.activeWorkoutId,
      data: { ...st.data, workouts: st.data.workouts.filter((w) => w.id !== id), sets: st.data.sets.filter((x) => x.workoutId !== id) },
    }));
    persist(repo.deleteWorkout(id));
  },

  addActivity(a) {
    const activity: Activity = { ...a, id: randomUUID() };
    set((st) => ({ now: Date.now(), data: { ...st.data, activities: [...st.data.activities, activity] } }));
    persist(repo.putActivity(activity));
    track('activity_logged', { type: a.type });
  },

  deleteActivity(id) {
    set((st) => ({ data: { ...st.data, activities: st.data.activities.filter((x) => x.id !== id) } }));
    persist(repo.deleteActivity(id));
  },

  updateSettings(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    persist(repo.saveSettings(settings));
  },

  loadSample() {
    const data = generateSampleData(Date.now());
    set({ data, activeWorkoutId: null, now: Date.now() });
    persist(repo.replaceAll(data));
    track('sample_data_loaded');
  },

  clearAll() {
    set({ data: EMPTY, activeWorkoutId: null });
    persist(repo.replaceAll(EMPTY));
  },
}));
