import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { C } from '../lib/tokens'

type SheetProps = {
  visible: boolean
  onClose: () => void
  onOpen?: () => void
  children: React.ReactNode
  heightFraction?: number
}

export function Sheet({ visible, onClose, onOpen, children, heightFraction = 0.80 }: SheetProps) {
  const insets = useSafeAreaInsets()
  const screenHeight = Dimensions.get('window').height
  const sheetHeight = screenHeight * heightFraction

  const translateY = useSharedValue(sheetHeight)
  const backdropOpacity = useSharedValue(0)
  const onCloseRef = useRef(onClose)
  const onOpenRef = useRef(onOpen)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { onOpenRef.current = onOpen }, [onOpen])

  // Stays true until exit animation finishes so Modal doesn't unmount early
  const [localVisible, setLocalVisible] = useState(visible)

  const keyboardVisible = useRef(false)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => { keyboardVisible.current = true })
    const hide = Keyboard.addListener('keyboardDidHide', () => { keyboardVisible.current = false })
    return () => { show.remove(); hide.remove() }
  }, [])

  // Used by the gesture path: animation already done, just hide + notify
  const hideAfterGesture = useCallback(() => {
    setLocalVisible(false)
    onCloseRef.current()
  }, [])

  useEffect(() => {
    if (visible) {
      setLocalVisible(true)
      backdropOpacity.value = withTiming(1, { duration: 220 })
      translateY.value = withSpring(0, { damping: 28, stiffness: 280, mass: 0.8 }, (finished) => {
        if (finished && onOpenRef.current) runOnJS(onOpenRef.current)()
      })
    } else {
      const startExit = () => {
        backdropOpacity.value = withTiming(0, { duration: 180 })
        translateY.value = withTiming(sheetHeight, { duration: 220, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(setLocalVisible)(false)
        })
      }
      if (keyboardVisible.current) {
        Keyboard.dismiss()
        const timer = setTimeout(startExit, 100)
        return () => clearTimeout(timer)
      } else {
        startExit()
      }
    }
  }, [visible])

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const pan = Gesture.Pan()
    .activeOffsetY([5, 1000])
    .onBegin(() => {
      cancelAnimation(translateY)
    })
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY
      }
    })
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 500) {
        translateY.value = withTiming(
          sheetHeight,
          { duration: 200, easing: Easing.out(Easing.cubic) },
          (finished) => { if (finished) runOnJS(hideAfterGesture)() },
        )
        backdropOpacity.value = withTiming(0, { duration: 200 })
      } else {
        translateY.value = withSpring(0, { damping: 28, stiffness: 280, mass: 0.8 })
      }
    })
    .onFinalize((_e, success) => {
      if (!success) {
        translateY.value = withSpring(0, { damping: 28, stiffness: 280, mass: 0.8 })
      }
    })

  return (
    <Modal
      visible={localVisible}
      transparent
      animationType="none"
      onRequestClose={() => onCloseRef.current()}
      statusBarTranslucent
    >
      {/* Backdrop — tap to close */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => onCloseRef.current()}>
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]} />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[
          s.sheet,
          { height: sheetHeight, paddingBottom: Math.max(insets.bottom, 8) },
          sheetStyle,
        ]}
      >
        {/* Drag pill — Gesture scoped here only */}
        <GestureDetector gesture={pan}>
          <View style={s.dragZone}>
            <View style={s.handle} />
          </View>
        </GestureDetector>

        {/* Content — children own their own gestures */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {children}
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  dragZone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.line,
  },
})
