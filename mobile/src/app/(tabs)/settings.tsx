import { Text, View } from 'react-native';
import { Button, Card, Chip, Label, Row, Screen, Segmented, Stepper } from '../../components/ui';
import { MUSCLES } from '../../domain/regions';
import { REFERENCES } from '../../domain/references';
import { DEFAULT_SETTINGS } from '../../domain/settings';
import type { Settings } from '../../domain/types';
import { INSIGHT_KIND_LABELS, type InsightKind } from '../../insights/engine';
import { confirm } from '../../lib/confirm';
import { colors, font, space } from '../../lib/theme';
import { useLog } from '../../store/log';
import { syncEnabled, useAccount } from '../../sync/account';
import { ago } from '../../lib/derived';

type NumKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];

const RULES: { key: NumKey; label: string; hint: string; step?: number; min?: number; max?: number }[] = [
  { key: 'windowMinHours', label: 'Shortest growth window (h)', hint: 'Window after a light dose (1 hard set).', step: 2, min: 12, max: 72 },
  { key: 'windowMaxHours', label: 'Longest growth window (h)', hint: 'Window after a full dose.', step: 2, min: 12, max: 96 },
  { key: 'windowFullDose', label: 'Sets for the longest window', hint: 'Hard sets on a region in one session to reach the longest window.', min: 1, max: 10 },
  { key: 'weeklySetsLow', label: 'Weekly sets — low', hint: 'Bottom of the weekly range per muscle.', min: 0, max: 30 },
  { key: 'weeklySetsHigh', label: 'Weekly sets — high', hint: 'Top of the weekly range per muscle.', min: 1, max: 40 },
  { key: 'prioritySetsHigh', label: 'Priority muscle — high', hint: 'Top of the range for priority muscles.', min: 1, max: 40 },
  { key: 'sessionSetCap', label: 'Sets per muscle per session', hint: 'Past this, extra sets get flagged as better spent another day.', min: 1, max: 20 },
  { key: 'fullSetMaxRir', label: 'Full hard set at RIR ≤', hint: 'Sets this close to failure count as 1 hard set.', min: 0, max: 6 },
  { key: 'halfSetMaxRir', label: 'Half set at RIR ≤', hint: 'Sets up to this RIR count as half a set.', min: 0, max: 8 },
  { key: 'defaultRir', label: 'Assumed RIR when blank', hint: 'Used for sets logged without RIR.', min: 0, max: 6 },
];

export default function SettingsScreen() {
  const settings = useLog((s) => s.settings);
  const update = useLog((s) => s.updateSettings);
  const loadSample = useLog((s) => s.loadSample);
  const clearAll = useLog((s) => s.clearAll);

  const togglePriority = (id: Settings['priorityMuscles'][number]) =>
    update({ priorityMuscles: settings.priorityMuscles.includes(id) ? settings.priorityMuscles.filter((m) => m !== id) : [...settings.priorityMuscles, id] });

  const toggleMute = (k: InsightKind) =>
    update({ mutedInsights: settings.mutedInsights.includes(k) ? settings.mutedInsights.filter((m) => m !== k) : [...settings.mutedInsights, k] });

  return (
    <Screen>
      <Text style={font.h1}>Settings</Text>
      <Text style={[font.sub, { marginTop: 4, lineHeight: 19 }]}>Every number here is a guide. Tune it to how you train.</Text>

      {syncEnabled && <AccountSection />}

      <Label>Units</Label>
      <Segmented options={[{ value: 'lb', label: 'Pounds' }, { value: 'kg', label: 'Kilograms' }]} value={settings.units} onChange={(units) => update({ units })} />

      <Label>Priority muscles</Label>
      <Text style={[font.sub, { marginBottom: space(3) }]}>Get a higher weekly range and a nudge to train them early.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {MUSCLES.map((m) => <Chip key={m.id} label={m.name} active={settings.priorityMuscles.includes(m.id)} onPress={() => togglePriority(m.id)} color={colors.celebrate} />)}
      </View>

      <Label>Rules</Label>
      <Card>
        {RULES.map((r, i) => (
          <View key={r.key} style={{ paddingVertical: space(3), borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: space(3) }}>
                <Text style={font.body}>{r.label}</Text>
                <Text style={[font.sub, { marginTop: 2 }]}>{r.hint}</Text>
              </View>
              <Stepper value={settings[r.key]} onChange={(v) => update({ [r.key]: v } as Partial<Settings>)} step={r.step ?? 1} min={r.min} max={r.max} />
            </Row>
          </View>
        ))}
        <Button small kind="ghost" title="Reset rules to defaults" onPress={() => update(Object.fromEntries(RULES.map((r) => [r.key, DEFAULT_SETTINGS[r.key]])) as Partial<Settings>)} style={{ alignSelf: 'flex-start', marginTop: space(2) }} />
      </Card>

      <Label>Insights</Label>
      <Card>
        {(Object.keys(INSIGHT_KIND_LABELS) as InsightKind[]).map((k) => (
          <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={font.body}>{INSIGHT_KIND_LABELS[k]}</Text>
            <Chip label={settings.mutedInsights.includes(k) ? 'Muted' : 'On'} active={!settings.mutedInsights.includes(k)} onPress={() => toggleMute(k)} />
          </Row>
        ))}
      </Card>

      <Label>The science</Label>
      <Card>
        {REFERENCES.map((r, i) => (
          <View key={r.topic} style={{ paddingVertical: space(2), borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
            <Text style={font.h3}>{r.topic}</Text>
            <Text style={[font.sub, { marginTop: 2, lineHeight: 18 }]}>{r.claim}</Text>
            <Text style={{ color: colors.faint, fontSize: 12, marginTop: 2, fontStyle: 'italic' }}>{r.source}</Text>
          </View>
        ))}
      </Card>

      <Label>Data</Label>
      <Button kind="secondary" title="Load sample data" onPress={() => confirm('Load sample data?', 'This replaces your current log with 6 weeks of example training.', 'Replace', loadSample)} />
      <Button kind="danger" title="Erase all data" onPress={() => confirm('Erase everything?', 'All workouts, sets and activities will be deleted.', 'Erase', clearAll)} style={{ marginTop: space(2) }} />
    </Screen>
  );
}

function AccountSection() {
  const { signedIn, email, status, lastSyncedAt, error, signInWithApple, signOut, syncNow } = useAccount();
  return (
    <>
      <Label>Account & backup</Label>
      <Card>
        {signedIn ? (
          <>
            <Text style={font.body}>{email ?? 'Signed in with Apple'}</Text>
            <Text style={[font.sub, { marginTop: 4 }]}>
              {status === 'syncing' ? 'Syncing…' : status === 'error' ? `Sync failed: ${error}` : lastSyncedAt ? `Backed up ${ago(Date.now() - lastSyncedAt)}` : 'Not synced yet'}
            </Text>
            <Row style={{ marginTop: space(3), gap: space(2) }}>
              <Button small kind="secondary" title="Sync now" onPress={syncNow} />
              <Button small kind="ghost" title="Sign out" onPress={signOut} />
            </Row>
          </>
        ) : (
          <>
            <Text style={[font.sub, { lineHeight: 19 }]}>Sign in to back up your log and keep it when you switch phones. Logbook works fully offline either way.</Text>
            <Button title=" Sign in with Apple" onPress={signInWithApple} style={{ marginTop: space(3), backgroundColor: '#fff' }} />
            {error && <Text style={[font.sub, { color: colors.danger, marginTop: space(2) }]}>{error}</Text>}
          </>
        )}
      </Card>
    </>
  );
}
