"use client"

import { useAtomValue } from "jotai"
import { useCallback, useEffect, useRef } from "react"

import { blockIntersectionObserverAtom } from "@/state/blockIntersectionObserver"
import { currentPageIdAtom } from "@/state/course-material/selectors"

export function useBlockIntersectionObserver() {
  const observer = useAtomValue(blockIntersectionObserverAtom)
  const pageId = useAtomValue(currentPageIdAtom)

  const targetRef = useRef<Element | null>(null)

  const ref = useCallback(
    (node: Element | null) => {
      if (targetRef.current && observer) {
        observer.unobserve(targetRef.current)
      }
      targetRef.current = node
      if (observer && node && pageId) {
        node.setAttribute("data-page-id", pageId)
        observer.observe(node)
      }
    },
    [observer, pageId],
  )

  useEffect(() => {
    const node = targetRef.current
    if (!observer || !node) {
      return
    }
    return () => {
      observer.unobserve(node)
    }
  }, [observer])

  return ref
}
