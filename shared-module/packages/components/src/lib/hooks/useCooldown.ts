import { useEffect, useState } from "react"

/**
 * Seconds left until a cooldown ends, ticking each second. `initialUntil` is the end in epoch ms (0 for
 * none); the returned `start` sets a new end, but only ever pushes the end later.
 */
export function useCooldown(initialUntil: number) {
  const [until, setUntil] = useState(initialUntil)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setUntil((current) => Math.max(current, initialUntil))
  }, [initialUntil])

  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1000))

  useEffect(() => {
    if (secondsLeft <= 0) {
      return
    }
    const timeout = setTimeout(() => setNow(Date.now()), 1000)
    return () => clearTimeout(timeout)
  }, [secondsLeft, now])

  const start = (nextUntil: number) => {
    setNow(Date.now())
    setUntil((current) => Math.max(current, nextUntil))
  }

  return [secondsLeft, start] as const
}
