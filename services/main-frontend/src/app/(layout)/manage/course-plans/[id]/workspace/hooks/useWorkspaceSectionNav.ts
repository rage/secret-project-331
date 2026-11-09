"use client"

import type { MouseEvent } from "react"
import { useCallback, useEffect, useState } from "react"

import {
  INTERSECTION_ROOT_MARGIN,
  SCROLL_BEHAVIOR,
  SCROLL_BLOCK,
} from "../components/analysis-form/analysisFormDomain"

/**
 * Collapsed state and scroll-spy for a workspace form's sections.
 *
 * `sectionDomIds` must be stable (a module-level array) and match the `id`s of the section
 * elements.
 */
export default function useWorkspaceSectionNav(sectionDomIds: readonly string[]) {
  const [collapsedSections, setCollapsedSections] = useState<ReadonlySet<string>>(new Set())
  const [activeSectionId, setActiveSectionId] = useState<string | null>(sectionDomIds[0] ?? null)

  const isExpanded = useCallback(
    (domId: string) => !collapsedSections.has(domId),
    [collapsedSections],
  )

  const toggleSection = useCallback((domId: string) => {
    setCollapsedSections((previous) => {
      const next = new Set(previous)
      if (next.has(domId)) {
        next.delete(domId)
      } else {
        next.add(domId)
      }
      return next
    })
  }, [])

  const scrollToSection = useCallback(
    (domId: string) => (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
      document.querySelector(`#${domId}`)?.scrollIntoView({
        behavior: SCROLL_BEHAVIOR,
        block: SCROLL_BLOCK,
      })
    },
    [],
  )

  useEffect(() => {
    const elements = sectionDomIds
      .map((id) => document.querySelector<HTMLElement>(`#${id}`))
      .filter((element): element is HTMLElement => element !== null)
    if (elements.length === 0) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const topmost = entries
          .filter((entry) => entry.isIntersecting)
          .toSorted((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (topmost) {
          setActiveSectionId(topmost.target.id)
        }
      },
      { root: null, rootMargin: INTERSECTION_ROOT_MARGIN, threshold: 0 },
    )
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [sectionDomIds, collapsedSections])

  return { isExpanded, toggleSection, activeSectionId, scrollToSection }
}
