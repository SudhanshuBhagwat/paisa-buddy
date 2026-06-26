import * as Haptics from 'expo-haptics'

const HAPTICS_ENABLED = true

function safe(fn: () => Promise<void>): void {
  if (!HAPTICS_ENABLED) return
  void fn().catch(() => {})
}

export const haptics = {
  selection: () => safe(() => Haptics.selectionAsync()),
  lightImpact: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  mediumImpact: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
}
