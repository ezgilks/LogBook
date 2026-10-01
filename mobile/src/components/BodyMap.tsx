import { memo } from 'react';
import { Platform } from 'react-native';
import Svg, { Circle, G, Polygon } from 'react-native-svg';
import type { RegionId } from '../domain/types';
import { colors } from '../lib/theme';
import { BACK, BASE, FRONT, mirror, toPoints, type Side } from './bodyShapes';

interface Props {
  side: Side;
  /** Fill color per region; regions without a fill use the neutral tone. */
  fills: Partial<Record<RegionId, string>>;
  selected?: RegionId | null;
  onPressRegion?: (r: RegionId) => void;
  height?: number;
}

// react-native-svg's responder props leak onto DOM nodes on web; use onClick there.
function pressProps(fn?: () => void): object {
  if (!fn) return {};
  return Platform.OS === 'web' ? { onClick: fn } : { onPress: fn };
}

function BodyMapImpl({ side, fills, selected, onPressRegion, height = 360 }: Props) {
  const shapes = side === 'front' ? FRONT : BACK;
  return (
    <Svg width={(height * 200) / 410} height={height} viewBox="0 0 200 410">
      <Circle cx={100} cy={26} r={17} fill={colors.never} />
      {BASE.flatMap((p, i) => [
        <Polygon key={`b${i}`} points={toPoints(p)} fill={colors.never} />,
        <Polygon key={`bm${i}`} points={toPoints(mirror(p))} fill={colors.never} />,
      ])}
      {(Object.entries(shapes) as [RegionId, [number, number][][]][]).map(([region, polys]) => {
        const fill = fills[region] ?? colors.idle;
        const isSel = selected === region;
        return (
          <G key={region} {...pressProps(onPressRegion && (() => onPressRegion(region)))}>
            {polys.flatMap((p, i) => [
              <Polygon key={`${i}l`} points={toPoints(p)} fill={fill} stroke={isSel ? colors.text : colors.bg} strokeWidth={isSel ? 1.6 : 1} strokeLinejoin="round" />,
              <Polygon key={`${i}r`} points={toPoints(mirror(p))} fill={fill} stroke={isSel ? colors.text : colors.bg} strokeWidth={isSel ? 1.6 : 1} strokeLinejoin="round" />,
            ])}
          </G>
        );
      })}
    </Svg>
  );
}

export const BodyMap = memo(BodyMapImpl);
