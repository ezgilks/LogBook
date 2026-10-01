// Core domain types. Everything in src/domain, src/metrics and src/insights is
// framework-free TypeScript so it can be unit tested and shared with a server.

export type MuscleId =
  | 'chest'
  | 'shoulders'
  | 'lats'
  | 'upper_back'
  | 'lower_back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'calves'
  | 'abs';

export type RegionId =
  | 'chest_upper'
  | 'chest_mid'
  | 'chest_lower'
  | 'delt_front'
  | 'delt_side'
  | 'delt_rear'
  | 'lats'
  | 'upper_back'
  | 'traps_upper'
  | 'erectors'
  | 'biceps'
  | 'brachialis'
  | 'triceps_long'
  | 'triceps_lateral'
  | 'forearm_flexors'
  | 'forearm_extensors'
  | 'quads_rf'
  | 'quads_vasti'
  | 'hams_bf'
  | 'hams_semi'
  | 'glute_max'
  | 'glute_med'
  | 'adductors'
  | 'calves_gastroc'
  | 'calves_soleus'
  | 'abs_rectus'
  | 'obliques';

export type JointAction =
  | 'shoulder_flexion'
  | 'shoulder_extension'
  | 'shoulder_abduction'
  | 'shoulder_horizontal_adduction'
  | 'shoulder_horizontal_abduction'
  | 'shoulder_external_rotation'
  | 'scapular_retraction'
  | 'scapular_elevation'
  | 'elbow_flexion'
  | 'elbow_extension'
  | 'wrist_flexion'
  | 'wrist_extension'
  | 'hip_extension'
  | 'hip_flexion'
  | 'hip_abduction'
  | 'hip_adduction'
  | 'knee_extension'
  | 'knee_flexion'
  | 'ankle_plantarflexion'
  | 'spinal_flexion'
  | 'spinal_extension'
  | 'spinal_rotation';

/** Where in the range of motion the exercise is hardest. */
export type LengthBias = 'lengthened' | 'mid' | 'shortened';

/** A: direct experimental support. B: reasonable support / biomechanics. C: mostly theory. */
export type EvidenceGrade = 'A' | 'B' | 'C';

export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;
  equipment: Equipment;
  actions: JointAction[];
  /** Fraction of a set credited to each region (1 = primary mover, 0.5 = secondary). */
  regions: Partial<Record<RegionId, number>>;
  bias: LengthBias;
  evidence: { grade: EvidenceGrade; note: string };
}

export type SetKind = 'warmup' | 'working';

export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  /** Order within the workout, used for exercise-order insights. */
  position: number;
  /** Always stored in kg; converted for display. */
  weightKg: number;
  reps: number;
  /** Reps in reserve. Null means not logged; settings.defaultRir is assumed. */
  rir: number | null;
  kind: SetKind;
  completedAt: number;
}

export interface Workout {
  id: string;
  startedAt: number;
  endedAt: number | null;
  notes: string;
}

export interface Activity {
  id: string;
  type: string;
  startedAt: number;
  durationMin: number;
  /** 1–10 perceived difficulty. Full-court at 8 vs shooting around at 3. */
  difficulty: number;
  notes: string;
}

export type Units = 'lb' | 'kg';

export interface Settings {
  units: Units;
  priorityMuscles: MuscleId[];
  /** Assumed RIR when a set is logged without one. */
  defaultRir: number;
  /** RIR at or below this counts as a full hard set. */
  fullSetMaxRir: number;
  /** RIR at or below this (but above fullSetMaxRir) counts as half a set. */
  halfSetMaxRir: number;
  /** Hard sets on a region in one session needed to open a growth window. */
  windowMinDose: number;
  windowMinHours: number;
  windowMaxHours: number;
  /** Session dose at which the window reaches windowMaxHours. */
  windowFullDose: number;
  weeklySetsLow: number;
  weeklySetsHigh: number;
  prioritySetsHigh: number;
  /** Hard sets per muscle in one session past which extra sets are flagged. */
  sessionSetCap: number;
  mutedInsights: string[];
}

export interface LogData {
  workouts: Workout[];
  sets: WorkoutSet[];
  activities: Activity[];
}
