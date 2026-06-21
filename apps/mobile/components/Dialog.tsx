import React from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { C, F, RADIUS } from '../lib/tokens'

export type DialogAction = {
  label: string
  onPress?: () => void | Promise<void>
  variant?: 'primary' | 'secondary' | 'destructive'
  disabled?: boolean
  loading?: boolean
}

type DialogProps = {
  visible: boolean
  title: string
  message?: string
  children?: React.ReactNode
  actions: DialogAction[]
  onClose: () => void
}

export function Dialog({ visible, title, message, children, actions, onClose }: DialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.root}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.card}>
          <Text style={s.title}>{title}</Text>
          {!!message && <Text style={s.message}>{message}</Text>}
          {children}
          <View style={s.actions}>
            {actions.map((action) => {
              const variant = action.variant ?? 'primary'
              const disabled = action.disabled || action.loading
              return (
                <Pressable
                  key={action.label}
                  style={({ pressed }) => [
                    s.button,
                    variant === 'secondary' && s.secondaryButton,
                    variant === 'destructive' && s.destructiveButton,
                    disabled && s.disabledButton,
                    pressed && !disabled && s.pressedButton,
                  ]}
                  onPress={action.onPress}
                  disabled={disabled}
                >
                  {action.loading ? (
                    <ActivityIndicator
                      size="small"
                      color={variant === 'secondary' ? C.brand : '#FFFFFF'}
                    />
                  ) : (
                    <Text
                      style={[
                        s.buttonText,
                        variant === 'secondary' && s.secondaryButtonText,
                      ]}
                    >
                      {action.label}
                    </Text>
                  )}
                </Pressable>
              )
            })}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    shadowColor: '#14281E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: F.extrabold,
    color: C.ink,
  },
  message: {
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: F.regular,
    color: C.ink2,
  },
  actions: {
    gap: 10,
    marginTop: 18,
  },
  button: {
    minHeight: 46,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.brand,
    borderWidth: 1,
    borderColor: C.brand,
  },
  secondaryButton: {
    backgroundColor: C.surface,
    borderColor: C.line,
  },
  destructiveButton: {
    backgroundColor: C.neg,
    borderColor: C.neg,
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressedButton: {
    opacity: 0.82,
  },
  buttonText: {
    fontSize: 14,
    fontFamily: F.bold,
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: C.ink,
  },
})
