// Shared animation constants for modals and bottom sheets.

export const OVERLAY_ANIM = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
}

// Bottom sheet: slides up from bottom on mobile
export const SHEET_MOBILE_ANIM = {
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%' },
  transition: { type: 'spring' as const, damping: 32, stiffness: 320, mass: 0.8 },
}

// Center dialog: scale + fade (desktop or always-centered modals)
export const DIALOG_ANIM = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  exit:    { opacity: 0, scale: 0.95, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] as [number, number, number, number] } },
}

// Returns sheet on mobile, dialog on desktop
export function sheetOrDialogAnim(isMobile: boolean) {
  return isMobile ? SHEET_MOBILE_ANIM : DIALOG_ANIM
}
