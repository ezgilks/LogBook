import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { BodyMap } from '../../components/BodyMap';
import { LineChart } from '../../components/charts';
import { Card, Chip, Label, Pill, Row, Screen } from '../../components/ui';
import { getExercise } from '../../domain/exercises';
import { JOINT_ACTION_NAMES, REGION_NAMES } from '../../domain/regions';
import { formatWeight } from '../../domain/settings';
import type { RegionId } from '../../domain/types';
import { formatDate, mix } from '../../lib/derived';
import { colors, font, space } from '../../lib/theme';
import { e1rmHistory } from '../../metrics/strength';
import { useLog } from '../../store/log';

const BIAS_TEXT = { lengthened: 'Hardest in the stretch', mid: 'Hardest mid-range', shortened: 'Hardest when contracted' };
const GRADE_COLOR = { A: colors.grow, B: colors.info, C: colors.nudge };
const REP_TARGETS = [1, 3, 5, 8, 10, 12, 15];

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useLog((s) => s.data);
  const settings = useLog((s) => s.settings);
  const { width } = useWindowDimensions();
  const ex = getExercise(id);
  const history = useMemo(() => e1rmHistory(data, id, settings), [data, id, settings]);
  const sets = useMemo(() => data.sets.filter((s) => s.exerciseId === id && s.kind === 'working'), [data.sets, id]);

  if (!ex) return <Screen edges={[]}><Text style={font.sub}>Unknown exercise.</Text></Screen>;

  const fills: Partial<Record<RegionId, string>> = {};
  for (const [r, w] of Object.entries(ex.regions) as [RegionId, number][]) fills[r] = mix(colors.growDim, colors.grow, w);
  const regionRows = (Object.entries(ex.regions) as [RegionId, number][]).sort((a, b) => b[1] - a[1]);
  const bests = REP_TARGETS.map((r) => {
    const atLeast = sets.filter((s) => s.reps >= r);
    return { reps: r, best: atLeast.length ? Math.max(...atLeast.map((s) => s.weightKg)) : null };
  }).filter((b) => b.best !== null);

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: '' }} />
      <Text style={font.h1}>{ex.name}</Text>
      <Row style={{ marginTop: space(2), gap: space(2) }}>
        <Pill text={ex.equipment} color={colors.sub} />
        <Pill text={BIAS_TEXT[ex.bias]} color={ex.bias === 'lengthened' ? colors.grow : colors.info} />
      </Row>

      <Card style={{ marginTop: space(4), flexDirection: 'row', justifyContent: 'center', gap: space(4) }}>
        <BodyMap side="front" fills={fills} height={200} />
        <BodyMap side="back" fills={fills} height={200} />
      </Card>

      <Label>Regions (share of a set)</Label>
      <Card>
        {regionRows.map(([r, w]) => (
          <Row key={r} style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
            <Text style={font.body}>{REGION_NAMES[r]}</Text>
            <Text style={{ color: w >= 1 ? colors.grow : colors.sub, fontWeight: '700' }}>{w}</Text>
          </Row>
        ))}
      </Card>

      <Label>Joint actions</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {ex.actions.map((a) => <Chip key={a} label={JOINT_ACTION_NAMES[a]} />)}
      </View>

      <Label>Evidence</Label>
      <Card>
        <Row>
          <Pill text={`Grade ${ex.evidence.grade}`} color={GRADE_COLOR[ex.evidence.grade]} />
        </Row>
        <Text style={[font.sub, { marginTop: space(2), lineHeight: 19, color: colors.text }]}>{ex.evidence.note}</Text>
        <Text style={[font.sub, { marginTop: space(2), fontSize: 12 }]}>A: direct experimental support · B: reasonable support or biomechanics · C: mostly theory</Text>
      </Card>

      <Label>Estimated 1RM</Label>
      <Card>
        <LineChart points={history.map((h) => ({ at: h.at, value: h.e1rm }))} width={Math.min(width, 520) - space(16)} format={(v) => formatWeight(v, settings.units)} />
      </Card>

      {bests.length > 0 && (
        <>
          <Label>Best weight by reps</Label>
          <Card>
            {bests.map((b) => (
              <Row key={b.reps} style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
                <Text style={font.body}>{b.reps}+ reps</Text>
                <Text style={[font.body, { fontWeight: '700' }]}>{formatWeight(b.best!, settings.units)}</Text>
              </Row>
            ))}
          </Card>
        </>
      )}

      {history.length > 0 && (
        <>
          <Label>Recent sessions</Label>
          <Card>
            {[...history].reverse().slice(0, 8).map((h) => (
              <Row key={h.workoutId} style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
                <Text style={font.sub}>{formatDate(h.at)}</Text>
                <Text style={font.body}>
                  {formatWeight(h.best.weightKg, settings.units)} × {h.best.reps}
                  <Text style={{ color: colors.sub }}>  e1RM {formatWeight(h.e1rm, settings.units)}</Text>
                </Text>
              </Row>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
