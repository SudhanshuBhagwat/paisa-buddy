import React from 'react'
import { Pressable, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { M } from '../lib/motion'
import { haptics } from '../lib/haptics'

type HapticType = 'selection' | 'light' | 'none'

type Props = {
  onPress?: () => void
  onLongPress?: () => void
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
  scale?: number
  haptic?: HapticType
  disabled?: boolean
  children: React.ReactNode
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number }
  accessibilityLabel?: string
  testID?: string
}

export function PressableScale({
  onPress,
  onLongPress,
  style,
  contentStyle,
  scale = M.scale.pressed,
  haptic = 'none',
  disabled,
  children,
  hitSlop,
  accessibilityLabel,
  testID,
}: Props) {
  const scaleValue = useSharedValue(1)
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleValue.value }] }))

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        scaleValue.value = withSpring(scale, M.spring)
        if (haptic === 'selection') haptics.selection()
        else if (haptic === 'light') haptics.lightImpact()
      }}
      onPressOut={() => {
        scaleValue.value = withSpring(1, M.spring)
      }}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={style}
    >
      <Animated.View style={[contentStyle, animStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  )
}
