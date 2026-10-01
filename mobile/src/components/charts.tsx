import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { DAY } from '../metrics/hardSets';
import { mergeWindows, type GrowthWindow } from '../metrics/windows';
import { colors } from '../lib/theme';

/** 7-day strip: green where the muscle/region was inside a growth window, ticks at sessions. */
export function WindowTimeline({ windows, now, days = 7, width = 300, height = 14 }: {
  windows: GrowthWindow[]; now: number; days?: number; width?: number; height?: number;
}) {
  const from = now - days * DAY;
  const x = (t: number) => ((Math.min(Math.max(t, from), now) - from) / (now - from)) * width;
  return (
    <Svg width={width} height={height + 6}>
      <Rect x={0} y={3} width={width} height={height} rx={height / 2} fill={colors.idle} />
      {mergeWindows(windows).filter((w) => w.end > from).map((w, i) => (
        <Rect key={i} x={x(w.start)} y={3} width={Math.max(2, x(w.end) - x(w.start))} height={height} rx={height / 2} fill={colors.grow} opacity={0.85} />
      ))}
      {windows.filter((w) => w.start >= from).map((w, i) => (
        <Rect key={`t${i}`} x={x(w.start) - 1} y={0} width={2} height={height + 6} rx={1} fill={colors.text} />
      ))}
      {Array.from({ length: days - 1 }, (_, i) => (
        <Rect key={`d${i}`} x={((i + 1) / days) * width} y={3 + height * 0.35} width={1} height={height * 0.3} fill={colors.bg} opacity={0.6} />
      ))}
    </Svg>
  );
}

/** Weekly hard sets against a soft range band. */
export function RangeBar({ value, low, high, width = 300 }: { value: number; low: number; high: number; width?: number }) {
  const max = Math.max(high * 1.5, value * 1.1, 1);
  const x = (v: number) => (v / max) * width;
  const inRange = value >= low && value <= high;
  return (
    <Svg width={width} height={12}>
      <Rect x={0} y={4} width={width} height={4} rx={2} fill={colors.idle} />
      <Rect x={x(low)} y={2} width={x(high) - x(low)} height={8} rx={4} fill={colors.grow} opacity={0.18} />
      <Rect x={0} y={4} width={Math.max(0, x(value))} height={4} rx={2} fill={inRange ? colors.grow : colors.info} />
      <Circle cx={Math.max(4, x(value))} cy={6} r={4} fill={inRange ? colors.grow : colors.info} />
    </Svg>
  );
}

/** Minimal line chart for e1RM over time. */
export function LineChart({ points, width = 320, height = 140, format }: {
  points: { at: number; value: number }[]; width?: number; height?: number; format: (v: number) => string;
}) {
  if (points.length < 2) {
    return <Text style={{ color: colors.sub, fontSize: 13 }}>Log this lift in two sessions to see a trend.</Text>;
  }
  const pad = 8;
  const t0 = points[0].at;
  const t1 = points[points.length - 1].at;
  const vs = points.map((p) => p.value);
  const lo = Math.min(...vs) * 0.97;
  const hi = Math.max(...vs) * 1.02;
  const x = (t: number) => pad + ((t - t0) / Math.max(t1 - t0, 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / Math.max(hi - lo, 1e-6)) * (height - pad * 2);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${d} L${x(t1)},${height - pad} L${x(t0)},${height - pad} Z`;
  const last = points[points.length - 1];
  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={pad} x2={width - pad} y1={y(hi)} y2={y(hi)} stroke={colors.border} strokeDasharray="3 4" />
        <Line x1={pad} x2={width - pad} y1={y(lo)} y2={y(lo)} stroke={colors.border} strokeDasharray="3 4" />
        <Path d={area} fill={colors.grow} opacity={0.08} />
        <Path d={d} stroke={colors.grow} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <Circle key={i} cx={x(p.at)} cy={y(p.value)} r={i === points.length - 1 ? 4.5 : 2.5} fill={i === points.length - 1 ? colors.grow : colors.growDim} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ color: colors.faint, fontSize: 11 }}>{format(lo / 0.97)}</Text>
        <Text style={{ color: colors.grow, fontSize: 11, fontWeight: '700' }}>Latest {format(last.value)}</Text>
      </View>
    </View>
  );
}

/** Horizontal bar for joint-action / distribution lists. */
export function Bar({ value, max, width = 160, color = colors.grow }: { value: number; max: number; width?: number; color?: string }) {
  return (
    <Svg width={width} height={8}>
      <Rect x={0} y={0} width={width} height={8} rx={4} fill={colors.idle} />
      <Rect x={0} y={0} width={Math.max(4, (value / Math.max(max, 1)) * width)} height={8} rx={4} fill={color} />
    </Svg>
  );
}
