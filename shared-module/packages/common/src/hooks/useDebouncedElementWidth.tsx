"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Measures an element's width, remeasuring once a resize settles rather than on every tick.
 *
 * Debouncing matters for anything that redraws from the width: a redraw per resize tick is both
 * wasteful and prone to drawing against a width that is already stale.
 *
 * @param debounceMs how long resizing must pause before the width is remeasured
 * @returns `ref` to attach to the element, and its width in px -- null until first measured
 */
export const useDebouncedElementWidth = <T extends HTMLElement>(
  debounceMs: number,
): { ref: React.RefObject<T | null>; width: number | null } => {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    let timeout: ReturnType<typeof setTimeout> | undefined
    const measure = () => setWidth(Math.floor(element.getBoundingClientRect().width))
    const observer = new ResizeObserver(() => {
      if (timeout) {
        clearTimeout(timeout)
      }
      timeout = setTimeout(measure, debounceMs)
    })
    observer.observe(element)
    measure()
    return () => {
      observer.disconnect()
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [debounceMs])

  return { ref, width }
}
