// Wire format shared with server/internal/sync. Each local row becomes a
// Record; conflicts resolve last-write-wins on updatedAt.

export type RecordKind = 'workout' | 'set' | 'activity' | 'setting';

export interface SyncRecord {
  kind: RecordKind;
  id: string;
  data: unknown;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface SyncRequest {
  cursor: number;
  changes: SyncRecord[];
}

export interface SyncResponse {
  cursor: number;
  changes: SyncRecord[];
  more: boolean;
  applied: number;
}

/** Repo capabilities sync needs. Implemented by the SQLite client. */
export interface SyncRepo {
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  /** Local rows with updatedAt > since, as records. */
  changesSince(since: number): Promise<SyncRecord[]>;
  /** Apply remote records, skipping any that are older than the local row. */
  applyRemote(recs: SyncRecord[]): Promise<number>;
}

export const MAX_BATCH = 500;

/** Last-write-wins: a remote record wins only if strictly newer. */
export function remoteWins(localUpdatedAt: number | undefined, remote: SyncRecord): boolean {
  return localUpdatedAt === undefined || remote.updatedAt > localUpdatedAt;
}
