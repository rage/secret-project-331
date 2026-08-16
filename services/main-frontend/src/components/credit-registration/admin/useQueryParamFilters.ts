"use client"

import { useSearchParams } from "next/navigation"
import { useCallback } from "react"

// oxlint-disable-next-line i18next/no-literal-string
const PAGE_PARAM = "page"

export interface QueryParamFilters {
  param: (name: string) => string | undefined
  /** Sets or, for an empty value, clears each named parameter, and returns to page one. */
  applyParams: (changes: Record<string, string | undefined>) => void
}

/** Keeps a view's filters in its query string, so an operator can paste the link into a channel. */
export const useQueryParamFilters = (): QueryParamFilters => {
  const searchParams = useSearchParams()

  const param = useCallback(
    (name: string): string | undefined => searchParams?.get(name) ?? undefined,
    [searchParams],
  )

  const applyParams = useCallback(
    (changes: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams?.toString() ?? "")
      for (const [name, value] of Object.entries(changes)) {
        if (value === undefined || value === "") {
          next.delete(name)
        } else {
          next.set(name, value)
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
    },
    [searchParams],
  )

  return { param, applyParams }
}
