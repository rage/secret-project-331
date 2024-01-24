import { MutableRefObject, useEffect, useRef } from "react"

const useClickOutside = (
  elementRef: MutableRefObject<HTMLElement | null>,
  callback: (event: Event) => void,
  enabled = true,
): void => {
  const callbackRef = useRef<((event: Event) => void) | null>(null)
  callbackRef.current = callback
  useEffect(() => {
    if (!enabled) {
      return
    }
    const handleClickOutside = (event: Event): void => {
      if (!elementRef.current?.contains(event.target as Node)) {
        callbackRef.current?.(event)
      }
    }
    document.addEventListener("click", handleClickOutside, true)
    return () => document.removeEventListener("click", handleClickOutside, true)
  }, [elementRef, callbackRef, enabled])
}

export default useClickOutside
