import { useIntersectionObserver, UseIntersectionObserverOptions } from "./useIntersectionObserver"

/**
 * Returns tuple [ref, inView, entry] for tracking element visibility.
 */
export function useInView(
  opts?: UseIntersectionObserverOptions,
): [(node: Element | null) => void, boolean, IntersectionObserverEntry | null] {
  const { ref, inView, entry } = useIntersectionObserver(opts)
  return [ref, inView, entry]
}
