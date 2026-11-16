"use client"

import { injectGlobal } from "@emotion/css"
import { announce } from "@react-aria/live-announcer"
import { useAtomValue } from "jotai"
import { usePathname } from "next/navigation"
import React, { useEffect, useRef } from "react"

import { pageTitleChangeMarkerAtom, resolvedPageTitleAtom } from "../../hooks/pageTitleAtoms"
import { DEFAULT_SITE_NAME, formatPageTitle } from "../../utils/pageTitle"

const CHANGE_MARKER = "● "

/** Quiet period after the last title change on a new route before it is announced. */
const NAVIGATION_SETTLE_MS = 250
/** Wait when the title still equals the previous route's, in case the real one is yet to arrive. */
const NAVIGATION_STALE_WAIT_MS = 1000

// Next's route announcer reads document.title before the leaf title registers, so it speaks the
// previous page's title. PageTitleManager announces the settled title instead.
void injectGlobal`
  next-route-announcer {
    display: none;
  }
`

interface PageTitleManagerProps {
  /** Site/brand suffix. Defaults to {@link DEFAULT_SITE_NAME}. */
  siteName?: string
}

/**
 * Owns `document.title` for the app. Mount this exactly once, high in the client tree and inside
 * the jotai `<Provider>` so it shares the store with {@link usePageTitle} callers. It is a
 * headless sibling (renders only a `<title>` element) like `BreadcrumbRenderer` — not a wrapping
 * provider.
 *
 * The title is rendered as a `<title>` element rather than written imperatively to
 * `document.title`. React (19+) hoists it into `<head>`, and this element is the single owner of
 * the document title — no other code should write `document.title`. Registration is client-side:
 * `usePageTitle` writes the registry in a layout effect, which does not run during SSR, so the
 * server-rendered initial HTML always contains the bare site name and the resolved page title is
 * applied after hydration.
 *
 * Accessibility: Next.js's built-in route announcer is hidden. This component announces the new
 * title politely via react-aria's `announce()` once per navigation (after it settles) and for
 * later in-place changes (e.g. a fetched course name). Nothing is announced on the initial load.
 */
const PageTitleManager: React.FC<PageTitleManagerProps> = ({ siteName = DEFAULT_SITE_NAME }) => {
  const resolvedTitle = useAtomValue(resolvedPageTitleAtom)
  const pathname = usePathname()
  const isMarked = useAtomValue(pageTitleChangeMarkerAtom)
  // The marker stays out of `resolvedTitle`, so the announcement below never fires for it.
  const fullTitle = `${isMarked ? CHANGE_MARKER : ""}${formatPageTitle(resolvedTitle, siteName)}`

  // Initial load: the browser announces the page; a short window lets its title settle silently.
  // Navigation: the title often registers a commit or more after the pathname changes, so we wait
  // for it (debounced) and announce the new title once. Later in-place changes announce at once.
  const previousPathnameRef = useRef<string | null>(null)
  const lastTitleRef = useRef<string | null>(null)
  const latestTitleRef = useRef<string | null>(null)
  const hasMountedRef = useRef(false)
  const isSettlingInitialLoadRef = useRef(false)
  const pendingNavigationRef = useRef(false)
  const titleAtNavigationRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  latestTitleRef.current = resolvedTitle

  useEffect(() => {
    if (typeof document === "undefined") {
      return
    }
    const clearTimer = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
    const isInitialRun = !hasMountedRef.current
    const navigated = !isInitialRun && previousPathnameRef.current !== pathname
    const titleChanged = resolvedTitle !== lastTitleRef.current
    const titleBeforeThisRun = lastTitleRef.current

    hasMountedRef.current = true
    previousPathnameRef.current = pathname
    // Never overwrite a known title with `null`: a transient null (e.g. a refetch) followed by
    // the same title must not look like a change and re-announce.
    if (resolvedTitle !== null) {
      lastTitleRef.current = resolvedTitle
    }

    if (isInitialRun) {
      isSettlingInitialLoadRef.current = true
      clearTimer()
      timerRef.current = setTimeout(() => {
        isSettlingInitialLoadRef.current = false
        timerRef.current = null
      }, 0)
      return
    }
    if (isSettlingInitialLoadRef.current) {
      return
    }

    if (navigated) {
      pendingNavigationRef.current = true
      titleAtNavigationRef.current = titleBeforeThisRun
    } else if (!pendingNavigationRef.current) {
      if (titleChanged && resolvedTitle) {
        // oxlint-disable-next-line i18next/no-literal-string -- ARIA assertiveness level, not user copy
        announce(resolvedTitle, "polite")
      }
      return
    } else if (!titleChanged) {
      return
    }

    // A title equal to the previous route's may be stale, so give its replacement longer to arrive.
    const isStale = resolvedTitle === null || resolvedTitle === titleAtNavigationRef.current
    clearTimer()
    timerRef.current = setTimeout(
      () => {
        timerRef.current = null
        pendingNavigationRef.current = false
        const title = latestTitleRef.current ?? formatPageTitle(null, siteName)
        // oxlint-disable-next-line i18next/no-literal-string -- ARIA assertiveness level, not user copy
        announce(title, "polite")
      },
      isStale ? NAVIGATION_STALE_WAIT_MS : NAVIGATION_SETTLE_MS,
    )
  }, [resolvedTitle, pathname, siteName])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return <title>{fullTitle}</title>
}

export default PageTitleManager
