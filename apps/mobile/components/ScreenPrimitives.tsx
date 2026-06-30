import React from 'react'
import {
  Pressable,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
  type StyleProp,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { C, F, RADIUS } from '../lib/tokens'

export const SCREEN = {
  edge: 18,
  tabHeaderX: 22,
  tabHeaderTop: 16,
  stackHeaderTop: 14,
  bottom: 34,
  sectionGap: 12,
} as const

type Children = {
  children: React.ReactNode
}

type StyledViewProps = Children & {
  style?: StyleProp<ViewStyle>
}

export function ScreenRoot({ children, style }: StyledViewProps) {
  return <View style={[p.root, style]}>{children}</View>
}

export function ScreenScroll({
  children,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
  ...props
}: ScrollViewProps & Children) {
  return (
    <ScrollView
      style={p.scroll}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      {...props}
    >
      {children}
    </ScrollView>
  )
}

export function ScreenBody({ children, style }: StyledViewProps) {
  return <View style={[p.body, style]}>{children}</View>
}

type ScreenHeaderProps = {
  title: string
  topInset: number
  right?: React.ReactNode
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
  titleStyle?: StyleProp<TextStyle>
}

export function ScreenHeader({ title, topInset, right, children, style, titleStyle }: ScreenHeaderProps) {
  return (
    <View style={[p.tabHeader, { paddingTop: topInset + SCREEN.tabHeaderTop }, style]}>
      {children ?? <Text style={[p.tabTitle, titleStyle]}>{title}</Text>}
      {right}
    </View>
  )
}

type BackScreenHeaderProps = {
  title: string
  topInset: number
  onBack: () => void
  right?: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function BackScreenHeader({ title, topInset, onBack, right, style }: BackScreenHeaderProps) {
  return (
    <View style={[p.stackHeader, { paddingTop: topInset + SCREEN.stackHeaderTop }, style]}>
      <Pressable style={p.backButton} onPress={onBack} accessibilityLabel="Go back">
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M15 18 9 12l6-6" />
        </Svg>
      </Pressable>
      <Text style={p.stackTitle} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  )
}

type SurfaceCardProps = StyledViewProps & {
  elevated?: boolean
}

export function SurfaceCard({ children, elevated = false, style }: SurfaceCardProps) {
  return <View style={[p.card, elevated && p.cardElevated, style]}>{children}</View>
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[p.divider, style]} />
}

export function SectionLabel({ children, style }: Children & { style?: StyleProp<TextStyle> }) {
  return <Text style={[p.sectionLabel, style]}>{children}</Text>
}

type SectionHeaderProps = {
  title: string
  action?: React.ReactNode
  style?: StyleProp<ViewStyle>
  titleStyle?: StyleProp<TextStyle>
}

export function SectionHeader({ title, action, style, titleStyle }: SectionHeaderProps) {
  return (
    <View style={[p.sectionHeader, style]}>
      <Text style={[p.sectionTitle, titleStyle]}>{title}</Text>
      {action}
    </View>
  )
}

type InfoRowProps = {
  label: string
  value: string | number
  valueLines?: number
  style?: StyleProp<ViewStyle>
}

export function InfoRow({ label, value, valueLines = 1, style }: InfoRowProps) {
  return (
    <View style={[p.infoRow, style]}>
      <Text style={p.infoLabel}>{label}</Text>
      <Text style={p.infoValue} numberOfLines={valueLines}>{String(value)}</Text>
    </View>
  )
}

type EmptyStateProps = {
  title?: string
  message?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function EmptyState({ title, message, action, icon, style }: EmptyStateProps) {
  return (
    <View style={[p.emptyState, style]}>
      {icon}
      {title ? <Text style={p.emptyTitle}>{title}</Text> : null}
      {message ? <Text style={p.emptyText}>{message}</Text> : null}
      {action}
    </View>
  )
}

const p = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  body: { paddingHorizontal: SCREEN.edge, gap: SCREEN.sectionGap, paddingBottom: SCREEN.bottom },
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN.tabHeaderX,
    paddingBottom: 10,
  },
  tabTitle: { fontSize: 23, fontFamily: F.extrabold, color: C.ink },
  stackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: SCREEN.edge,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  stackTitle: { flex: 1, fontSize: 21, fontFamily: F.extrabold, color: C.ink },
  card: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  cardElevated: {
    shadowColor: '#14281E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  divider: { height: 1, backgroundColor: C.line },
  sectionLabel: {
    fontSize: 10.5,
    fontFamily: F.bold,
    letterSpacing: 0.7,
    color: C.ink3,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontFamily: F.extrabold, color: C.ink },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  infoLabel: { flex: 1, fontSize: 13, fontFamily: F.regular, color: C.ink3 },
  infoValue: {
    maxWidth: '54%',
    textAlign: 'right',
    fontSize: 13,
    fontFamily: F.semibold,
    color: C.ink,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: { fontSize: 15, fontFamily: F.extrabold, color: C.ink, textAlign: 'center' },
  emptyText: { fontSize: 13, fontFamily: F.regular, color: C.ink3, lineHeight: 19, textAlign: 'center' },
})
