import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { C, F } from '../lib/tokens'
import type { TransactionType } from '@paisa-buddy/shared/types/transaction'

export type TypeOption = { value: TransactionType; label: string; color: string }

type Props = {
  types: TypeOption[]
  active: TransactionType
  onChange: (v: TransactionType) => void
}

export function TypePicker({ types, active, onChange }: Props) {
  const [tabWidth, setTabWidth] = useState(0)
  const pillX = useSharedValue(0)
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }))

  useEffect(() => {
    if (tabWidth === 0) return
    const idx = types.findIndex((t) => t.value === active)
    pillX.value = withTiming(idx * (tabWidth + 4), { duration: 200 })
  }, [active, tabWidth])

  return (
    <View
      style={s.typeBar}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width
        setTabWidth((w - 8 - (types.length - 1) * 4) / types.length)
      }}
    >
      <Animated.View style={[s.pill, { width: tabWidth }, pillStyle]} />
      {types.map((t) => (
        <Pressable key={t.value} onPress={() => onChange(t.value)} style={s.typeBtn}>
          <Text style={[s.typeBtnText, { color: active === t.value ? t.color : C.ink3 }]}>
            {t.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  typeBar: {
    flexDirection: 'row',
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', zIndex: 1 },
  pill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 8,
    backgroundColor: C.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  typeBtnText: { fontSize: 14, fontFamily: F.semibold },
})
