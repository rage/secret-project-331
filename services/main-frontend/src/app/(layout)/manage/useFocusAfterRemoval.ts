import { useEffect, useRef } from "react"

export const ITEM_HEADING_ATTRIBUTE = "data-item-heading"

/**
 * Keeps focus inside a list when an item is removed from it: `remember` the item before it goes,
 * and once `dependency` (the list data) changes focus moves to the heading now at that position,
 * or to the list heading when it was the last one.
 */
export function useFocusAfterRemoval(dependency: unknown) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const listHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const pendingIndex = useRef<number | null>(null)

  const remember = (itemHeadingId: string) => {
    const headings = Array.from(
      containerRef.current?.querySelectorAll(`[${ITEM_HEADING_ATTRIBUTE}]`) ?? [],
    )
    const index = headings.findIndex((heading) => heading.id === itemHeadingId)
    pendingIndex.current = index === -1 ? 0 : index
  }

  useEffect(() => {
    if (pendingIndex.current === null) {
      return
    }
    const headings = containerRef.current?.querySelectorAll<HTMLElement>(
      `[${ITEM_HEADING_ATTRIBUTE}]`,
    )
    const target = headings?.[pendingIndex.current] ?? listHeadingRef.current
    pendingIndex.current = null
    target?.focus()
  }, [dependency])

  return { containerRef, listHeadingRef, remember }
}
