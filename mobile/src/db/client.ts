import { and, eq, gt, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync } from 'expo-sqlite';
import migrations from '../../drizzle/migrations';
import type { Activity, LogData, Settings, Workout, WorkoutSet } from '../domain/types';
import type { SyncRecord, SyncRepo } from '../sync/protocol';
import type { Repo } from './repo';
import * as t from './schema';

const expoDb = openDatabaseSync('logbook.db');
const db = drizzle(expoDb, { schema: t });
let ready: Promise<void> | null = null;

function init(): Promise<void> {
  ready ??= migrate(db, migrations);
  return ready;
}

const now = () => Date.now();

export const repo: Repo = {
  async load() {
    await init();
    const [w, s, a, kv] = await Promise.all([
      db.select().from(t.workouts).where(isNull(t.workouts.deletedAt)),
      db.select().from(t.sets).where(isNull(t.sets.deletedAt)),
      db.select().from(t.activities).where(isNull(t.activities.deletedAt)),
      db.select().from(t.settings),
    ]);
    const data: LogData = {
      workouts: w.map(({ id, startedAt, endedAt, notes }) => ({ id, startedAt, endedAt, notes })),
      sets: s.map(({ updatedAt, deletedAt, ...rest }) => rest),
      activities: a.map(({ updatedAt, deletedAt, ...rest }) => rest),
    };
    const settings = Object.fromEntries(kv.map((r) => [r.key, JSON.parse(r.value)])) as Partial<Settings>;
    return { data, settings };
  },

  async putWorkout(w: Workout) {
    await init();
    const row = { ...w, updatedAt: now(), deletedAt: null };
    await db.insert(t.workouts).values(row).onConflictDoUpdate({ target: t.workouts.id, set: row });
  },

  async deleteWorkout(id: string) {
    await init();
    const ts = now();
    await db.update(t.workouts).set({ deletedAt: ts, updatedAt: ts }).where(eq(t.workouts.id, id));
    await db.update(t.sets).set({ deletedAt: ts, updatedAt: ts }).where(and(eq(t.sets.workoutId, id), isNull(t.sets.deletedAt)));
  },

  async putSet(s: WorkoutSet) {
    await init();
    const row = { ...s, updatedAt: now(), deletedAt: null };
    await db.insert(t.sets).values(row).onConflictDoUpdate({ target: t.sets.id, set: row });
  },

  async deleteSet(id: string) {
    await init();
    const ts = now();
    await db.update(t.sets).set({ deletedAt: ts, updatedAt: ts }).where(eq(t.sets.id, id));
  },

  async putActivity(a: Activity) {
    await init();
    const row = { ...a, updatedAt: now(), deletedAt: null };
    await db.insert(t.activities).values(row).onConflictDoUpdate({ target: t.activities.id, set: row });
  },

  async deleteActivity(id: string) {
    await init();
    const ts = now();
    await db.update(t.activities).set({ deletedAt: ts, updatedAt: ts }).where(eq(t.activities.id, id));
  },

  async saveSettings(s: Settings) {
    await init();
    const ts = now();
    for (const [key, value] of Object.entries(s)) {
      const row = { key, value: JSON.stringify(value), updatedAt: ts };
      await db.insert(t.settings).values(row).onConflictDoUpdate({ target: t.settings.key, set: row });
    }
  },

  async replaceAll(data: LogData) {
    await init();
    const ts = now();
    await db.transaction(async (tx) => {
      await tx.update(t.workouts).set({ deletedAt: ts, updatedAt: ts }).where(isNull(t.workouts.deletedAt));
      await tx.update(t.sets).set({ deletedAt: ts, updatedAt: ts }).where(isNull(t.sets.deletedAt));
      await tx.update(t.activities).set({ deletedAt: ts, updatedAt: ts }).where(isNull(t.activities.deletedAt));
      const meta = { updatedAt: ts, deletedAt: null };
      for (const w of data.workouts) {
        const row = { ...w, ...meta };
        await tx.insert(t.workouts).values(row).onConflictDoUpdate({ target: t.workouts.id, set: row });
      }
      for (const s of data.sets) {
        const row = { ...s, ...meta };
        await tx.insert(t.sets).values(row).onConflictDoUpdate({ target: t.sets.id, set: row });
      }
      for (const a of data.activities) {
        const row = { ...a, ...meta };
        await tx.insert(t.activities).values(row).onConflictDoUpdate({ target: t.activities.id, set: row });
      }
    });
  },
};

// ---- Sync support (see src/sync) ----

function strip<T extends { updatedAt: number; deletedAt?: number | null }>(row: T) {
  const { updatedAt, deletedAt, ...data } = row;
  return { data, updatedAt, deletedAt: deletedAt ?? null };
}

export const syncRepo: SyncRepo = {
  async getMeta(key) {
    await init();
    const [row] = await db.select().from(t.meta).where(eq(t.meta.key, key));
    return row?.value ?? null;
  },

  async setMeta(key, value) {
    await init();
    await db.insert(t.meta).values({ key, value }).onConflictDoUpdate({ target: t.meta.key, set: { value } });
  },

  async changesSince(since) {
    await init();
    const [w, s, a, kv] = await Promise.all([
      db.select().from(t.workouts).where(gt(t.workouts.updatedAt, since)),
      db.select().from(t.sets).where(gt(t.sets.updatedAt, since)),
      db.select().from(t.activities).where(gt(t.activities.updatedAt, since)),
      db.select().from(t.settings).where(gt(t.settings.updatedAt, since)),
    ]);
    return [
      ...w.map((r): SyncRecord => ({ kind: 'workout', id: r.id, ...strip(r) })),
      ...s.map((r): SyncRecord => ({ kind: 'set', id: r.id, ...strip(r) })),
      ...a.map((r): SyncRecord => ({ kind: 'activity', id: r.id, ...strip(r) })),
      ...kv.map((r): SyncRecord => ({ kind: 'setting', id: r.key, data: JSON.parse(r.value), updatedAt: r.updatedAt })),
    ];
  },

  async applyRemote(recs) {
    await init();
    let applied = 0;
    await db.transaction(async (tx) => {
      for (const r of recs) {
        const meta = { updatedAt: r.updatedAt, deletedAt: r.deletedAt ?? null };
        if (r.kind === 'setting') {
          const [cur] = await tx.select().from(t.settings).where(eq(t.settings.key, r.id));
          if (cur && cur.updatedAt >= r.updatedAt) continue;
          const row = { key: r.id, value: JSON.stringify(r.data), updatedAt: r.updatedAt };
          await tx.insert(t.settings).values(row).onConflictDoUpdate({ target: t.settings.key, set: row });
        } else {
          const table = r.kind === 'workout' ? t.workouts : r.kind === 'set' ? t.sets : t.activities;
          const [cur] = await tx.select({ updatedAt: table.updatedAt }).from(table).where(eq(table.id, r.id));
          if (cur && cur.updatedAt >= r.updatedAt) continue;
          const row = { ...(r.data as object), id: r.id, ...meta };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await tx.insert(table).values(row as any).onConflictDoUpdate({ target: table.id, set: row as any });
        }
        applied++;
      }
    });
    return applied;
  },
};
