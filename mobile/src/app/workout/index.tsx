import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BodyMap } from '../../components/BodyMap';
import { Button, Card, Row, Screen, styles as ui } from '../../components/ui';
import { getExercise } from '../../domain/exercises';
import { formatWeight, fromDisplayWeight, toDisplayWeight } from '../../domain/settings';
import type { RegionId, Settings, WorkoutSet } from '../../domain/types';
import { confirm } from '../../lib/confirm';
import { mix } from '../../lib/derived';
import { successHaptic, tapHaptic } from '../../lib/haptics';
import { colors, font, radius, space } from '../../lib/theme';
import { setRegionDoses, sumDoses } from '../../metrics/hardSets';
import { useLog } from '../../store/log';
import { useAccount } from '../../sync/account';

const REST_SECONDS = 120;

export default function ActiveWorkout() {
  const activeId = useLog((s) => s.activeWorkoutId);
  const data = useLog((s) => s.data);
  const settings = useLog((s) => s.settings);
  const drafts = useLog((s) => s.draftExerciseIds);
  const finishWorkout = useLog((s) => s.finishWorkout);
  const discardWorkout = useLog((s) => s.discardWorkout);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const workout = data.workouts.find((w) => w.id === activeId);
  const sets = useMemo(() => data.sets.filter((x) => x.workoutId === activeId).sort((a, b) => a.position - b.position), [data.sets, activeId]);
  const exerciseIds = useMemo(() => {
    const ids: string[] = [];
    for (const s of sets) if (!ids.includes(s.exerciseId)) ids.push(s.exerciseId);
    for (const d of drafts) if (!ids.includes(d)) ids.push(d);
    return ids;
  }, [sets, drafts]);

  const sessionFills = useMemo(() => {
    const doses = sumDoses(sets, (s) => setRegionDoses(s, settings));
    const out: Partial<Record<RegionId, string>> = {};
    for (const [r, d] of Object.entries(doses) as [RegionId, number][]) {
      if (d > 0) out[r] = mix(colors.growDim, colors.grow, Math.min(1, d / settings.windowFullDose));
    }
    return out;
  }, [sets, settings]);

  if (!workout) {
    return (
      <Screen edges={[]}>
        <Text style={font.sub}>No active workout.</Text>
        <Button title="Back" kind="secondary" onPress={() => router.back()} style={{ marginTop: space(4) }} />
      </Screen>
    );
  }

  const elapsedMin = Math.floor((clock - workout.startedAt) / 60_000);
  const restLeft = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - clock) / 1000)) : 0;

  const finish = () => {
    const id = finishWorkout();
    successHaptic();
    useAccount.getState().syncNow();
    if (id) router.replace(`/workout/${id}`);
    else router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: `${Math.floor(elapsedMin / 60) ? `${Math.floor(elapsedMin / 60)}h ` : ''}${elapsedMin % 60} min`,
          headerRight: () => (
            <Pressable onPress={finish} hitSlop={10}>
              <Text style={{ color: colors.grow, fontWeight: '800', fontSize: 16 }}>Finish</Text>
            </Pressable>
          ),
        }}
      />
      <Screen edges={[]}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
          <BodyMap side="front" fills={sessionFills} height={150} />
          <View style={{ alignItems: 'center' }}>
            <Text style={font.num}>{sets.filter((s) => s.kind === 'working').length}</Text>
            <Text style={font.sub}>sets</Text>
          </View>
          <BodyMap side="back" fills={sessionFills} height={150} />
        </Card>

        {exerciseIds.map((id) => (
          <ExerciseBlock key={id} exerciseId={id} sets={sets.filter((s) => s.exerciseId === id)} settings={settings} onLogged={() => setRestEndsAt(Date.now() + REST_SECONDS * 1000)} />
        ))}

        <Button title="+ Add exercise" kind="secondary" onPress={() => router.push('/workout/pick')} style={{ marginTop: space(4) }} />
        <Button title="Finish workout" onPress={finish} style={{ marginTop: space(3) }} />
        <Button
          title="Discard workout"
          kind="danger"
          onPress={() => confirm('Discard workout?', 'All sets from this session will be removed.', 'Discard', () => { discardWorkout(); router.back(); })}
          style={{ marginTop: space(2) }}
        />
        {restLeft > 0 && <View style={{ height: 80 }} />}
      </Screen>

      {restEndsAt && restLeft > 0 && (
        <View style={{ position: 'absolute', left: space(4), right: space(4), bottom: space(8), backgroundColor: colors.cardHi, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space(3), flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="timer-outline" size={22} color={colors.grow} />
          <Text style={[font.h2, { marginLeft: space(2), flex: 1, fontVariant: ['tabular-nums'] }]}>
            {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
          </Text>
          <Button small kind="secondary" title="+30s" onPress={() => setRestEndsAt((t) => (t ?? Date.now()) + 30_000)} />
          <Button small kind="ghost" title="Skip" onPress={() => setRestEndsAt(null)} style={{ marginLeft: space(2) }} />
        </View>
      )}
    </View>
  );
}

function lastSessionSets(all: WorkoutSet[], exerciseId: string, excludeWorkout: string): WorkoutSet[] {
  const prior = all.filter((s) => s.exerciseId === exerciseId && s.workoutId !== excludeWorkout && s.kind === 'working');
  if (!prior.length) return [];
  const lastWorkout = prior.reduce((a, b) => (b.completedAt > a.completedAt ? b : a)).workoutId;
  return prior.filter((s) => s.workoutId === lastWorkout).sort((a, b) => a.position - b.position);
}

function ExerciseBlock({ exerciseId, sets, settings, onLogged }: { exerciseId: string; sets: WorkoutSet[]; settings: Settings; onLogged: () => void }) {
  const exercise = getExercise(exerciseId);
  const all = useLog((s) => s.data.sets);
  const activeId = useLog((s) => s.activeWorkoutId)!;
  const addSet = useLog((s) => s.addSet);
  const deleteSet = useLog((s) => s.deleteSet);
  const removeDraft = useLog((s) => s.removeDraftExercise);

  const last = useMemo(() => lastSessionSets(all, exerciseId, activeId), [all, exerciseId, activeId]);
  const seed = sets[sets.length - 1] ?? last[sets.length] ?? last[last.length - 1];
  const step = settings.units === 'lb' ? 5 : 2.5;

  const [weight, setWeight] = useState(() => String(seed ? toDisplayWeight(seed.weightKg, settings.units) : exercise?.equipment === 'barbell' ? (settings.units === 'lb' ? 135 : 60) : 0));
  const [reps, setReps] = useState(seed?.reps ?? 10);
  const [rir, setRir] = useState<number | null>(seed?.rir ?? settings.defaultRir);

  // After logging, prefill the next set from last session's matching set if there is one.
  useEffect(() => {
    const next = last[sets.length];
    if (next) {
      setWeight(String(toDisplayWeight(next.weightKg, settings.units)));
      setReps(next.reps);
    }
  }, [sets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const w = parseFloat(weight) || 0;

  const log = () => {
    addSet({ exerciseId, weightKg: fromDisplayWeight(w, settings.units), reps, rir });
    removeDraft(exerciseId);
    tapHaptic();
    onLogged();
  };

  return (
    <Card style={{ marginTop: space(4) }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={() => router.push(`/exercise/${exerciseId}`)} style={{ flex: 1 }}>
          <Text style={font.h3}>{exercise?.name ?? exerciseId}</Text>
        </Pressable>
        {sets.length === 0 && (
          <Pressable hitSlop={10} onPress={() => removeDraft(exerciseId)}>
            <Ionicons name="close" size={18} color={colors.faint} />
          </Pressable>
        )}
      </Row>
      <Text style={[font.sub, { marginTop: 4 }]}>
        {last.length
          ? `Last: ${last.map((s) => `${toDisplayWeight(s.weightKg, settings.units)}×${s.reps}`).join(' · ')}`
          : 'First time logging this — today sets the baseline.'}
      </Text>

      {sets.map((s, i) => (
        <Row key={s.id} style={{ marginTop: space(2), paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={[font.sub, { width: 24 }]}>{i + 1}</Text>
          <Text style={[font.body, { flex: 1, fontWeight: '600' }]}>
            {formatWeight(s.weightKg, settings.units)} × {s.reps}
            <Text style={{ color: colors.sub, fontWeight: '400' }}>{s.rir === null ? '' : `  @ ${s.rir} RIR`}</Text>
          </Text>
          <Pressable hitSlop={10} onPress={() => deleteSet(s.id)}>
            <Ionicons name="trash-outline" size={16} color={colors.faint} />
          </Pressable>
        </Row>
      ))}

      <Row style={{ marginTop: space(3), gap: space(2) }}>
        <View style={{ flex: 1.3 }}>
          <Text style={[font.label, { marginBottom: 4 }]}>{settings.units}</Text>
          <View style={ui.stepper}>
            <Pressable hitSlop={6} style={ui.stepBtn} onPress={() => setWeight(String(Math.max(0, w - step)))}>
              <Text style={ui.stepTxt}>−</Text>
            </Pressable>
            <TextInput
              value={weight}
              onChangeText={(t) => setWeight(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={[ui.stepVal, { flex: 1, minWidth: 0, paddingVertical: 8 }]}
            />
            <Pressable hitSlop={6} style={ui.stepBtn} onPress={() => setWeight(String(w + step))}>
              <Text style={ui.stepTxt}>+</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[font.label, { marginBottom: 4 }]}>reps</Text>
          <View style={ui.stepper}>
            <Pressable hitSlop={6} style={ui.stepBtn} onPress={() => setReps((r) => Math.max(1, r - 1))}>
              <Text style={ui.stepTxt}>−</Text>
            </Pressable>
            <Text style={[ui.stepVal, { flex: 1, minWidth: 0 }]}>{reps}</Text>
            <Pressable hitSlop={6} style={ui.stepBtn} onPress={() => setReps((r) => r + 1)}>
              <Text style={ui.stepTxt}>+</Text>
            </Pressable>
          </View>
        </View>
      </Row>

      <Text style={[font.label, { marginTop: space(3), marginBottom: 6 }]}>Reps in reserve</Text>
      <Row style={{ gap: 6 }}>
        {[0, 1, 2, 3, 4, 5].map((v) => (
          <Pressable
            key={v}
            onPress={() => setRir(rir === v ? null : v)}
            style={{ flex: 1, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: rir === v ? colors.grow : colors.border, backgroundColor: rir === v ? colors.grow + '22' : colors.cardHi }}
          >
            <Text style={{ color: rir === v ? colors.grow : colors.sub, fontWeight: '700' }}>{v === 5 ? '5+' : v}</Text>
          </Pressable>
        ))}
      </Row>

      <Button title={`Log set ${sets.length + 1}`} onPress={log} disabled={reps <= 0} style={{ marginTop: space(3) }} />
    </Card>
  );
}
