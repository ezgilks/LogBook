import { getActivityType } from '../domain/activities';
import { ALL_REGIONS } from '../domain/regions';
import type { Activity, LogData, RegionId, Settings } from '../domain/types';
import { HOUR, setRegionDoses } from './hardSets';

// Simple fatigue model: every hard set and outside activity adds fatigue that
// decays exponentially. It's a rough guide for context, not a verdict.

const LOCAL_HALF_LIFE_H = 24;
const SYSTEMIC_HALF_LIFE_H = 36;
/** Fatigue added per hard set on a region. */
const PER_SET = 10;
/** Activity load (minutes × difficulty) per fatigue point. */
const ACTIVITY_DIVISOR = 15;

function decay(ageH: number, halfLife: number): number {
  return ageH < 0 ? 0 : Math.pow(0.5, ageH / halfLife);
}

export function activityLoad(a: Activity): number {
  return a.durationMin * a.difficulty;
}

export interface FatigueState {
  regions: Record<RegionId, number>;
  systemic: number;
}

export function fatigue(data: LogData, s: Settings, now: number): FatigueState {
  const regions = Object.fromEntries(ALL_REGIONS.map((r) => [r, 0])) as Record<RegionId, number>;
  let systemic = 0;
  const horizon = now - 7 * 24 * HOUR;

  for (const set of data.sets) {
    if (set.completedAt < horizon || set.completedAt > now) continue;
    const k = decay((now - set.completedAt) / HOUR, LOCAL_HALF_LIFE_H);
    let total = 0;
    for (const [r, d] of Object.entries(setRegionDoses(set, s)) as [RegionId, number][]) {
      regions[r] += d * PER_SET * k;
      total = Math.max(total, d);
    }
    systemic += total * 2 * decay((now - set.completedAt) / HOUR, SYSTEMIC_HALF_LIFE_H);
  }

  for (const a of data.activities) {
    const end = a.startedAt + a.durationMin * 60_000;
    if (end < horizon || a.startedAt > now) continue;
    const type = getActivityType(a.type);
    const load = activityLoad(a) / ACTIVITY_DIVISOR;
    const ageH = (now - end) / HOUR;
    for (const [r, w] of Object.entries(type.regions) as [RegionId, number][]) {
      regions[r] += load * w * decay(ageH, LOCAL_HALF_LIFE_H);
    }
    systemic += load * type.systemic * decay(ageH, SYSTEMIC_HALF_LIFE_H);
  }

  for (const r of ALL_REGIONS) regions[r] = Math.min(100, regions[r]);
  return { regions, systemic: Math.min(100, systemic) };
}

export type FatigueLevel = 'fresh' | 'moderate' | 'heavy';

export function fatigueLevel(score: number): FatigueLevel {
  if (score < 20) return 'fresh';
  if (score < 45) return 'moderate';
  return 'heavy';
}
