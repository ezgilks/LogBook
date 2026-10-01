import { useMemo } from 'react';
import { MUSCLES, ALL_REGIONS } from '../domain/regions';
import type { MuscleId, RegionId } from '../domain/types';
import { makeContext, type InsightContext } from '../insights/engine';
import { HOUR } from '../metrics/hardSets';
import { muscleWindows, windowStatus, type WindowStatus } from '../metrics/windows';
import { useLog } from '../store/log';
import { colors } from './theme';

/** Memoized insight context (windows etc.) for the current log. */
export function useCtx(): InsightContext {
  const data = useLog((s) => s.data);
  const settings = useLog((s) => s.settings);
  const now = useLog((s) => s.now);
  return useMemo(() => makeContext(data, settings, now), [data, settings, now]);
}

export function regionStatuses(ctx: InsightContext): Record<RegionId, WindowStatus> {
  return Object.fromEntries(ALL_REGIONS.map((r) => [r, windowStatus(ctx.regionWindows[r], ctx.now)])) as Record<RegionId, WindowStatus>;
}

export function muscleStatuses(ctx: InsightContext): Record<MuscleId, WindowStatus> {
  return Object.fromEntries(MUSCLES.map((m) => [m.id, windowStatus(muscleWindows(ctx.regionWindows, m.id), ctx.now)])) as Record<MuscleId, WindowStatus>;
}

function hex(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
}

/** Blend two #rrggbb colors; t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => hex(v + (pb[i] - v) * t)).join('');
}

/** Body-map color: bright green when a window just opened, fading as it closes. */
export function statusFill(st: WindowStatus): string {
  if (st.state === 'growing') return mix(colors.growDim, colors.grow, 0.25 + 0.75 * st.fraction);
  if (st.hoursSince !== null && st.hoursSince < 24) return colors.idleRecent;
  return colors.idle;
}

export function statusText(st: WindowStatus): string {
  if (st.state === 'growing') {
    const h = Math.max(1, Math.round(st.hoursLeft));
    return `Growing · ${h}h left`;
  }
  if (st.hoursSince === null) return 'No window yet';
  return `Window closed ${ago(st.hoursSince * HOUR)}`;
}

export function ago(ms: number): string {
  const h = ms / HOUR;
  if (h < 1) return 'just now';
  if (h < 24) return `${Math.round(h)}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function formatDate(ts: number, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  return new Date(ts).toLocaleDateString(undefined, opts);
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}
