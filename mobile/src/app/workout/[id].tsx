import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef } from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { RangeBar } from '../../components/charts';
import { InsightCard } from '../../components/InsightCard';
import { ShareCard } from '../../components/ShareCard';
import { Button, Card, Label, Row, Screen } from '../../components/ui';
import { getExercise } from '../../domain/exercises';
import { muscleInfo } from '../../domain/regions';
import { formatWeight } from '../../domain/settings';
import { sessionInsights } from '../../insights/engine';
import { track } from '../../lib/analytics';
import { confirm } from '../../lib/confirm';
import { useCtx } from '../../lib/derived';
import { colors, font, space } from '../../lib/theme';
import { round1 } from '../../metrics/hardSets';
import { buildRecap } from '../../metrics/recap';
import { useLog } from '../../store/log';

export default function RecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useCtx();
  const deleteWorkout = useLog((s) => s.deleteWorkout);
  const { width } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const recap = useMemo(() => buildRecap(ctx.data, id, ctx.settings), [ctx, id]);
  const insights = useMemo(() => sessionInsights(ctx, id), [ctx, id]);
  const barW = Math.min(width, 520) - space(16);

  if (!recap) {
    return (
      <Screen edges={[]}>
        <Text style={font.sub}>Workout not found.</Text>
      </Screen>
    );
  }
  const s = ctx.settings;

  const share = async () => {
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share recap' });
      track('recap_shared');
    } catch (e) {
      console.warn('[logbook] share failed', e);
    }
  };

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: 'Recap' }} />
      <View style={{ alignItems: 'center' }}>
        <ShareCard ref={cardRef} recap={recap} settings={s} width={Math.min(width - space(8), 360)} />
      </View>
      {Platform.OS !== 'web' && <Button title="Share recap" onPress={share} style={{ marginTop: space(4) }} />}

      {insights.length > 0 && <Label>From this session</Label>}
      {insights.map((i) => <InsightCard key={i.id} insight={i} />)}

      <Label>Lifts vs last time</Label>
      {recap.exercises.map((e) => {
        const ex = getExercise(e.exerciseId);
        const delta = e.previousE1rm ? (e.bestE1rm - e.previousE1rm) / e.previousE1rm : null;
        return (
          <Card key={e.exerciseId} style={{ marginBottom: space(3) }} onPress={() => router.push(`/exercise/${e.exerciseId}`)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={font.h3}>{ex?.name ?? e.exerciseId}</Text>
              {delta === null ? (
                <Text style={font.sub}>baseline</Text>
              ) : (
                <Text style={{ color: delta > 0.001 ? colors.grow : delta < -0.001 ? colors.sub : colors.text, fontWeight: '700' }}>
                  {delta > 0.001 ? '↑' : delta < -0.001 ? '↓' : '='} {Math.abs(Math.round(delta * 1000) / 10)}%
                </Text>
              )}
            </Row>
            <Text style={[font.sub, { marginTop: 4 }]}>
              {e.sets.map((x) => `${formatWeight(x.weightKg, s.units).replace(` ${s.units}`, '')}×${x.reps}${x.rir === null ? '' : `@${x.rir}`}`).join('  ·  ')}
            </Text>
            <Text style={[font.sub, { marginTop: 2, color: colors.faint }]}>e1RM {formatWeight(e.bestE1rm, s.units)}</Text>
          </Card>
        );
      })}

      <Label>Weekly volume after this session</Label>
      <Card>
        {recap.weekly.map((w) => (
          <View key={w.muscle} style={{ marginVertical: 6 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={font.body}>{muscleInfo(w.muscle).name}</Text>
              <Text style={font.sub}>{round1(w.sets)} / {w.low}–{w.high}</Text>
            </Row>
            <RangeBar value={w.sets} low={w.low} high={w.high} width={barW} />
          </View>
        ))}
      </Card>

      <Pressable
        onPress={() => confirm('Delete workout?', 'This removes the workout and all its sets.', 'Delete', () => { deleteWorkout(id); router.back(); })}
        style={{ marginTop: space(8), alignItems: 'center' }}
      >
        <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete workout</Text>
      </Pressable>
    </Screen>
  );
}
