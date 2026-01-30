import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export type ExtendedIntersectionObserverInit = IntersectionObserverInit & {
  scrollMargin?: string
}

export interface UseIntersectionObserverOptions extends ExtendedIntersectionObserverInit {
  freezeOnceVisible?: boolean
  initialInView?: boolean
}

export interface UseIntersectionObserverResult {
  ref: (node: Element | null) => void
  entry: IntersectionObserverEntry | null
  inView: boolean
  refresh: () => void
}

const hasIO = () => typeof window !== "undefined" && "IntersectionObserver" in window

/**
 * Tracks element visibility using IntersectionObserver. Returns ref, entry, inView state, and refresh function.
 */
export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {},
): UseIntersectionObserverResult {
  const {
    root = null,
    rootMargin,
    scrollMargin,
    threshold,
    freezeOnceVisible = false,
    initialInView = false,
  } = options

  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)
  const [inView, setInView] = useState<boolean>(initialInView)
  const targetRef = useRef<Element | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const frozenRef = useRef<boolean>(false)

  const opts = useMemo(() => {
    const out: ExtendedIntersectionObserverInit = { root, rootMargin, threshold }
    if (typeof scrollMargin === "string") {
      out.scrollMargin = scrollMargin
    }
    return out
  }, [root, rootMargin, scrollMargin, threshold])

  const cleanup = useCallback(() => {
    observerRef.current?.disconnect()
    observerRef.current = null
  }, [])

  const callbackRef = useRef<((entries: IntersectionObserverEntry[]) => void) | undefined>(
    undefined,
  )
  callbackRef.current = (entries) => {
    const e = entries[entries.length - 1]
    setEntry(e)
    setInView(e.isIntersecting)
    if (freezeOnceVisible && e.isIntersecting) {
      frozenRef.current = true
      cleanup()
    }
  }

  const ref = useCallback((node: Element | null) => {
    targetRef.current = node
    if (observerRef.current && node) {
      observerRef.current.observe(node)
    }
  }, [])

  const refresh = useCallback(() => {
    if (!hasIO() || !targetRef.current || frozenRef.current) {
      return
    }

    cleanup()

    const observer = new IntersectionObserver(
      (entries) => callbackRef.current?.(entries),
      opts as IntersectionObserverInit,
    )
    observerRef.current = observer
    observer.observe(targetRef.current)
  }, [opts, cleanup])

  useEffect(() => {
    if (!hasIO() || !targetRef.current || frozenRef.current) {
      return
    }

    refresh()

    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])

  return { ref, entry, inView, refresh }
}
