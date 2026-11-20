import { announceAfterFocus } from "@/shared-module/common/utils/announceAfterFocus"

// Focus first, announce after: Firefox drops a message sent in the same tick as a focus move.
export const focusHeadingAndAnnounce = (heading: HTMLElement | null, message: string): void => {
  heading?.focus({ preventScroll: true })
  announceAfterFocus(message)
}
