import type { Settings } from './types';

// Defaults are guides, not prescriptions — every value is adjustable in Settings.
export const DEFAULT_SETTINGS: Settings = {
  units: 'lb',
  priorityMuscles: [],
  defaultRir: 2,
  fullSetMaxRir: 3,
  halfSetMaxRir: 5,
  windowMinDose: 1,
  windowMinHours: 36,
  windowMaxHours: 48,
  windowFullDose: 4,
  weeklySetsLow: 6,
  weeklySetsHigh: 10,
  prioritySetsHigh: 12,
  sessionSetCap: 5,
  mutedInsights: [],
};

export const KG_PER_LB = 0.45359237;

export function toDisplayWeight(kg: number, units: Settings['units']): number {
  const v = units === 'lb' ? kg / KG_PER_LB : kg;
  return Math.round(v * 10) / 10;
}

export function fromDisplayWeight(value: number, units: Settings['units']): number {
  return units === 'lb' ? value * KG_PER_LB : value;
}

export function formatWeight(kg: number, units: Settings['units']): string {
  const v = toDisplayWeight(kg, units);
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${units}`;
}
