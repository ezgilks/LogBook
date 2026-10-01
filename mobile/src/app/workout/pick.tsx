import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Chip, Row } from '../../components/ui';
import { EXERCISES } from '../../domain/exercises';
import { MUSCLES, REGION_NAMES, muscleOf } from '../../domain/regions';
import type { Exercise, MuscleId, RegionId } from '../../domain/types';
import { colors, font, radius, space } from '../../lib/theme';
import { useLog } from '../../store/log';

function primaryMuscle(e: Exercise): MuscleId {
  const [top] = (Object.entries(e.regions) as [RegionId, number][]).sort((a, b) => b[1] - a[1]);
  return muscleOf(top[0]);
}

export default function PickExercise() {
  const addDraft = useLog((s) => s.addDraftExercise);
  const sets = useLog((s) => s.data.sets);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleId | null>(null);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sets) m.set(s.exerciseId, (m.get(s.exerciseId) ?? 0) + 1);
    return m;
  }, [sets]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return EXERCISES.filter((e) => (!needle || e.name.toLowerCase().includes(needle)) && (!muscle || primaryMuscle(e) === muscle || Object.keys(e.regions).some((r) => muscleOf(r as RegionId) === muscle && (e.regions[r as RegionId] ?? 0) >= 1)))
      .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  }, [q, muscle, usage]);

  const pick = (id: string) => {
    addDraft(id);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: space(4) }}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search exercises"
        placeholderTextColor={colors.faint}
        autoFocus
        style={{ backgroundColor: colors.card, color: colors.text, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space(4), height: 46, fontSize: 16 }}
      />
      <View style={{ marginTop: space(3), flexDirection: 'row', flexWrap: 'wrap' }}>
        {MUSCLES.map((m) => (
          <Chip key={m.id} label={m.name} active={muscle === m.id} onPress={() => setMuscle(muscle === m.id ? null : m.id)} />
        ))}
      </View>
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const regions = (Object.entries(item.regions) as [RegionId, number][]).filter(([, w]) => w >= 1).map(([r]) => REGION_NAMES[r]);
          return (
            <Pressable onPress={() => pick(item.id)} style={({ pressed }) => ({ paddingVertical: space(3), borderBottomWidth: 1, borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 })}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={font.body}>{item.name}</Text>
                {(usage.get(item.id) ?? 0) > 0 && <Text style={font.sub}>{usage.get(item.id)} sets</Text>}
              </Row>
              <Text style={[font.sub, { marginTop: 2 }]}>{regions.join(' · ')}{item.bias === 'lengthened' ? '  ·  stretch-biased' : ''}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
