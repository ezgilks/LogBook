import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { BodyMap } from '../../components/BodyMap';
import { RangeBar, WindowTimeline } from '../../components/charts';
import { Card, Label, Pill, Row, Screen } from '../../components/ui';
import { EXERCISES } from '../../domain/exercises';
import { MUSCLES, REGION_NAMES } from '../../domain/regions';
import type { MuscleId, RegionId } from '../../domain/types';
import { regionStatuses, statusFill, statusText, useCtx } from '../../lib/derived';
import { colors, font, space } from '../../lib/theme';
import { DAY, round1 } from '../../metrics/hardSets';
import { muscleVolume, regionVolume, volumeRange } from '../../metrics/volume';
import { coverage, muscleWindows } from '../../metrics/windows';

const BACK_FIRST: MuscleId[] = ['lats', 'upper_back', 'lower_back', 'triceps', 'hamstrings', 'glutes', 'calves'];

export default function MuscleDetail() {
  const { id } = useLocalSearchParams<{ id: MuscleId }>();
  const ctx = useCtx();
  const { width } = useWindowDimensions();
  const muscle = MUSCLES.find((m) => m.id === id);
  const statuses = useMemo(() => regionStatuses(ctx), [ctx]);
  const rVol = useMemo(() => regionVolume(ctx.data, ctx.settings, ctx.now), [ctx]);
  const mVol = useMemo(() => muscleVolume(ctx.data, ctx.settings, ctx.now), [ctx]);
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of ctx.data.sets) m.set(s.exerciseId, (m.get(s.exerciseId) ?? 0) + 1);
    return m;
  }, [ctx.data.sets]);

  if (!muscle) return <Screen edges={[]}><Text style={font.sub}>Unknown muscle.</Text></Screen>;
  const barW = Math.min(width, 520) - space(16);
  const ws = muscleWindows(ctx.regionWindows, muscle.id);
  const cov = coverage(ws, ctx.now - 7 * DAY, ctx.now);
  const range = volumeRange(muscle.id, ctx.settings);
  const fills: Partial<Record<RegionId, string>> = {};
  for (const r of muscle.regions) fills[r] = statusFill(statuses[r]);
  for (const [r] of Object.entries(statuses)) if (!muscle.regions.includes(r as RegionId)) fills[r as RegionId] = colors.never;

  const exercises = EXERCISES.filter((e) => muscle.regions.some((r) => (e.regions[r] ?? 0) >= 1))
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.name.localeCompare(b.name));

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: '' }} />
      <Text style={font.h1}>{muscle.name}</Text>
      <Row style={{ marginTop: space(4), alignItems: 'flex-start' }}>
        <BodyMap side={BACK_FIRST.includes(muscle.id) ? 'back' : 'front'} fills={fills} height={220} />
        <View style={{ flex: 1, marginLeft: space(4) }}>
          <Text style={font.label}>Last 7 days</Text>
          <Text style={[font.num, { color: cov ? colors.grow : colors.text }]}>{Math.round(cov * 100)}%</Text>
          <Text style={font.sub}>time spent growing</Text>
          <Text style={[font.num, { marginTop: space(3) }]}>{round1(mVol[muscle.id] ?? 0)}</Text>
          <Text style={font.sub}>hard sets · range {range.low}–{range.high}</Text>
        </View>
      </Row>

      <Label>Regions</Label>
      {muscle.regions.map((r) => (
        <Card key={r} style={{ marginBottom: space(3) }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={font.h3}>{REGION_NAMES[r]}</Text>
            <Pill text={statusText(statuses[r])} color={statuses[r].state === 'growing' ? colors.grow : colors.faint} />
          </Row>
          <View style={{ marginTop: space(3) }}>
            <WindowTimeline windows={ctx.regionWindows[r]} now={ctx.now} width={barW} />
          </View>
          <Row style={{ justifyContent: 'space-between', marginTop: space(2) }}>
            <Text style={font.sub}>{Math.round(coverage(ctx.regionWindows[r], ctx.now - 7 * DAY, ctx.now) * 100)}% growing</Text>
            <Text style={font.sub}>{round1(rVol[r] ?? 0)} sets</Text>
          </Row>
        </Card>
      ))}

      <Label>Weekly volume</Label>
      <Card>
        <RangeBar value={mVol[muscle.id] ?? 0} low={range.low} high={range.high} width={barW} />
      </Card>

      <Label>Exercises that train it</Label>
      <Card>
        {exercises.map((e, i) => {
          const hits = muscle.regions.filter((r) => (e.regions[r] ?? 0) >= 1).map((r) => REGION_NAMES[r]);
          return (
            <View key={e.id} style={{ paddingVertical: space(2), borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[font.body, { color: colors.text }]} onPress={() => router.push(`/exercise/${e.id}`)}>{e.name}</Text>
                <Text style={font.sub}>{usage.get(e.id) ? `${usage.get(e.id)} sets` : ''}</Text>
              </Row>
              <Text style={[font.sub, { marginTop: 2 }]}>{hits.join(' · ')}{e.bias === 'lengthened' ? ' · stretch-biased' : ''}</Text>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
