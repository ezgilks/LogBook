import { getActivityType } from '../domain/activities';
import { getExercise } from '../domain/exercises';
import { MUSCLES, muscleInfo } from '../domain/regions';
import { formatWeight } from '../domain/settings';
import type { LogData, MuscleId, Settings } from '../domain/types';
import { activityLoad } from '../metrics/fatigue';
import { DAY, HOUR, round1, setMuscleDoses } from '../metrics/hardSets';
import { detectPRs } from '../metrics/strength';
import { muscleVolume, sessionMuscleVolume, volumeRange } from '../metrics/volume';
import { buildRegionWindows, coverage, muscleWindows, windowStatus, type GrowthWindow } from '../metrics/windows';
import type { RegionId } from '../domain/types';

// Insights are observations, not orders. They describe what the data shows and
// leave the decision to the lifter. Every insight carries a `why`.

export type InsightKind =
  | 'activity_fatigue'
  | 'window_closing'
  | 'untrained'
  | 'low_coverage'
  | 'volume_low'
  | 'volume_high'
  | 'high_coverage'
  | 'pr'
  | 'session_cap'
  | 'priority_order';

export const INSIGHT_KIND_LABELS: Record<InsightKind, string> = {
  activity_fatigue: 'Outside activity fatigue',
  window_closing: 'Growth window closing',
  untrained: 'Muscles without a recent window',
  low_coverage: 'Low time in growth',
  volume_low: 'Below weekly range',
  volume_high: 'Above weekly range',
  high_coverage: 'High time in growth',
  pr: 'Personal records',
  session_cap: 'Lots of sets in one session',
  priority_order: 'Priority muscle order',
};

export type Tone = 'celebrate' | 'nudge' | 'info';

export interface Insight {
  id: string;
  kind: InsightKind;
  tone: Tone;
  title: string;
  body: string;
  why: string;
  muscles?: MuscleId[];
}

export interface InsightContext {
  data: LogData;
  settings: Settings;
  now: number;
  regionWindows: Record<RegionId, GrowthWindow[]>;
}

export function makeContext(data: LogData, settings: Settings, now: number): InsightContext {
  return { data, settings, now, regionWindows: buildRegionWindows(data, settings) };
}

function names(ids: MuscleId[]): string {
  const n = ids.slice(0, 3).map((m) => muscleInfo(m).name);
  if (ids.length > 3) n.push(`${ids.length - 3} more`);
  if (n.length <= 1) return n.join('');
  return `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function hasWeekOfHistory(ctx: InsightContext): boolean {
  const first = Math.min(...ctx.data.sets.map((s) => s.completedAt));
  return Number.isFinite(first) && ctx.now - first >= 7 * DAY;
}

const WINDOW_WHY =
  'After a session, muscle protein synthesis stays elevated for roughly 36–48 hours. ' +
  'Outside that window the muscle drifts toward breakdown, which is why spreading sets ' +
  'across more days beats piling them into one.';

// ---- Rules over the whole log (Today screen) ----

function activityFatigue(ctx: InsightContext): Insight[] {
  return ctx.data.activities
    .filter((a) => ctx.now - a.startedAt < 36 * HOUR && a.startedAt <= ctx.now && activityLoad(a) >= 300)
    .map((a) => {
      const type = getActivityType(a.type);
      const when = ctx.now - a.startedAt < 16 * HOUR ? 'today' : 'yesterday';
      const legs = Object.keys(type.regions).some((r) => r.startsWith('quads') || r.startsWith('calves'));
      return {
        id: `activity_fatigue:${a.id}`,
        kind: 'activity_fatigue',
        tone: 'info',
        title: `${type.emoji} ${type.name} ${when}`,
        body:
          `${a.durationMin} min at ${a.difficulty}/10 (load ${activityLoad(a)}). ` +
          (legs
            ? 'Your legs may be carrying some fatigue — if lower-body lifts feel heavy, that’s likely why.'
            : 'You may be carrying some extra fatigue into today’s session.'),
        why:
          'Load = minutes × difficulty (session-RPE method, Foster 2001). Outside activities only count as ' +
          'fatigue here — they never open growth windows or add to your set counts.',
      } satisfies Insight;
    });
}

function windowClosing(ctx: InsightContext): Insight[] {
  const closing = MUSCLES.filter((m) => {
    const st = windowStatus(muscleWindows(ctx.regionWindows, m.id), ctx.now);
    return st.state === 'growing' && st.hoursLeft <= 12;
  }).map((m) => m.id);
  if (!closing.length) return [];
  return [{
    id: `window_closing:${closing.join(',')}`,
    kind: 'window_closing',
    tone: 'nudge',
    title: `${names(closing)} ${closing.length > 1 ? 'are' : 'is'} leaving the growth window`,
    body: 'Their windows close within ~12 hours. Even a set or two soon would keep them growing.',
    why: WINDOW_WHY,
    muscles: closing,
  }];
}

function untrained(ctx: InsightContext): Insight[] {
  if (!hasWeekOfHistory(ctx)) return [];
  const out: { m: MuscleId; days: number }[] = [];
  for (const m of MUSCLES) {
    const ws = muscleWindows(ctx.regionWindows, m.id);
    if (!ws.length) continue; // never trained: not something to nag about
    const st = windowStatus(ws, ctx.now);
    if (st.state === 'idle' && st.hoursSince !== null && st.hoursSince >= 5 * 24) {
      out.push({ m: m.id, days: Math.round(st.hoursSince / 24) });
    }
  }
  if (!out.length) return [];
  out.sort((a, b) => b.days - a.days);
  const top = out.slice(0, 3);
  return [{
    id: `untrained:${top.map((x) => x.m).join(',')}`,
    kind: 'untrained',
    tone: 'nudge',
    title: `${names(top.map((x) => x.m))} — no window in a while`,
    body: top.map((x) => `${muscleInfo(x.m).name}: ${x.days} days since the last window closed`).join('\n'),
    why: WINDOW_WHY,
    muscles: top.map((x) => x.m),
  }];
}

function lowCoverage(ctx: InsightContext): Insight[] {
  if (!hasWeekOfHistory(ctx)) return [];
  const from = ctx.now - 7 * DAY;
  const low = MUSCLES.map((m) => ({ m: m.id, c: coverage(muscleWindows(ctx.regionWindows, m.id), from, ctx.now) }))
    .filter((x) => x.c > 0 && x.c < 0.35)
    .sort((a, b) => a.c - b.c)
    .slice(0, 3);
  if (!low.length) return [];
  return [{
    id: `low_coverage:${low.map((x) => x.m).join(',')}`,
    kind: 'low_coverage',
    tone: 'nudge',
    title: `${names(low.map((x) => x.m))} grew less than a third of the week`,
    body:
      low.map((x) => `${muscleInfo(x.m).name}: ${Math.round(x.c * 100)}% of the last 7 days`).join('\n') +
      '\nOne more session a week roughly doubles time spent growing.',
    why: WINDOW_WHY,
    muscles: low.map((x) => x.m),
  }];
}

function volume(ctx: InsightContext): Insight[] {
  if (!hasWeekOfHistory(ctx)) return [];
  const vol = muscleVolume(ctx.data, ctx.settings, ctx.now);
  const out: Insight[] = [];
  const below = MUSCLES.filter((m) => (vol[m.id] ?? 0) > 0 && (vol[m.id] ?? 0) < volumeRange(m.id, ctx.settings).low);
  const above = MUSCLES.filter((m) => (vol[m.id] ?? 0) > volumeRange(m.id, ctx.settings).high);
  const why =
    'Weekly hard sets per muscle, counting secondary muscles at half a set (fractional counting, Pelland 2024). ' +
    'The range is a guide — adjust it in Settings.';
  if (below.length) {
    out.push({
      id: `volume_low:${below.map((m) => m.id).join(',')}`,
      kind: 'volume_low',
      tone: 'info',
      title: `${names(below.slice(0, 3).map((m) => m.id))} below your weekly range`,
      body: below.slice(0, 3).map((m) => {
        const r = volumeRange(m.id, ctx.settings);
        return `${m.name}: ${round1(vol[m.id] ?? 0)} hard sets (range ${r.low}–${r.high})`;
      }).join('\n'),
      why,
      muscles: below.map((m) => m.id),
    });
  }
  if (above.length) {
    out.push({
      id: `volume_high:${above.map((m) => m.id).join(',')}`,
      kind: 'volume_high',
      tone: 'info',
      title: `${names(above.slice(0, 3).map((m) => m.id))} above your weekly range`,
      body: above.slice(0, 3).map((m) => {
        const r = volumeRange(m.id, ctx.settings);
        return `${m.name}: ${round1(vol[m.id] ?? 0)} hard sets (range ${r.low}–${r.high})`;
      }).join('\n') + '\nTotally fine if it’s intentional.',
      why,
      muscles: above.map((m) => m.id),
    });
  }
  return out;
}

function highCoverage(ctx: InsightContext): Insight[] {
  if (!hasWeekOfHistory(ctx)) return [];
  const from = ctx.now - 7 * DAY;
  const top = MUSCLES.map((m) => ({ m: m.id, c: coverage(muscleWindows(ctx.regionWindows, m.id), from, ctx.now) }))
    .filter((x) => x.c >= 0.8)
    .sort((a, b) => b.c - a.c);
  if (!top.length) return [];
  const best = top[0];
  return [{
    id: `high_coverage:${best.m}`,
    kind: 'high_coverage',
    tone: 'celebrate',
    title: `${muscleInfo(best.m).name} grew ${Math.round(best.c * 100)}% of the week`,
    body: top.length > 1
      ? `${names(top.slice(1, 4).map((x) => x.m))} also stayed above 80%. That’s frequency doing its job.`
      : 'That’s frequency doing its job.',
    why: WINDOW_WHY,
    muscles: top.map((x) => x.m),
  }];
}

const ORDER: InsightKind[] = [
  'activity_fatigue', 'window_closing', 'untrained', 'low_coverage', 'volume_low', 'high_coverage', 'volume_high',
];

export function todayInsights(ctx: InsightContext): Insight[] {
  const all = [
    ...activityFatigue(ctx), ...windowClosing(ctx), ...untrained(ctx), ...lowCoverage(ctx), ...volume(ctx), ...highCoverage(ctx),
  ];
  return all
    .filter((i) => !ctx.settings.mutedInsights.includes(i.kind))
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

// ---- Rules about a single workout (Recap screen) ----

export function sessionInsights(ctx: InsightContext, workoutId: string): Insight[] {
  const { data, settings: s } = ctx;
  const sets = data.sets.filter((x) => x.workoutId === workoutId).sort((a, b) => a.position - b.position);
  const out: Insight[] = [];

  for (const pr of detectPRs(data, workoutId, s)) {
    const name = getExercise(pr.exerciseId)?.name ?? pr.exerciseId;
    out.push({
      id: `pr:${workoutId}:${pr.exerciseId}`,
      kind: 'pr',
      tone: 'celebrate',
      title: pr.kind === 'e1rm' ? `${name}: estimated 1RM PR` : `${name}: rep PR`,
      body: pr.kind === 'e1rm'
        ? `${formatWeight(pr.set.weightKg, s.units)} × ${pr.set.reps} → e1RM ${formatWeight(pr.value, s.units)} (was ${formatWeight(pr.previous, s.units)})`
        : `${formatWeight(pr.value, s.units)} for ${pr.set.reps} reps — previous best for ${pr.set.reps}+ reps was ${formatWeight(pr.previous, s.units)}`,
      why: 'e1RM uses the Epley formula with reps + RIR as reps possible (RIR-based RPE scale, Zourdos 2016).',
    });
  }

  const vol = sessionMuscleVolume(sets, s);
  const heavy = (Object.entries(vol) as [MuscleId, number][]).filter(([, v]) => v > s.sessionSetCap);
  if (heavy.length) {
    out.push({
      id: `session_cap:${workoutId}`,
      kind: 'session_cap',
      tone: 'info',
      title: `${names(heavy.map(([m]) => m))}: ${heavy.map(([, v]) => round1(v)).join(', ')} hard sets in one session`,
      body: `Past ~${s.sessionSetCap} sets per muscle in a session, extra sets can’t stretch the growth window much further. They might go further on another day.`,
      why: WINDOW_WHY,
      muscles: heavy.map(([m]) => m),
    });
  }

  const working = sets.filter((x) => x.kind === 'working');
  const late = s.priorityMuscles.filter((m) => {
    const idx = working.findIndex((x) => (setMuscleDoses(x, s)[m] ?? 0) >= 0.5);
    return idx >= 0 && working.length >= 6 && idx >= working.length / 2;
  });
  if (late.length) {
    out.push({
      id: `priority_order:${workoutId}`,
      kind: 'priority_order',
      tone: 'nudge',
      title: `${names(late)} came late today`,
      body: 'Priority muscles tend to get the best effort when trained early in the session.',
      why: 'Exercises done earlier in a session see better performance and, over time, more growth for that muscle (Nunes 2021 review).',
      muscles: late,
    });
  }

  return out.filter((i) => !s.mutedInsights.includes(i.kind));
}
