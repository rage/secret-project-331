import { useEffect, useRef, useState } from "react"

import { LOADING_AFFORDANCE_DELAY_MS, MIN_VISIBLE_MS } from "../../styles/motion"

export interface UseLoadingAffordanceOptions {
  /** Suppress the affordance for this long after `isPending` turns true. Default `LOADING_AFFORDANCE_DELAY_MS`. */
  delayMs?: number
  /** Once shown, keep it visible at least this long even if `isPending` turns false first. Default `MIN_VISIBLE_MS`. */
  minVisibleMs?: number
}

/**
 * Turns a raw pending flag into a debounced "show a loading affordance now" signal: delayed
 * appearance so a fast operation never flashes one, and a minimum visible time once shown so a
 * resolve landing right after doesn't blink it away.
 *
 * The caller still owns unmounting — stopping to render when this returns `false` after having
 * been `true` is what removes the affordance. This hook only ever asks to wait longer; it cannot
 * keep something mounted past the point where the caller has already stopped rendering it.
 */
export function useLoadingAffordance(
  isPending: boolean,
  options?: UseLoadingAffordanceOptions,
): boolean {
  const delayMs = options?.delayMs ?? LOADING_AFFORDANCE_DELAY_MS
  const minVisibleMs = options?.minVisibleMs ?? MIN_VISIBLE_MS
  const [isVisible, setIsVisible] = useState(false)
  const shownAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (isPending) {
      const showTimer = setTimeout(() => {
        shownAtRef.current = Date.now()
        setIsVisible(true)
      }, delayMs)
      return () => clearTimeout(showTimer)
    }

    if (shownAtRef.current === null) {
      return
    }

    const remainingMs = minVisibleMs - (Date.now() - shownAtRef.current)
    if (remainingMs <= 0) {
      shownAtRef.current = null
      setIsVisible(false)
      return
    }

    const hideTimer = setTimeout(() => {
      shownAtRef.current = null
      setIsVisible(false)
    }, remainingMs)
    return () => clearTimeout(hideTimer)
  }, [isPending, delayMs, minVisibleMs])

  return isVisible
}
