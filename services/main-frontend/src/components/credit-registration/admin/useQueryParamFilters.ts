"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"

// oxlint-disable-next-line i18next/no-literal-string
const PAGE_PARAM = "page"

export interface QueryParamFilters {
  param: (name: string) => string | undefined
  /** Every value of a repeated parameter, e.g. `?state=a&state=b`. Empty when it is absent. */
  params: (name: string) => string[]
  /**
   * Replaces each named parameter and returns to page one. An array sets every value of a repeated
   * parameter, so dropping one of them means passing the rest; undefined, "" and `[]` all clear it.
   */
  applyParams: (changes: Record<string, string | string[] | undefined>) => void
}

/** Keeps a view's filters in its query string, so an operator can paste the link into a channel. */
export const useQueryParamFilters = (): QueryParamFilters => {
  const searchParams = useSearchParams()

  const param = useCallback(
    (name: string): string | undefined => searchParams?.get(name) ?? undefined,
    [searchParams],
  )

  const params = useCallback(
    (name: string): string[] => searchParams?.getAll(name) ?? [],
    [searchParams],
  )

  const applyParams = useCallback((changes: Record<string, string | string[] | undefined>) => {
    // Read back from the address bar, not from this render's `searchParams`: a view with one effect
    // per filter fires several of these in a single commit, and each would otherwise start from the
    // same pre-first-call snapshot and overwrite its predecessors, leaving the URL describing only
    // whichever effect happened to run last.
    const next = new URLSearchParams(window.location.search)
    for (const [name, value] of Object.entries(changes)) {
      const values = (
        value === undefined ? [] : typeof value === "string" ? [value] : value
      ).filter((one) => one !== "")
      next.delete(name)
      for (const one of values) {
        next.append(name, one)
      }
    }
    // A narrowed result set has different pages.
    next.delete(PAGE_PARAM)
    const query = next.toString()
    // Not router.replace: Next 16 keys this route's client cache by the search string the server
    // rendered with — empty, since nothing here is read on the server — but stores the canonical
    // URL of whichever URL was first loaded. A query-only navigation therefore hits that entry
    // and snaps the address bar back to the URL the tab was opened on. replaceState hands the
    // router the URL itself, and useSearchParams() still follows it.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query === "" ? "" : `?${query}`}`,
    )
  }, [])

  // Memoised: `buildQuery` consumers depend on this object's identity.
  return useMemo(() => ({ param, params, applyParams }), [param, params, applyParams])
}
