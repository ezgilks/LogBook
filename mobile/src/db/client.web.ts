import type { LogData, Settings } from '../domain/types';
import type { SyncRepo } from '../sync/protocol';
import type { Repo } from './repo';

// Web preview only: keeps the log in localStorage so the UI can be developed in
// a browser. The iOS app uses SQLite (client.ts).

const KEY = 'logbook:v1';

interface Stored {
  data: LogData;
  settings: Partial<Settings>;
}

function read(): Stored {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {}
  return { data: { workouts: [], sets: [], activities: [] }, settings: {} };
}

function write(fn: (s: Stored) => void): Promise<void> {
  const s = read();
  fn(s);
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {}
  return Promise.resolve();
}

function upsert<T extends { id: string }>(list: T[], item: T) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.push(item);
}

export const repo: Repo = {
  load: () => Promise.resolve(read()),
  putWorkout: (w) => write((s) => upsert(s.data.workouts, w)),
  deleteWorkout: (id) =>
    write((s) => {
      s.data.workouts = s.data.workouts.filter((w) => w.id !== id);
      s.data.sets = s.data.sets.filter((x) => x.workoutId !== id);
    }),
  putSet: (set) => write((s) => upsert(s.data.sets, set)),
  deleteSet: (id) => write((s) => void (s.data.sets = s.data.sets.filter((x) => x.id !== id))),
  putActivity: (a) => write((s) => upsert(s.data.activities, a)),
  deleteActivity: (id) => write((s) => void (s.data.activities = s.data.activities.filter((x) => x.id !== id))),
  saveSettings: (settings) => write((s) => void (s.settings = settings)),
  replaceAll: (data) => write((s) => void (s.data = data)),
};

/** Sync is native-only. */
export const syncRepo: SyncRepo | null = null;
