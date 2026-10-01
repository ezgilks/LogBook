import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Every row carries updated_at and deleted_at (tombstone) so the local log can
// later sync to the server with last-write-wins conflict resolution.

const syncColumns = {
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
};

export const workouts = sqliteTable('workouts', {
  id: text('id').primaryKey(),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
  notes: text('notes').notNull().default(''),
  ...syncColumns,
});

export const sets = sqliteTable(
  'sets',
  {
    id: text('id').primaryKey(),
    workoutId: text('workout_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    position: integer('position').notNull(),
    weightKg: real('weight_kg').notNull(),
    reps: integer('reps').notNull(),
    rir: integer('rir'),
    kind: text('kind', { enum: ['warmup', 'working'] }).notNull(),
    completedAt: integer('completed_at').notNull(),
    ...syncColumns,
  },
  (t) => [index('sets_workout_idx').on(t.workoutId), index('sets_exercise_idx').on(t.exerciseId)],
);

export const activities = sqliteTable('activities', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  startedAt: integer('started_at').notNull(),
  durationMin: integer('duration_min').notNull(),
  difficulty: integer('difficulty').notNull(),
  notes: text('notes').notNull().default(''),
  ...syncColumns,
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** Local-only bookkeeping (sync cursor, last push time). Never synced. */
export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
