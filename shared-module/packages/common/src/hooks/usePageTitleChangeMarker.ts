"use client"

import { useSetAtom } from "jotai"
import { useLayoutEffect } from "react"

import { pageTitleChangeMarkerAtom } from "./pageTitleAtoms"

/**
 * Prefixes the document title with a marker while `isMarked`, to show a hidden tab that its page
 * changed. The marker is never announced to screen readers; the title under it is, as usual.
 */
export function usePageTitleChangeMarker(isMarked: boolean): void {
  const setMarked = useSetAtom(pageTitleChangeMarkerAtom)
  useLayoutEffect(() => {
    setMarked(isMarked)
    return () => setMarked(false)
  }, [setMarked, isMarked])
}
