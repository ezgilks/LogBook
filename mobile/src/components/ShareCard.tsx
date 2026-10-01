import { forwardRef } from 'react';
import { Text, View } from 'react-native';
import { getExercise } from '../domain/exercises';
import { MUSCLES } from '../domain/regions';
import { formatWeight } from '../domain/settings';
import type { RegionId, Settings } from '../domain/types';
import { formatDate, formatDuration, mix } from '../lib/derived';
import { colors, space } from '../lib/theme';
import { round1 } from '../metrics/hardSets';
import type { Recap } from '../metrics/recap';
import { BodyMap } from './BodyMap';

/** 9:16 recap card designed to be screenshotted / shared to stories. */
export const ShareCard = forwardRef<View, { recap: Recap; settings: Settings; width: number }>(function ShareCard({ recap, settings, width }, ref) {
  const fills: Partial<Record<RegionId, string>> = {};
  for (const [r, h] of Object.entries(recap.regionWindows) as [RegionId, number][]) {
    fills[r] = mix(colors.growDim, colors.grow, 0.4 + 0.6 * ((h - settings.windowMinHours) / Math.max(1, settings.windowMaxHours - settings.windowMinHours)));
  }
  const height = (width * 16) / 9;
  const lifts = recap.exercises
    .filter((e) => e.previousE1rm !== null && e.previousE1rm > 0 && !recap.prs.some((p) => p.exerciseId === e.exerciseId))
    .map((e) => ({ e, delta: (e.bestE1rm - e.previousE1rm!) / e.previousE1rm! }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);
  const opened = MUSCLES.filter((m) => recap.windows[m.id]);

  return (
    <View ref={ref} collapsable={false} style={{ width, height, backgroundColor: colors.bg, borderRadius: 24, padding: space(6), borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      <Text style={{ color: colors.grow, fontWeight: '800', letterSpacing: 2, fontSize: 12 }}>LOGBOOK</Text>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 26, marginTop: 6 }}>{formatDate(recap.workout.startedAt, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
      <View style={{ flexDirection: 'row', marginTop: space(4), gap: space(6) }}>
        <Stat value={formatDuration(recap.durationMin)} label="time" />
        <Stat value={String(round1(recap.hardSets))} label="hard sets" />
        <Stat value={String(recap.prs.length)} label={recap.prs.length === 1 ? 'PR' : 'PRs'} highlight={recap.prs.length > 0} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space(4), gap: space(2) }}>
        <BodyMap side="front" fills={fills} height={height * 0.36} />
        <BodyMap side="back" fills={fills} height={height * 0.36} />
      </View>
      <Text style={{ color: colors.sub, fontSize: 13, textAlign: 'center', marginTop: space(2) }}>
        {opened.length ? `Growing for the next ${Math.round(Math.max(...Object.values(recap.windows) as number[]))}h: ${opened.map((m) => m.name).join(', ')}` : 'No growth windows opened'}
      </Text>
      <View style={{ marginTop: 'auto' }}>
        {recap.prs.slice(0, 2).map((pr) => (
          <Text key={pr.exerciseId} style={{ color: colors.celebrate, fontWeight: '700', fontSize: 14, marginBottom: 4 }}>
            ★ {getExercise(pr.exerciseId)?.name} — {formatWeight(pr.set.weightKg, settings.units)} × {pr.set.reps}
          </Text>
        ))}
        {lifts.map(({ e, delta }) => (
          <Text key={e.exerciseId} style={{ color: colors.text, fontSize: 14, marginBottom: 4 }}>
            {getExercise(e.exerciseId)?.name}{' '}
            <Text style={{ color: delta > 0.001 ? colors.grow : colors.sub, fontWeight: '700' }}>
              {delta > 0.001 ? `↑ ${Math.round(delta * 1000) / 10}%` : delta < -0.001 ? `↓ ${Math.abs(Math.round(delta * 1000) / 10)}%` : '= same as last'}
            </Text>
          </Text>
        ))}
      </View>
    </View>
  );
});

function Stat({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <View>
      <Text style={{ color: highlight ? colors.celebrate : colors.text, fontSize: 24, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.sub, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
