import { MAX_BATCH, type SyncRepo, type SyncRequest, type SyncResponse } from './protocol';

export interface SyncResult {
  pushed: number;
  pulled: number;
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * One full sync: push local changes since the last push (in batches), then
 * keep pulling until the server has nothing newer than our cursor.
 */
export async function syncOnce(opts: { repo: SyncRepo; baseUrl: string; token: string; fetch?: Fetch; now?: () => number }): Promise<SyncResult> {
  const { repo, baseUrl, token } = opts;
  const doFetch: Fetch = opts.fetch ?? ((url, init) => fetch(url, init));
  const now = opts.now ?? Date.now;

  const startedAt = now();
  const lastPush = Number((await repo.getMeta('lastPushAt')) ?? 0);
  let cursor = Number((await repo.getMeta('cursor')) ?? 0);
  const pending = await repo.changesSince(lastPush);

  let pushed = 0;
  let pulled = 0;
  let offset = 0;
  let more = true;

  while (offset < pending.length || more) {
    const batch = pending.slice(offset, offset + MAX_BATCH);
    offset += batch.length;
    const body: SyncRequest = { cursor, changes: batch };
    const res = await doFetch(`${baseUrl.replace(/\/$/, '')}/v1/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`sync failed: HTTP ${res.status}`);
    const data = (await res.json()) as SyncResponse;
    pushed += data.applied;
    pulled += await repo.applyRemote(data.changes);
    cursor = data.cursor;
    await repo.setMeta('cursor', String(cursor));
    more = data.more;
  }

  await repo.setMeta('lastPushAt', String(startedAt));
  return { pushed, pulled };
}
