import type { JointAction, MuscleId, RegionId } from './types';

export interface MuscleInfo {
  id: MuscleId;
  name: string;
  regions: RegionId[];
}

export const MUSCLES: MuscleInfo[] = [
  { id: 'chest', name: 'Chest', regions: ['chest_upper', 'chest_mid', 'chest_lower'] },
  { id: 'shoulders', name: 'Shoulders', regions: ['delt_front', 'delt_side', 'delt_rear'] },
  { id: 'lats', name: 'Lats', regions: ['lats'] },
  { id: 'upper_back', name: 'Upper back', regions: ['upper_back', 'traps_upper'] },
  { id: 'lower_back', name: 'Lower back', regions: ['erectors'] },
  { id: 'biceps', name: 'Biceps', regions: ['biceps', 'brachialis'] },
  { id: 'triceps', name: 'Triceps', regions: ['triceps_long', 'triceps_lateral'] },
  { id: 'forearms', name: 'Forearms', regions: ['forearm_flexors', 'forearm_extensors'] },
  { id: 'quads', name: 'Quads', regions: ['quads_rf', 'quads_vasti'] },
  { id: 'hamstrings', name: 'Hamstrings', regions: ['hams_bf', 'hams_semi'] },
  { id: 'glutes', name: 'Glutes', regions: ['glute_max', 'glute_med'] },
  { id: 'adductors', name: 'Adductors', regions: ['adductors'] },
  { id: 'calves', name: 'Calves', regions: ['calves_gastroc', 'calves_soleus'] },
  { id: 'abs', name: 'Abs', regions: ['abs_rectus', 'obliques'] },
];

export const REGION_NAMES: Record<RegionId, string> = {
  chest_upper: 'Upper chest',
  chest_mid: 'Mid chest',
  chest_lower: 'Lower chest',
  delt_front: 'Front delts',
  delt_side: 'Side delts',
  delt_rear: 'Rear delts',
  lats: 'Lats',
  upper_back: 'Mid traps & rhomboids',
  traps_upper: 'Upper traps',
  erectors: 'Spinal erectors',
  biceps: 'Biceps',
  brachialis: 'Brachialis',
  triceps_long: 'Triceps long head',
  triceps_lateral: 'Triceps lateral/medial',
  forearm_flexors: 'Forearm flexors',
  forearm_extensors: 'Forearm extensors',
  quads_rf: 'Rectus femoris',
  quads_vasti: 'Vasti',
  hams_bf: 'Biceps femoris',
  hams_semi: 'Semitendinosus/membranosus',
  glute_max: 'Glute max',
  glute_med: 'Glute med',
  adductors: 'Adductors',
  calves_gastroc: 'Gastrocnemius',
  calves_soleus: 'Soleus',
  abs_rectus: 'Rectus abdominis',
  obliques: 'Obliques',
};

export const ALL_REGIONS = Object.keys(REGION_NAMES) as RegionId[];

const REGION_TO_MUSCLE = Object.fromEntries(
  MUSCLES.flatMap((m) => m.regions.map((r) => [r, m.id])),
) as Record<RegionId, MuscleId>;

export function muscleOf(region: RegionId): MuscleId {
  return REGION_TO_MUSCLE[region];
}

export function muscleInfo(id: MuscleId): MuscleInfo {
  return MUSCLES.find((m) => m.id === id)!;
}

export const JOINT_ACTION_NAMES: Record<JointAction, string> = {
  shoulder_flexion: 'Shoulder flexion',
  shoulder_extension: 'Shoulder extension',
  shoulder_abduction: 'Shoulder abduction',
  shoulder_horizontal_adduction: 'Horizontal adduction',
  shoulder_horizontal_abduction: 'Horizontal abduction',
  shoulder_external_rotation: 'External rotation',
  scapular_retraction: 'Scapular retraction',
  scapular_elevation: 'Scapular elevation',
  elbow_flexion: 'Elbow flexion',
  elbow_extension: 'Elbow extension',
  wrist_flexion: 'Wrist flexion',
  wrist_extension: 'Wrist extension',
  hip_extension: 'Hip extension',
  hip_flexion: 'Hip flexion',
  hip_abduction: 'Hip abduction',
  hip_adduction: 'Hip adduction',
  knee_extension: 'Knee extension',
  knee_flexion: 'Knee flexion',
  ankle_plantarflexion: 'Plantarflexion',
  spinal_flexion: 'Spinal flexion',
  spinal_extension: 'Spinal extension',
  spinal_rotation: 'Spinal rotation',
};
