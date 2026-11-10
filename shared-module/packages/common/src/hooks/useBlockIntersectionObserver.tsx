"use client"

import { useAtomValue } from "jotai"
import { useCallback, useRef } from "react"

import { blockIntersectionObserverAtom } from "@/state/blockIntersectionObserver"

export function useBlockIntersectionObserver() {
  const observer = useAtomValue(blockIntersectionObserverAtom)
  const targetRef = useRef<Element | null>(null)

  const ref = useCallback(
    (node: Element | null) => {
      if (targetRef.current && observer) {
        observer.unobserve(targetRef.current)
      }
      targetRef.current = node
      if (observer && node) {
        observer.observe(node)
      }
    },
    [observer],
  )

  return ref
}
