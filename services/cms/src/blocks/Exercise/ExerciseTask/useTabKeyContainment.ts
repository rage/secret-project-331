import { useEffect, useState } from "react"

const NATIVE_FIELD = "input, textarea, select, [contenteditable]:not([contenteditable=false])"

/**
 * Stops Tab and Shift+Tab bubbling out of the element, so Gutenberg's WritingFlow doesn't send
 * focus past the exercise iframe. Fields keep Gutenberg's own handling, which already works.
 * Returns a ref callback.
 */
export function useTabKeyContainment(): (element: HTMLElement | null) => void {
  const [element, setElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!element) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.defaultPrevented) {
        return
      }
      if (event.target instanceof Element && event.target.closest(NATIVE_FIELD)) {
        return
      }
      event.stopPropagation()
    }
    element.addEventListener("keydown", onKeyDown)
    return () => element.removeEventListener("keydown", onKeyDown)
  }, [element])

  return setElement
}
