import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button, Chip, Label, Row, Screen, Stepper } from '../../components/ui';
import { ACTIVITY_TYPES } from '../../domain/activities';
import { successHaptic } from '../../lib/haptics';
import { colors, font, radius, space } from '../../lib/theme';
import { useLog } from '../../store/log';

const WHEN = [
  { label: 'Just now', hoursAgo: 0 },
  { label: 'Earlier today', hoursAgo: 4 },
  { label: 'Yesterday', hoursAgo: 24 },
];

const DIFFICULTY_HINT = ['', 'Barely anything', 'Very easy', 'Easy (shooting around)', 'Light', 'Moderate', 'Solid effort', 'Hard', 'Very hard (full court)', 'Brutal', 'Max effort'];

export default function NewActivity() {
  const addActivity = useLog((s) => s.addActivity);
  const [type, setType] = useState('basketball');
  const [duration, setDuration] = useState(60);
  const [difficulty, setDifficulty] = useState(6);
  const [when, setWhen] = useState(0);
  const [notes, setNotes] = useState('');

  const save = () => {
    const end = Date.now() - WHEN[when].hoursAgo * 3_600_000;
    addActivity({ type, startedAt: end - duration * 60_000, durationMin: duration, difficulty, notes });
    successHaptic();
    router.back();
  };

  return (
    <Screen edges={[]}>
      <Label style={{ marginTop: 0 }}>Activity</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {ACTIVITY_TYPES.map((a) => <Chip key={a.id} label={`${a.emoji} ${a.name}`} active={type === a.id} onPress={() => setType(a.id)} />)}
      </View>

      <Label>Duration (minutes)</Label>
      <Row>
        <Stepper value={duration} onChange={setDuration} step={5} min={5} max={600} />
      </Row>

      <Label>Difficulty</Label>
      <Row style={{ gap: 4 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => (
          <Text
            key={d}
            onPress={() => setDifficulty(d)}
            style={{ flex: 1, textAlign: 'center', paddingVertical: 10, borderRadius: radius.sm, overflow: 'hidden', fontWeight: '700', color: difficulty === d ? '#06140C' : colors.sub, backgroundColor: difficulty === d ? colors.grow : colors.cardHi }}
          >
            {d}
          </Text>
        ))}
      </Row>
      <Text style={[font.sub, { marginTop: space(2) }]}>{DIFFICULTY_HINT[difficulty]} · load {duration * difficulty}</Text>

      <Label>When</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {WHEN.map((w, i) => <Chip key={w.label} label={w.label} active={when === i} onPress={() => setWhen(i)} />)}
      </View>

      <Label>Notes</Label>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        placeholderTextColor={colors.faint}
        style={{ backgroundColor: colors.card, color: colors.text, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space(3), fontSize: 15 }}
      />

      <Text style={[font.sub, { marginTop: space(4), lineHeight: 19 }]}>
        Outside activities count as fatigue only — they don’t open growth windows or add to your set counts.
      </Text>
      <Button title="Save activity" onPress={save} style={{ marginTop: space(4) }} />
    </Screen>
  );
}
