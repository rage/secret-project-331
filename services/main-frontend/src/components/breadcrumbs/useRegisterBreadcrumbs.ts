"use client"

import { useSetAtom } from "jotai"
import { useLayoutEffect } from "react"

import { breadcrumbEntriesAtom, type Crumb } from "./breadcrumbAtoms"

/**
 * Register breadcrumb entries for this layout. Unregisters on unmount (e.g. navigation away).
 * Order scheme: 0=home, 10=org, 20=entity (course/exam/org), 30=section, 40=sub-section, 50+=page-specific. Use distinct orders per level to avoid unstable sort.
 * @param opts.crumbs - Must be memoized (e.g. useMemo); an un-memoized array will cause repeated effect runs and can flicker or loop.
 */
export function useRegisterBreadcrumbs(opts: { key: string; order: number; crumbs: Crumb[] }) {
  const setEntries = useSetAtom(breadcrumbEntriesAtom)

  useLayoutEffect(() => {
    return () => {
      setEntries((prev) => {
        const next = { ...prev }
        delete next[opts.key]
        return next
      })
    }
  }, [setEntries, opts.key])

  useLayoutEffect(() => {
    setEntries((prev) => ({
      ...prev,
      [opts.key]: { key: opts.key, order: opts.order, crumbs: opts.crumbs },
    }))
  }, [setEntries, opts.key, opts.order, opts.crumbs])
}
