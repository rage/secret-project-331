import { useEffect, useRef } from "react"

/**
 * Focus for an inline editor or panel: `focusFirst` runs when `isOpen` turns true (or starts
 * true), and the returned trigger ref takes focus when it turns false.
 */
export function useToggleFocus<T extends HTMLElement = HTMLButtonElement>(
  isOpen: boolean,
  focusFirst?: () => void,
) {
  const triggerRef = useRef<T | null>(null)
  const wasOpen = useRef(false)
  const focusFirstRef = useRef(focusFirst)

  useEffect(() => {
    focusFirstRef.current = focusFirst
  })

  useEffect(() => {
    if (isOpen) {
      focusFirstRef.current?.()
    } else if (wasOpen.current) {
      // Not focusSafely: it defers focus after a virtual click, so Cancel no longer refocuses Edit at once.
      triggerRef.current?.focus()
    }
    wasOpen.current = isOpen
  }, [isOpen])

  return triggerRef
}
