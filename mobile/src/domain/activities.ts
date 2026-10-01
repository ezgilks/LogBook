import type { RegionId } from './types';

// Outside activities only add fatigue; they never open growth windows or count
// toward volume.

export interface ActivityType {
  id: string;
  name: string;
  emoji: string;
  /** How much of the activity's load lands on each region (0–1). */
  regions: Partial<Record<RegionId, number>>;
  /** How much the activity taxes whole-body recovery (0–1). */
  systemic: number;
}

const LEGS = { quads_vasti: 1, quads_rf: 0.75, calves_gastroc: 1, calves_soleus: 1, glute_max: 0.5, hams_bf: 0.5, hams_semi: 0.5 };

export const ACTIVITY_TYPES: ActivityType[] = [
  { id: 'basketball', name: 'Basketball', emoji: '🏀', regions: { ...LEGS, adductors: 0.5, glute_med: 0.5 }, systemic: 1 },
  { id: 'running', name: 'Running', emoji: '🏃', regions: { ...LEGS, quads_vasti: 0.75 }, systemic: 0.9 },
  { id: 'soccer', name: 'Soccer', emoji: '⚽', regions: { ...LEGS, adductors: 0.75 }, systemic: 1 },
  { id: 'tennis', name: 'Tennis / pickleball', emoji: '🎾', regions: { ...LEGS, quads_vasti: 0.75, delt_front: 0.25, forearm_flexors: 0.25 }, systemic: 0.7 },
  { id: 'cycling', name: 'Cycling', emoji: '🚴', regions: { quads_vasti: 1, quads_rf: 0.75, glute_max: 0.5, calves_soleus: 0.5 }, systemic: 0.7 },
  { id: 'swimming', name: 'Swimming', emoji: '🏊', regions: { lats: 1, delt_front: 0.5, delt_rear: 0.5, triceps_long: 0.5 }, systemic: 0.8 },
  { id: 'climbing', name: 'Climbing', emoji: '🧗', regions: { forearm_flexors: 1, lats: 0.75, biceps: 0.5, brachialis: 0.75 }, systemic: 0.6 },
  { id: 'hiking', name: 'Hiking', emoji: '🥾', regions: { quads_vasti: 0.5, calves_soleus: 0.5, glute_max: 0.5 }, systemic: 0.5 },
  { id: 'volleyball', name: 'Volleyball', emoji: '🏐', regions: { ...LEGS, delt_front: 0.25, delt_side: 0.25 }, systemic: 0.8 },
  { id: 'other', name: 'Other', emoji: '⚡', regions: {}, systemic: 0.6 },
];

export function getActivityType(id: string): ActivityType {
  return ACTIVITY_TYPES.find((a) => a.id === id) ?? ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
}
