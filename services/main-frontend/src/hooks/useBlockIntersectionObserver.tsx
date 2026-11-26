"use client"

import { useAtomValue } from "jotai"
import { useCallback, useEffect, useRef } from "react"

import { blockIntersectionObserverAtom } from "@/state/blockIntersectionObserver"
import { currentPageIdAtom } from "@/state/course-material/selectors"

export function useBlockIntersectionObserver() {
  const tracker = useAtomValue(blockIntersectionObserverAtom)
  const pageId = useAtomValue(currentPageIdAtom)

  const targetRef = useRef<Element | null>(null)

  const ref = useCallback(
    (node: Element | null) => {
      const previousNode = targetRef.current

      if (previousNode) {
        tracker?.unregister(previousNode.id)
        tracker?.observer.unobserve(previousNode)
      }

      targetRef.current = node

      if (tracker && node && pageId) {
        node.setAttribute("data-page-id", pageId)
        tracker.observer.observe(node)
      }
    },
    [tracker, pageId],
  )

  useEffect(() => {
    const node = targetRef.current

    if (!tracker || !node) {
      return
    }

    return () => {
      tracker.unregister(node.id)
      tracker.observer.unobserve(node)
    }
  }, [tracker])

  return ref
}
