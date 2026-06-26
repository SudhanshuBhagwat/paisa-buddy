import React, { useCallback } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { C, F } from '../lib/tokens'

type SwipeableRowProps = {
  children: React.ReactNode
  actionLabel: string
  actionColor?: string
  actionWidth?: number
  disabled?: boolean
  onAction: () => void
}

export function SwipeableRow({
  children,
  actionLabel,
  actionColor = C.neg,
  actionWidth = 88,
  disabled = false,
  onAction,
}: SwipeableRowProps) {
  const translateX = useSharedValue(0)
  const startX = useSharedValue(0)

  const close = useCallback(() => {
    translateX.value = withTiming(0, { duration: 140, easing: Easing.out(Easing.cubic) })
  }, [translateX])

  const handleAction = useCallback(() => {
    close()
    onAction()
  }, [close, onAction])

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-12, 12])
    .failOffsetY([-8, 8])
    .onBegin(() => {
      startX.value = translateX.value
    })
    .onUpdate((event) => {
      const nextX = Math.min(0, Math.max(-actionWidth, startX.value + event.translationX))
      translateX.value = nextX
    })
    .onEnd((event) => {
      const shouldOpen = translateX.value < -actionWidth * 0.42 || event.velocityX < -450
      translateX.value = shouldOpen
        ? withTiming(-actionWidth, { duration: 170, easing: Easing.out(Easing.cubic) })
        : withTiming(0, { duration: 140, easing: Easing.out(Easing.cubic) })
    })
    .onFinalize((_event, success) => {
      if (!success) {
        translateX.value = withTiming(0, { duration: 140, easing: Easing.out(Easing.cubic) })
      }
    })

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  return (
    <View style={s.root}>
      <View style={[s.actionWrap, { width: actionWidth, backgroundColor: actionColor }]}>
        <Pressable
          style={s.action}
          onPress={handleAction}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={s.actionText}>{actionLabel}</Text>
        </Pressable>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[s.content, rowStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    overflow: 'hidden',
    backgroundColor: C.surface,
  },
  actionWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: 13,
    fontFamily: F.bold,
    color: '#FFFFFF',
  },
  content: {
    backgroundColor: C.bg,
  },
})
