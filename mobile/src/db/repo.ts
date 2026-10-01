import type { Activity, LogData, Settings, Workout, WorkoutSet } from '../domain/types';

/** Persistence boundary. Native uses SQLite (client.ts); web preview uses localStorage (client.web.ts). */
export interface Repo {
  load(): Promise<{ data: LogData; settings: Partial<Settings> }>;
  putWorkout(w: Workout): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
  putSet(s: WorkoutSet): Promise<void>;
  deleteSet(id: string): Promise<void>;
  putActivity(a: Activity): Promise<void>;
  deleteActivity(id: string): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
  /** Replace the whole log (sample data, clear all). */
  replaceAll(data: LogData): Promise<void>;
}
