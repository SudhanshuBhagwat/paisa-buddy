import { View, Text } from 'react-native';
import { useColors } from '@/utils/colors';

export type ChartSegment = {
  value: number;
  color: string;
  label: string;
};

type Props = {
  segments: ChartSegment[];
  total: number;
  centerLabel?: string;
  centerSublabel?: string;
};

export function SegmentChart({ segments, total, centerLabel, centerSublabel }: Props) {
  const Colors = useColors();
  const hasData = total > 0;

  return (
    <View style={{ gap: 16 }}>
      {/* Center label */}
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={{ fontSize: 32, fontWeight: '800', color: Colors.text, fontVariant: ['tabular-nums'], letterSpacing: -1 }}>
          {centerLabel ?? '—'}
        </Text>
        {centerSublabel && (
          <Text style={{ fontSize: 13, color: Colors.textSecondary, fontWeight: '500' }}>
            {centerSublabel}
          </Text>
        )}
      </View>

      {/* Segmented bar */}
      <View style={{ height: 14, flexDirection: 'row', borderRadius: 7, overflow: 'hidden', gap: 2, backgroundColor: Colors.surfaceRaised }}>
        {hasData ? (
          segments
            .filter((s) => s.value > 0)
            .map((seg, i) => (
              <View
                key={i}
                style={{
                  flex: seg.value / total,
                  backgroundColor: seg.color,
                  minWidth: 4,
                }}
              />
            ))
        ) : (
          <View style={{ flex: 1, backgroundColor: Colors.surfaceRaised }} />
        )}
      </View>

      {/* Color legend */}
      {hasData && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {segments.slice(0, 6).map((seg, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: seg.color }} />
              <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{seg.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
