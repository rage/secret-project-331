import { useEffect, useRef } from "react"

import { focusProgrammatically } from "../../components/RouteFocusManager"

const ITEM_HEADING_ATTRIBUTE = "data-item-heading"

/** Spread on each list item's heading so focus can land on it after a removal. */
export const itemHeadingProps = { [ITEM_HEADING_ATTRIBUTE]: "", tabIndex: -1 } as const

const LIST_HEADING = -1

const itemHeadings = (container: HTMLElement | null) =>
  Array.from(container?.querySelectorAll<HTMLElement>(`[${ITEM_HEADING_ATTRIBUTE}]`) ?? [])

/**
 * Keeps focus in a list when an item goes: once the removal succeeded, `remember(itemHeadingId)`
 * and focus moves to the heading at that position after `dependency` (the list data) changes.
 * Without an id, or when the list ran out, it moves to the list heading, else to `fallback`.
 */
export function useFocusAfterRemoval<T extends HTMLElement = HTMLDivElement>(
  dependency: unknown,
  fallback?: () => void,
) {
  const containerRef = useRef<T | null>(null)
  const listHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const pendingIndex = useRef<number | null>(null)
  const fallbackRef = useRef(fallback)
  fallbackRef.current = fallback

  const remember = (itemHeadingId?: string) => {
    if (itemHeadingId === undefined) {
      pendingIndex.current = LIST_HEADING
      return
    }
    const index = itemHeadings(containerRef.current).findIndex(
      (heading) => heading.id === itemHeadingId,
    )
    pendingIndex.current = Math.max(index, 0)
  }

  useEffect(() => {
    const index = pendingIndex.current
    if (index === null) {
      return
    }
    pendingIndex.current = null
    const target = itemHeadings(containerRef.current)[index] ?? listHeadingRef.current
    if (target) {
      focusProgrammatically(target)
    } else {
      fallbackRef.current?.()
    }
  }, [dependency])

  return { containerRef, listHeadingRef, itemHeadingProps, remember }
}
