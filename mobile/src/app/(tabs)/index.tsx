import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { BodyMap } from '../../components/BodyMap';
import { InsightCard } from '../../components/InsightCard';
import { Button, Card, Label, Row, Screen, Segmented } from '../../components/ui';
import { getActivityType } from '../../domain/activities';
import { MUSCLES, muscleOf } from '../../domain/regions';
import type { RegionId } from '../../domain/types';
import { todayInsights } from '../../insights/engine';
import { ago, muscleStatuses, regionStatuses, statusFill, useCtx } from '../../lib/derived';
import { colors, font, space } from '../../lib/theme';
import { fatigue, fatigueLevel } from '../../metrics/fatigue';
import { DAY } from '../../metrics/hardSets';
import { useLog } from '../../store/log';

export default function Today() {
  const ctx = useCtx();
  const activeWorkoutId = useLog((s) => s.activeWorkoutId);
  const startWorkout = useLog((s) => s.startWorkout);
  const loadSample = useLog((s) => s.loadSample);
  const settings = useLog((s) => s.settings);
  const updateSettings = useLog((s) => s.updateSettings);
  const [side, setSide] = useState<'front' | 'back'>('front');

  const regions = useMemo(() => regionStatuses(ctx), [ctx]);
  const muscles = useMemo(() => muscleStatuses(ctx), [ctx]);
  const fills = useMemo(() => {
    const out: Partial<Record<RegionId, string>> = {};
    for (const [r, st] of Object.entries(regions) as [RegionId, (typeof regions)[RegionId]][]) out[r] = statusFill(st);
    return out;
  }, [regions]);
  const insights = useMemo(() => todayInsights(ctx).slice(0, 4), [ctx]);
  const fat = useMemo(() => fatigue(ctx.data, ctx.settings, ctx.now), [ctx]);

  const growing = MUSCLES.filter((m) => muscles[m.id].state === 'growing');
  const empty = ctx.data.sets.length === 0 && ctx.data.activities.length === 0;
  const recentActivities = ctx.data.activities.filter((a) => ctx.now - a.startedAt < 2 * DAY).sort((a, b) => b.startedAt - a.startedAt);

  const start = () => {
    startWorkout();
    router.push('/workout');
  };

  return (
    <Screen>
      <Text style={font.label}>{new Date(ctx.now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      <Text style={[font.h1, { marginTop: 4 }]}>Today</Text>

      <Card style={{ marginTop: space(4), alignItems: 'center' }}>
        <Row style={{ alignSelf: 'stretch', justifyContent: 'space-between', marginBottom: space(2) }}>
          <View>
            <Text style={[font.num, { color: growing.length ? colors.grow : colors.text }]}>{growing.length}</Text>
            <Text style={font.sub}>muscle{growing.length === 1 ? '' : 's'} growing now</Text>
          </View>
          <View style={{ width: 150 }}>
            <Segmented options={[{ value: 'front', label: 'Front' }, { value: 'back', label: 'Back' }]} value={side} onChange={setSide} />
          </View>
        </Row>
        <BodyMap side={side} fills={fills} onPressRegion={(r) => router.push(`/muscle/${muscleOf(r)}`)} height={340} />
        <Row style={{ marginTop: space(2) }}>
          <Legend color={colors.grow} label="Growing" />
          <Legend color={colors.idleRecent} label="Closed < 24h" />
          <Legend color={colors.idle} label="Not growing" />
        </Row>
        {growing.length > 0 && (
          <Text style={[font.sub, { marginTop: space(3), textAlign: 'center' }]}>
            {growing.map((m) => {
              const st = muscles[m.id];
              return st.state === 'growing' ? `${m.name} ${Math.round(st.hoursLeft)}h` : m.name;
            }).join('  ·  ')}
          </Text>
        )}
      </Card>

      <Row style={{ marginTop: space(4), gap: space(3) }}>
        <Button title={activeWorkoutId ? 'Resume workout' : 'Start workout'} onPress={activeWorkoutId ? () => router.push('/workout') : start} style={{ flex: 1 }} />
        <Button title="Log activity" kind="secondary" onPress={() => router.push('/activity/new')} style={{ flex: 1 }} />
      </Row>

      {empty ? (
        <Card style={{ marginTop: space(6) }}>
          <Text style={font.h3}>Welcome to Logbook</Text>
          <Text style={[font.sub, { marginTop: space(2), lineHeight: 19 }]}>
            Muscles grow for roughly 36–48 hours after you train them. Log your sets and Logbook shows which muscles are
            growing right now, how much of your week they spend growing, and where your volume goes.
          </Text>
          <Button title="Explore with sample data" kind="secondary" onPress={loadSample} style={{ marginTop: space(4) }} />
        </Card>
      ) : (
        <>
          {insights.length > 0 && <Label>Insights</Label>}
          {insights.map((i) => (
            <InsightCard key={i.id} insight={i} onMute={() => updateSettings({ mutedInsights: [...settings.mutedInsights, i.kind] })} />
          ))}

          <Label>Recovery context</Label>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={font.body}>Whole-body fatigue</Text>
              <Text style={{ color: fatigueColor(fat.systemic), fontWeight: '700' }}>{fatigueLevel(fat.systemic)}</Text>
            </Row>
            {recentActivities.map((a) => {
              const t = getActivityType(a.type);
              return (
                <Text key={a.id} style={[font.sub, { marginTop: space(2) }]}>
                  {t.emoji} {t.name} · {a.durationMin} min at {a.difficulty}/10 · {ago(ctx.now - a.startedAt)}
                </Text>
              );
            })}
            {recentActivities.length === 0 && <Text style={[font.sub, { marginTop: space(2) }]}>No outside activities in the last 2 days.</Text>}
          </Card>
        </>
      )}
    </Screen>
  );
}

function fatigueColor(score: number) {
  const level = fatigueLevel(score);
  return level === 'fresh' ? colors.grow : level === 'moderate' ? colors.nudge : colors.info;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row style={{ marginHorizontal: space(2) }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, marginRight: 6 }} />
      <Text style={{ color: colors.sub, fontSize: 12 }}>{label}</Text>
    </Row>
  );
}
