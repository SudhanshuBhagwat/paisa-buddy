import React, { useEffect, useRef } from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

type AnimatedProgressBarProps = {
  progress: number
  trackStyle?: StyleProp<ViewStyle>
  fillStyle?: StyleProp<ViewStyle>
  duration?: number
  skipInitialAnimation?: boolean
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  return Math.max(0, Math.min(100, progress))
}

export function AnimatedProgressBar({
  progress,
  trackStyle,
  fillStyle,
  duration = 700,
  skipInitialAnimation = false,
}: AnimatedProgressBarProps) {
  const animatedProgress = useSharedValue(0)
  const hasAnimated = useRef(false)
  const clampedProgress = clampProgress(progress)

  useEffect(() => {
    if (hasAnimated.current || skipInitialAnimation) {
      animatedProgress.value = clampedProgress
      return
    }

    hasAnimated.current = true
    animatedProgress.value = 0
    animatedProgress.value = withTiming(clampedProgress, { duration })
  }, [animatedProgress, clampedProgress, duration, skipInitialAnimation])

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value}%` as `${number}%`,
  }))

  return (
    <Animated.View style={trackStyle}>
      <Animated.View style={[fillStyle, animatedFillStyle]} />
    </Animated.View>
  )
}
