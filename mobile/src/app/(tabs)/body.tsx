import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Bar, RangeBar, WindowTimeline } from '../../components/charts';
import { Card, Label, Pill, Row, Screen, Segmented } from '../../components/ui';
import { getExercise } from '../../domain/exercises';
import { JOINT_ACTION_NAMES, MUSCLES } from '../../domain/regions';
import type { JointAction, LengthBias } from '../../domain/types';
import { muscleStatuses, statusText, useCtx } from '../../lib/derived';
import { colors, font, space } from '../../lib/theme';
import { DAY, round1, setValue } from '../../metrics/hardSets';
import { jointActionVolume, muscleFrequency, muscleVolume, setsInRange, volumeRange } from '../../metrics/volume';
import { coverage, muscleWindows } from '../../metrics/windows';

type View_ = 'muscles' | 'joints';

export default function Body() {
  const ctx = useCtx();
  const { width } = useWindowDimensions();
  const [view, setView] = useState<View_>('muscles');
  const barW = Math.min(width, 520) - space(16);

  const statuses = useMemo(() => muscleStatuses(ctx), [ctx]);
  const vol = useMemo(() => muscleVolume(ctx.data, ctx.settings, ctx.now), [ctx]);
  const joints = useMemo(() => jointActionVolume(ctx.data, ctx.settings, ctx.now), [ctx]);
  const bias = useMemo(() => {
    const out: Record<LengthBias, number> = { lengthened: 0, mid: 0, shortened: 0 };
    for (const set of setsInRange(ctx.data, ctx.now - 7 * DAY, ctx.now + 1)) {
      const ex = getExercise(set.exerciseId);
      if (ex) out[ex.bias] += setValue(set, ctx.settings);
    }
    return out;
  }, [ctx]);

  const rows = MUSCLES.map((m) => {
    const ws = muscleWindows(ctx.regionWindows, m.id);
    return { m, ws, cov: coverage(ws, ctx.now - 7 * DAY, ctx.now), sets: vol[m.id] ?? 0, freq: muscleFrequency(ctx.data, ctx.settings, m.id, ctx.now) };
  });
  const jointRows = (Object.entries(joints) as [JointAction, number][]).sort((a, b) => b[1] - a[1]);
  const maxJoint = Math.max(1, ...jointRows.map(([, v]) => v));
  const biasTotal = bias.lengthened + bias.mid + bias.shortened;

  return (
    <Screen>
      <Text style={font.h1}>Body</Text>
      <Text style={[font.sub, { marginTop: 4 }]}>Last 7 days · green = time spent growing, ticks = sessions</Text>
      <View style={{ marginTop: space(4) }}>
        <Segmented options={[{ value: 'muscles', label: 'Muscles' }, { value: 'joints', label: 'Joint actions' }]} value={view} onChange={setView} />
      </View>

      {view === 'muscles' ? (
        rows.map(({ m, ws, cov, sets, freq }) => {
          const st = statuses[m.id];
          const range = volumeRange(m.id, ctx.settings);
          const priority = ctx.settings.priorityMuscles.includes(m.id);
          return (
            <Card key={m.id} style={{ marginTop: space(3) }} onPress={() => router.push(`/muscle/${m.id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row>
                  <Text style={font.h3}>{m.name}</Text>
                  {priority && <Text style={{ color: colors.celebrate, marginLeft: 6 }}>★</Text>}
                </Row>
                <Pill text={statusText(st)} color={st.state === 'growing' ? colors.grow : colors.faint} />
              </Row>
              <View style={{ marginTop: space(3) }}>
                <WindowTimeline windows={ws} now={ctx.now} width={barW} />
              </View>
              <Row style={{ justifyContent: 'space-between', marginTop: space(2) }}>
                <Text style={font.sub}>
                  <Text style={{ color: cov > 0 ? colors.grow : colors.sub, fontWeight: '700' }}>{Math.round(cov * 100)}%</Text> growing · {freq}× this week
                </Text>
                <Text style={font.sub}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{round1(sets)}</Text> sets · {range.low}–{range.high}
                </Text>
              </Row>
              <View style={{ marginTop: space(2) }}>
                <RangeBar value={sets} low={range.low} high={range.high} width={barW} />
              </View>
            </Card>
          );
        })
      ) : (
        <>
          <Label>Hard sets by joint action</Label>
          <Card>
            {jointRows.length === 0 && <Text style={font.sub}>No hard sets in the last 7 days.</Text>}
            {jointRows.map(([a, v]) => (
              <Row key={a} style={{ justifyContent: 'space-between', marginVertical: 5 }}>
                <Text style={[font.body, { flex: 1 }]}>{JOINT_ACTION_NAMES[a]}</Text>
                <Text style={[font.sub, { width: 36, textAlign: 'right', marginRight: space(3) }]}>{round1(v)}</Text>
                <Bar value={v} max={maxJoint} width={Math.min(140, barW / 2.6)} />
              </Row>
            ))}
          </Card>
          <Label>Where your sets are hardest</Label>
          <Card>
            <Text style={[font.sub, { marginBottom: space(3), lineHeight: 19 }]}>
              Training a muscle hard at long lengths (in the stretch) tends to produce more growth than at short lengths.
            </Text>
            {(['lengthened', 'mid', 'shortened'] as LengthBias[]).map((b) => (
              <Row key={b} style={{ justifyContent: 'space-between', marginVertical: 5 }}>
                <Text style={[font.body, { flex: 1, textTransform: 'capitalize' }]}>{b}</Text>
                <Text style={[font.sub, { width: 44, textAlign: 'right', marginRight: space(3) }]}>
                  {biasTotal ? Math.round((bias[b] / biasTotal) * 100) : 0}%
                </Text>
                <Bar value={bias[b]} max={biasTotal} width={Math.min(140, barW / 2.6)} color={b === 'lengthened' ? colors.grow : colors.info} />
              </Row>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
