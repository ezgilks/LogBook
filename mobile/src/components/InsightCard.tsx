import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Insight } from '../insights/engine';
import { colors, font, space } from '../lib/theme';
import { Card, Row } from './ui';

const TONE: Record<Insight['tone'], { color: string; icon: string }> = {
  celebrate: { color: colors.celebrate, icon: '★' },
  nudge: { color: colors.nudge, icon: '◐' },
  info: { color: colors.info, icon: 'i' },
};

export function InsightCard({ insight, onMute }: { insight: Insight; onMute?: () => void }) {
  const [open, setOpen] = useState(false);
  const tone = TONE[insight.tone];
  return (
    <Card style={{ marginBottom: space(3), borderLeftWidth: 3, borderLeftColor: tone.color }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: tone.color + '22', alignItems: 'center', justifyContent: 'center', marginRight: space(3) }}>
          <Text style={{ color: tone.color, fontWeight: '800', fontSize: 12 }}>{tone.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[font.h3, { marginBottom: 4 }]}>{insight.title}</Text>
          <Text style={[font.sub, { lineHeight: 19 }]}>{insight.body}</Text>
          <Row style={{ marginTop: space(2) }}>
            <Pressable hitSlop={8} onPress={() => setOpen((o) => !o)}>
              <Text style={{ color: tone.color, fontWeight: '700', fontSize: 13 }}>{open ? 'Hide why' : 'Why?'}</Text>
            </Pressable>
            {onMute && (
              <Pressable hitSlop={8} onPress={onMute} style={{ marginLeft: space(5) }}>
                <Text style={{ color: colors.faint, fontWeight: '600', fontSize: 13 }}>Mute these</Text>
              </Pressable>
            )}
          </Row>
          {open && <Text style={[font.sub, { marginTop: space(2), lineHeight: 19, color: colors.text, opacity: 0.8 }]}>{insight.why}</Text>}
        </View>
      </Row>
    </Card>
  );
}
