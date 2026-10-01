import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Row, Screen } from '../../components/ui';
import { getActivityType } from '../../domain/activities';
import { muscleInfo } from '../../domain/regions';
import type { MuscleId } from '../../domain/types';
import { confirm } from '../../lib/confirm';
import { formatDate, formatDuration } from '../../lib/derived';
import { colors, font, space } from '../../lib/theme';
import { round1, setValue } from '../../metrics/hardSets';
import { sessionMuscleVolume } from '../../metrics/volume';
import { useLog } from '../../store/log';

type Item =
  | { kind: 'workout'; at: number; id: string; durationMin: number; hardSets: number; muscles: MuscleId[] }
  | { kind: 'activity'; at: number; id: string; type: string; durationMin: number; difficulty: number };

export default function History() {
  const data = useLog((s) => s.data);
  const settings = useLog((s) => s.settings);
  const activeId = useLog((s) => s.activeWorkoutId);
  const deleteActivity = useLog((s) => s.deleteActivity);

  const items = useMemo<Item[]>(() => {
    const workouts: Item[] = data.workouts
      .filter((w) => w.id !== activeId)
      .map((w) => {
        const sets = data.sets.filter((x) => x.workoutId === w.id);
        const vol = sessionMuscleVolume(sets, settings);
        const end = w.endedAt ?? Math.max(w.startedAt, ...sets.map((x) => x.completedAt));
        return {
          kind: 'workout',
          at: w.startedAt,
          id: w.id,
          durationMin: Math.max(1, Math.round((end - w.startedAt) / 60_000)),
          hardSets: sets.reduce((a, x) => a + setValue(x, settings), 0),
          muscles: (Object.entries(vol) as [MuscleId, number][]).filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]).map(([m]) => m),
        };
      });
    const acts: Item[] = data.activities.map((a) => ({ kind: 'activity', at: a.startedAt, id: a.id, type: a.type, durationMin: a.durationMin, difficulty: a.difficulty }));
    return [...workouts, ...acts].sort((a, b) => b.at - a.at);
  }, [data, settings, activeId]);

  return (
    <Screen>
      <Text style={font.h1}>History</Text>
      {items.length === 0 && <Text style={[font.sub, { marginTop: space(4) }]}>Nothing logged yet.</Text>}
      {items.map((it) =>
        it.kind === 'workout' ? (
          <Card key={it.id} style={{ marginTop: space(3) }} onPress={() => router.push(`/workout/${it.id}`)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={font.h3}>{formatDate(it.at)}</Text>
              <Text style={font.sub}>{formatDuration(it.durationMin)} · {round1(it.hardSets)} hard sets</Text>
            </Row>
            <Text style={[font.sub, { marginTop: 4 }]}>{it.muscles.slice(0, 5).map((m) => muscleInfo(m).name).join(' · ') || 'No hard sets'}</Text>
          </Card>
        ) : (
          <Pressable key={it.id} onLongPress={() => confirm('Delete activity?', '', 'Delete', () => deleteActivity(it.id))}>
            <View style={{ marginTop: space(3), paddingHorizontal: space(4), paddingVertical: space(3), borderRadius: 14, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={font.body}>{getActivityType(it.type).emoji} {getActivityType(it.type).name}</Text>
                <Text style={font.sub}>{formatDate(it.at)} · {it.durationMin} min · {it.difficulty}/10</Text>
              </Row>
            </View>
          </Pressable>
        ),
      )}
    </Screen>
  );
}
