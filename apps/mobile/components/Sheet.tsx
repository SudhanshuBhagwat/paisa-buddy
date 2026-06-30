import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
import { C, F } from '../lib/tokens'

type SheetProps = {
  visible: boolean
  onClose: () => void
  onOpen?: () => void
  onClosed?: () => void
  header?: React.ReactNode
  title?: string
  closeLabel?: string
  children: React.ReactNode
  heightFraction?: number
}

export function Sheet({
  visible,
  onClose,
  onOpen,
  onClosed,
  header,
  title,
  closeLabel = 'Cancel',
  children,
  heightFraction = 0.80,
}: SheetProps) {
  const insets = useSafeAreaInsets()
  const screenHeight = Dimensions.get('window').height
  const sheetHeight = screenHeight * heightFraction

  const translateY = useSharedValue(sheetHeight)
  const backdropOpacity = useSharedValue(0)
  const onCloseRef = useRef(onClose)
  const onOpenRef = useRef(onOpen)
  const onClosedRef = useRef(onClosed)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { onOpenRef.current = onOpen }, [onOpen])
  useEffect(() => { onClosedRef.current = onClosed }, [onClosed])

  // Stays true until exit animation finishes so Modal doesn't unmount early
  const [localVisible, setLocalVisible] = useState(visible)

  const keyboardVisible = useRef(false)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => { keyboardVisible.current = true })
    const hide = Keyboard.addListener('keyboardDidHide', () => { keyboardVisible.current = false })
    return () => { show.remove(); hide.remove() }
  }, [])

  const keyboardHeight = useSharedValue(0)
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, (e) => {
      keyboardHeight.value = withTiming(e.endCoordinates.height, {
        duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 180,
      })
    })
    const hide = Keyboard.addListener(hideEvent, (e) => {
      keyboardHeight.value = withTiming(0, {
        duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 180,
      })
    })
    return () => { show.remove(); hide.remove() }
  }, [keyboardHeight])

  // Used by the gesture path: animation already done, just hide + notify
  const hideAfterGesture = useCallback(() => {
    setLocalVisible(false)
    onCloseRef.current()
  }, [])

  const triggerOnClosed = useCallback(() => {
    onClosedRef.current?.()
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
          if (finished) {
            runOnJS(setLocalVisible)(false)
            runOnJS(triggerOnClosed)()
          }
        })
      }
      if (keyboardVisible.current) {
        Keyboard.dismiss()
        const timer = setTimeout(startExit, 150)
        return () => clearTimeout(timer)
      } else {
        startExit()
      }
    }
  }, [visible, sheetHeight])

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  // Cap upward shift so sheet never goes above safe area + 8px gap
  const maxKbdShift = Math.max(0, screenHeight - sheetHeight - insets.top - 8)

  const sheetStyle = useAnimatedStyle(() => {
    const kbdShift = Platform.OS === 'ios' ? Math.min(keyboardHeight.value, maxKbdShift) : 0
    return {
      transform: [{ translateY: translateY.value - kbdShift }],
    }
  })

  const renderedHeader = header ?? (title ? (
    <View style={s.actionHeader}>
      <Text style={s.actionTitle}>{title}</Text>
      <Pressable onPress={() => onCloseRef.current()} style={s.actionCloseBtn} hitSlop={8}>
        <Text style={s.actionCloseText}>{closeLabel}</Text>
      </Pressable>
    </View>
  ) : null)
  const hasHeader = !!renderedHeader

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

  if (!visible && !localVisible) return null

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
          {
            height: sheetHeight,
            paddingBottom: Math.max(insets.bottom, 8),
          },
          sheetStyle,
        ]}
      >
        {/* Drag pill — Gesture scoped here only */}
        <GestureDetector gesture={pan}>
          <View collapsable={false} style={hasHeader ? s.headerDragZone : s.dragZone}>
            <View style={s.handle} />
            {renderedHeader}
          </View>
        </GestureDetector>

        {/* Content — children own their own gestures */}
        <KeyboardAvoidingView
          style={[{ flex: 1 }, hasHeader && s.contentAfterHeader]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
  headerDragZone: {
    paddingTop: 10,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionTitle: { flex: 1, marginRight: 12, fontSize: 20, fontFamily: F.semibold, color: C.ink },
  actionCloseBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  actionCloseText: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },
  contentAfterHeader: { paddingTop: 8 },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.line,
  },
})
