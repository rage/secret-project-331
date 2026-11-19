import { announce } from "@react-aria/live-announcer"

/** Long enough for a screen reader to start speaking the newly focused element first. */
export const ANNOUNCE_AFTER_FOCUS_MS = 300

/**
 * Announces politely after a focus move. Announced alongside it, the focus speech interrupts the
 * message and it is never heard. Call it right after moving focus.
 */
export const announceAfterFocus = (message: string): void => {
  window.setTimeout(() => {
    // oxlint-disable-next-line i18next/no-literal-string -- ARIA politeness level, not user copy
    announce(message, "polite")
  }, ANNOUNCE_AFTER_FOCUS_MS)
}
