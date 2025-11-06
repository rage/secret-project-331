import { useEffect, useRef, useState } from "react"

/**
 * Returns true after a random delay in [minMs, maxMs]. Monotonic: once true, stays true.
 */
export function useHasRandomTimeoutPassed(minMs: number, maxMs: number): boolean {
  const [passed, setPassed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (passed) {
      return
    }

    const delay = Math.floor(minMs + Math.random() * Math.max(0, maxMs - minMs))
    timerRef.current = setTimeout(() => {
      setPassed(true)
    }, delay)

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [passed, minMs, maxMs])

  return passed
}
