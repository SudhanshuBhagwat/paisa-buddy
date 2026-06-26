import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

const HAPTICS_ENABLED = true

function safe(fn: () => Promise<void>): void {
  if (!HAPTICS_ENABLED) return
  if (__DEV__) console.log('[haptics] firing')
  void fn().catch((e) => {
    if (__DEV__) console.warn('[haptics] error', e)
  })
}

const isAndroid = Platform.OS === 'android'

export const haptics = {
  selection: () => safe(() =>
    isAndroid
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick)
      : Haptics.selectionAsync()
  ),
  lightImpact: () => safe(() =>
    isAndroid
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  ),
  mediumImpact: () => safe(() =>
    isAndroid
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  ),
  success: () => safe(() =>
    isAndroid
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  ),
  warning: () => safe(() =>
    isAndroid
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  ),
  error: () => safe(() =>
    isAndroid
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  ),
}
