import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, space } from '../lib/theme';

export function Screen({ children, scroll = true, edges = ['top'] as ('top' | 'bottom')[] }: { children: ReactNode; scroll?: boolean; edges?: ('top' | 'bottom')[] }) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: space(6), marginBottom: space(2) }, style]}>
      <Text style={font.label}>{children}</Text>
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ title, onPress, kind = 'primary', disabled, style, small }: {
  title: string; onPress: () => void; kind?: ButtonKind; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const bg = kind === 'primary' ? colors.grow : kind === 'secondary' ? colors.cardHi : 'transparent';
  const fg = kind === 'primary' ? '#06140C' : kind === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        kind === 'secondary' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 13 : 16 }}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, color }: { label: string; active?: boolean; onPress?: () => void; color?: string }) {
  const c = color ?? colors.grow;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, active && { backgroundColor: c + '26', borderColor: c }]}
    >
      <Text style={{ color: active ? c : colors.sub, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, value === o.value && styles.segmentActive]}>
          <Text style={{ color: value === o.value ? colors.text : colors.sub, fontWeight: '600', fontSize: 13 }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, format }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; format?: (v: number) => string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  return (
    <View style={styles.stepper}>
      <Pressable hitSlop={8} onPress={() => onChange(clamp(value - step))} style={styles.stepBtn}>
        <Text style={styles.stepTxt}>−</Text>
      </Pressable>
      <Text style={styles.stepVal}>{format ? format(value) : value}</Text>
      <Pressable hitSlop={8} onPress={() => onChange(clamp(value + step))} style={styles.stepBtn}>
        <Text style={styles.stepTxt}>+</Text>
      </Pressable>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

export function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space(4), paddingBottom: space(16) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(4), borderWidth: 1, borderColor: colors.border },
  button: { height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(5) },
  buttonSmall: { height: 34, paddingHorizontal: space(3), borderRadius: radius.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border, marginRight: 8, marginBottom: 8 },
  segmented: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.sm, padding: 3, borderWidth: 1, borderColor: colors.border },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 6 },
  segmentActive: { backgroundColor: colors.cardHi },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardHi, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  stepBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: colors.text, fontSize: 22, fontWeight: '500' },
  stepVal: { color: colors.text, fontSize: 18, fontWeight: '700', minWidth: 56, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
