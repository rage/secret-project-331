import { useRef } from "react"

/**
 * Returns true once any provided boolean has ever been true. Stays true for the component lifetime.
 */
export function useEverTrue(...flags: boolean[]): boolean {
  const everTrueRef = useRef(false)

  // Mutate ref in render: safe and ensures we latch immediately.
  if (!everTrueRef.current && flags.some(Boolean)) {
    everTrueRef.current = true
  }

  return everTrueRef.current
}
