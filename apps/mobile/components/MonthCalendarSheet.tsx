import React from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, { Circle, Polygon } from 'react-native-svg'
import { formatMonthLabel } from '@paisa-buddy/shared/logic/date'
import { C, F, RADIUS } from '../lib/tokens'
import { Sheet } from './Sheet'

type MonthCalendarSheetProps = {
  visible: boolean
  month: string
  transactionCounts: Record<string, number>
  onClose: () => void
}

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function dotCount(n: number): number {
  if (n === 0) return 0
  if (n === 1) return 1
  if (n <= 4) return 2
  return 3
}

function todayString(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function buildWeeks(month: string): Array<Array<number | null>> {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstDow = new Date(year, monthNumber - 1, 1).getDay()
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const cells: Array<number | null> = []

  for (let i = 0; i < firstDow; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: Array<Array<number | null>> = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
}

function dateString(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, '0')}`
}

function Dot() {
  return (
    <Svg width={4} height={4} viewBox="0 0 4 4">
      <Circle cx={2} cy={2} r={2} fill={C.brand} />
    </Svg>
  )
}

export function MonthCalendarSheet({
  visible,
  month,
  transactionCounts,
  onClose,
}: MonthCalendarSheetProps) {
  const weeks = buildWeeks(month)
  const today = todayString()
  const hasAnyTxThisMonth = Object.keys(transactionCounts).length > 0

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      heightFraction={0.58}
      header={(
        <View style={s.headerWrap}>
          <View style={s.header}>
            <Text style={s.title}>{formatMonthLabel(month)}</Text>
            <Pressable onPress={onClose}>
              <Text style={s.done}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}
    >
      <View style={s.content}>
        <View style={s.calendarCard}>
          <View style={s.weekRow}>
            {DAY_HEADERS.map((day) => (
              <Text key={day} style={s.weekLabel}>{day}</Text>
            ))}
          </View>
          {weeks.map((week, weekIdx) => (
            <View key={weekIdx} style={s.weekRow}>
              {week.map((day, dayIdx) => {
                if (!day) return <View key={`empty-${dayIdx}`} style={s.dayCell} />

                const date = dateString(month, day)
                const isToday = date === today
                const txCount = transactionCounts[date] ?? 0
                const dots = dotCount(txCount)
                const showStar = hasAnyTxThisMonth && date <= today && txCount === 0

                return (
                  <View key={date} style={s.dayCell}>
                    <View style={[s.dayCircle, isToday && s.dayCircleToday]}>
                      <Text style={[s.dayText, isToday && s.dayTextToday]}>{day}</Text>
                    </View>
                    <View style={s.dayMarkerRow}>
                      {showStar ? (
                        <Svg width={10} height={10} viewBox="0 0 24 24" fill={C.gold}>
                          <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </Svg>
                      ) : (
                        Array.from({ length: dots }, (_, dotIdx) => <Dot key={dotIdx} />)
                      )}
                    </View>
                  </View>
                )
              })}
            </View>
          ))}
        </View>
        <View style={s.legend}>
          <View style={s.legendRow}>
            <View style={s.legendMarker}>
              <Dot />
            </View>
            <Text style={s.legendText}>Dots show how many transactions were added on that day.</Text>
          </View>
          <View style={s.legendRow}>
            <View style={s.legendMarker}>
              <Svg width={10} height={10} viewBox="0 0 24 24" fill={C.gold}>
                <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </Svg>
            </View>
            <Text style={s.legendText}>Stars mark past days with no transactions recorded.</Text>
          </View>
        </View>
      </View>
    </Sheet>
  )
}

const s = StyleSheet.create({
  headerWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontFamily: F.semibold, color: C.ink },
  done: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  calendarCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },
  weekRow: { flexDirection: 'row' },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: F.medium,
    color: C.ink3,
    paddingVertical: 4,
  },
  dayCell: {
    flex: 1,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: { backgroundColor: C.brand },
  dayText: { fontSize: 13, fontFamily: F.regular, color: C.ink },
  dayTextToday: { fontFamily: F.semibold, color: '#fff' },
  dayMarkerRow: {
    height: 10,
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  legend: { paddingHorizontal: 4, paddingTop: 12, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendMarker: { width: 12, alignItems: 'center', justifyContent: 'center' },
  legendText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontFamily: F.regular, color: C.ink3 },
})
