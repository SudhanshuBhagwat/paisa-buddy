import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { C } from '../lib/tokens'

type SheetProps = {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  heightFraction?: number
}

export function Sheet({ visible, onClose, children, heightFraction = 0.80 }: SheetProps) {
  const insets = useSafeAreaInsets()
  const screenHeight = Dimensions.get('window').height
  const sheetHeight = screenHeight * heightFraction
  const translateY = useRef(new Animated.Value(screenHeight)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 28, stiffness: 280, mass: 0.8, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: screenHeight, duration: 220, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  // PanResponder lives ONLY on the drag pill — never intercepts child buttons
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { translateY.stopAnimation() },
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy)
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          onCloseRef.current()
        } else {
          Animated.spring(translateY, {
            toValue: 0, damping: 28, stiffness: 280, mass: 0.8, useNativeDriver: true,
          }).start()
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0, damping: 28, stiffness: 280, mass: 0.8, useNativeDriver: true,
        }).start()
      },
    }),
  ).current

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => onCloseRef.current()}
      statusBarTranslucent
    >
      {/* Backdrop — tap to close */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => onCloseRef.current()}>
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: backdropOpacity }]} />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[
          s.sheet,
          {
            height: sheetHeight,
            paddingBottom: Math.max(insets.bottom, 8),
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Drag pill — PanResponder is scoped here only */}
        <View style={s.dragZone} {...panResponder.panHandlers}>
          <View style={s.handle} />
        </View>

        {/* Content — children own their own gestures */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
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
  // Wide touch target for the handle; the pill is centered inside
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
