import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { addMonths, formatMonthLabel, toYearMonth } from '@paisa-buddy/shared/logic/date'
import { formatAmount } from '@paisa-buddy/shared/logic/amount'
import { C, F, RADIUS } from '../lib/tokens'
import { Sheet } from './Sheet'

export type MonthPreset = 'this-month' | 'last-month' | 'last-3-months'

type MonthSelectionSheetProps = {
  visible: boolean
  selectedMonth: string
  monthlySpends: Record<string, number>
  onClose: () => void
  onSelectMonth: (month: string) => void
  onSelectPreset?: (preset: MonthPreset) => void
}

type MonthSection = {
  year: string
  months: string[]
}

function buildMonthOptions(selectedMonth: string, monthlySpends: Record<string, number>): MonthSection[] {
  const now = toYearMonth(new Date())
  const months = new Set<string>([selectedMonth, now])

  for (let i = 0; i < 12; i += 1) {
    months.add(addMonths(now, -i))
  }

  for (const month of Object.keys(monthlySpends)) {
    months.add(month)
  }

  const sorted = [...months].sort((left, right) => right.localeCompare(left))
  const grouped = new Map<string, string[]>()

  for (const month of sorted) {
    const year = month.slice(0, 4)
    grouped.set(year, [...(grouped.get(year) ?? []), month])
  }

  return [...grouped.entries()].map(([year, sectionMonths]) => ({
    year,
    months: sectionMonths,
  }))
}

export function MonthSelectionSheet({
  visible,
  selectedMonth,
  monthlySpends,
  onClose,
  onSelectMonth,
  onSelectPreset,
}: MonthSelectionSheetProps) {
  const thisMonth = toYearMonth(new Date())
  const lastMonth = addMonths(thisMonth, -1)
  const sections = buildMonthOptions(selectedMonth, monthlySpends)

  function selectMonth(month: string) {
    onSelectMonth(month)
    onClose()
  }

  function selectPreset(preset: MonthPreset, month?: string) {
    onSelectPreset?.(preset)
    if (month) selectMonth(month)
  }

  const quickOptions: { key: MonthPreset; title: string; month?: string }[] = [
    { key: 'this-month', title: 'This Month', month: thisMonth },
    { key: 'last-month', title: 'Last Month', month: lastMonth },
    { key: 'last-3-months', title: 'Last 3 Months' },
  ]

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      heightFraction={0.72}
      header={(
        <View style={s.headerWrap}>
          <View style={s.header}>
            <Text style={s.title}>Select Month</Text>
            <Pressable onPress={onClose}>
              <Text style={s.done}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}
    >
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.quickSection}>
          <Text style={s.sectionTitle}>Quick Select</Text>
          <View style={s.quickRow}>
            {quickOptions.map((option) => (
              <Pressable
                key={option.key}
                style={s.quickTile}
                onPress={() => selectPreset(option.key, option.month)}
              >
                <Text style={s.quickTitle} numberOfLines={2}>{option.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.monthSections}>
          {sections.map((section) => (
            <View key={section.year} style={s.monthSection}>
              <Text style={s.yearTitle}>{section.year}</Text>
              <View style={s.monthList}>
                {section.months.map((month, idx) => {
                  const selected = month === selectedMonth
                  const spends = monthlySpends[month] ?? 0
                  return (
                    <Pressable
                      key={month}
                      style={[s.monthRow, idx < section.months.length - 1 && s.monthRowBorder]}
                      onPress={() => selectMonth(month)}
                    >
                      <Text style={s.monthLabel}>{formatMonthLabel(month)}</Text>
                      <View style={s.monthRight}>
                        <Text style={s.spendText}>{formatAmount(spends)}</Text>
                        <View style={s.tickSlot}>
                          {selected ? (
                            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                              <Path d="M20 6 9 17l-5-5" />
                            </Svg>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </Sheet>
  )
}

const s = StyleSheet.create({
  headerWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontFamily: F.semibold, color: C.ink },
  done: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 18, paddingBottom: 36 },
  quickSection: { gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: F.extrabold, color: C.ink },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickTile: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: C.brandPale,
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: { fontSize: 13, lineHeight: 17, fontFamily: F.semibold, color: C.ink },
  monthSections: { gap: 16 },
  monthSection: { gap: 8 },
  yearTitle: { fontSize: 13, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.55 },
  monthList: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  monthRowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  monthLabel: { flex: 1, fontSize: 14, fontFamily: F.semibold, color: C.ink },
  monthRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 132 },
  spendText: { flex: 1, fontSize: 13, fontFamily: F.monoBold, color: C.ink2, textAlign: 'right' },
  tickSlot: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
})
