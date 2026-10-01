import { describe, expect, it } from 'vitest';
import { syncOnce } from './client';
import { remoteWins, type SyncRecord, type SyncRepo, type SyncRequest, type SyncResponse } from './protocol';

/** In-memory repo + fake server implementing the same LWW rules as the Go service. */
function setup() {
  const server = { seq: 0, rows: new Map<string, SyncRecord & { seq: number }>() };
  const fetch = async (_url: string, init: { body: string }) => {
    const req = JSON.parse(init.body) as SyncRequest;
    let applied = 0;
    for (const r of req.changes) {
      const key = `${r.kind}/${r.id}`;
      const cur = server.rows.get(key);
      if (!cur || r.updatedAt > cur.updatedAt) {
        server.rows.set(key, { ...r, seq: ++server.seq });
        applied++;
      }
    }
    const changes = [...server.rows.values()].filter((r) => r.seq > req.cursor).sort((a, b) => a.seq - b.seq);
    const page = changes.slice(0, 500);
    const resp: SyncResponse = { cursor: page.length ? page[page.length - 1].seq : req.cursor, changes: page, more: changes.length > 500, applied };
    return { ok: true, status: 200, json: async () => resp };
  };

  function device() {
    const meta = new Map<string, string>();
    const rows = new Map<string, SyncRecord>();
    const repo: SyncRepo = {
      getMeta: async (k) => meta.get(k) ?? null,
      setMeta: async (k, v) => void meta.set(k, v),
      changesSince: async (since) => [...rows.values()].filter((r) => r.updatedAt > since),
      applyRemote: async (recs) => {
        let n = 0;
        for (const r of recs) {
          const key = `${r.kind}/${r.id}`;
          if (remoteWins(rows.get(key)?.updatedAt, r)) {
            rows.set(key, r);
            n++;
          }
        }
        return n;
      },
    };
    return { repo, rows, meta };
  }
  return { server, fetch, device };
}

describe('syncOnce', () => {
  it('replicates between two devices with last-write-wins', async () => {
    const { fetch, device } = setup();
    const a = device();
    const b = device();
    let clock = 1000;
    const now = () => clock;

    a.rows.set('set/s1', { kind: 'set', id: 's1', data: { reps: 8 }, updatedAt: 900 });
    expect(await syncOnce({ repo: a.repo, baseUrl: 'http://x', token: 't', fetch, now })).toEqual({ pushed: 1, pulled: 0 }); // own echo isn't re-applied

    await syncOnce({ repo: b.repo, baseUrl: 'http://x', token: 't', fetch, now });
    expect(b.rows.get('set/s1')?.data).toEqual({ reps: 8 });

    // Both edit offline; B's edit is newer and wins everywhere.
    clock = 2000;
    a.rows.set('set/s1', { kind: 'set', id: 's1', data: { reps: 9 }, updatedAt: 1500 });
    b.rows.set('set/s1', { kind: 'set', id: 's1', data: { reps: 10 }, updatedAt: 1600 });
    await syncOnce({ repo: a.repo, baseUrl: 'http://x', token: 't', fetch, now });
    await syncOnce({ repo: b.repo, baseUrl: 'http://x', token: 't', fetch, now });
    await syncOnce({ repo: a.repo, baseUrl: 'http://x', token: 't', fetch, now });
    expect(a.rows.get('set/s1')?.data).toEqual({ reps: 10 });
    expect(b.rows.get('set/s1')?.data).toEqual({ reps: 10 });
  });

  it('pushes large backlogs in batches and pages through pulls', async () => {
    const { fetch, device, server } = setup();
    const a = device();
    for (let i = 0; i < 1200; i++) a.rows.set(`set/${i}`, { kind: 'set', id: String(i), data: {}, updatedAt: 10 });
    const res = await syncOnce({ repo: a.repo, baseUrl: 'http://x', token: 't', fetch, now: () => 100 });
    expect(res.pushed).toBe(1200);
    expect(server.rows.size).toBe(1200);

    const b = device();
    await syncOnce({ repo: b.repo, baseUrl: 'http://x', token: 't', fetch, now: () => 100 });
    expect(b.rows.size).toBe(1200);
  });

  it('throws on HTTP errors without advancing lastPushAt', async () => {
    const { device } = setup();
    const a = device();
    a.rows.set('set/s1', { kind: 'set', id: 's1', data: {}, updatedAt: 5 });
    const failing = async () => ({ ok: false, status: 500, json: async () => ({}) });
    await expect(syncOnce({ repo: a.repo, baseUrl: 'http://x', token: 't', fetch: failing })).rejects.toThrow('HTTP 500');
    expect(a.meta.get('lastPushAt')).toBeUndefined();
  });
});
