"use client"

import { announce } from "@react-aria/live-announcer"
import { useAtomValue } from "jotai"
import { usePathname } from "next/navigation"
import React, { useEffect, useRef } from "react"

import { resolvedPageTitleAtom } from "../../hooks/pageTitleAtoms"
import { DEFAULT_SITE_NAME, formatPageTitle } from "../../utils/pageTitle"

interface PageTitleManagerProps {
  /** Site/brand suffix. Defaults to {@link DEFAULT_SITE_NAME}. */
  siteName?: string
}

/**
 * Owns `document.title` for the app. Mount this exactly once, high in the client tree and inside
 * the jotai `<Provider>` so it shares the store with {@link usePageTitle} callers. It is a
 * headless sibling (renders `null`) like `BreadcrumbRenderer` — not a wrapping provider.
 *
 * Accessibility:
 * - Synchronous (navigation-time) title changes are announced by Next.js's built-in App Router
 *   route announcer, which reads `document.title` after our effect has set it. We deliberately
 *   do NOT render our own live region for these, to avoid double announcements.
 * - Async/data-derived titles (resolved on the same route after navigation) would be missed by
 *   the built-in announcer (it is keyed on the router tree), so we announce those politely via
 *   react-aria's `announce()`.
 */
const PageTitleManager: React.FC<PageTitleManagerProps> = ({ siteName = DEFAULT_SITE_NAME }) => {
  const resolvedTitle = useAtomValue(resolvedPageTitleAtom)
  const pathname = usePathname()
  const fullTitle = formatPageTitle(resolvedTitle, siteName)

  // Keep document.title in sync with the resolved page title.
  useEffect(() => {
    if (typeof document === "undefined") {
      return
    }
    document.title = fullTitle
  }, [fullTitle])

  // Announce an async (data-derived) title change politely. The browser announces the initial
  // page load, and Next's built-in route announcer covers navigation-time title changes. To
  // avoid double-announcing, we open a short window after the initial load and after each
  // navigation during which the new route's (synchronous) title settles in without being
  // announced; titles that change later, in place (e.g. a fetched course name), are announced.
  const previousPathnameRef = useRef<string | null>(null)
  const lastTitleRef = useRef<string | null>(null)
  const hasMountedRef = useRef(false)
  const isSettlingNavigationRef = useRef(false)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (typeof document === "undefined") {
      return
    }
    const isInitialRun = !hasMountedRef.current
    const navigated = !isInitialRun && previousPathnameRef.current !== pathname
    const titleChanged = resolvedTitle !== lastTitleRef.current

    hasMountedRef.current = true
    previousPathnameRef.current = pathname
    lastTitleRef.current = resolvedTitle

    if (isInitialRun || navigated) {
      // Open/extend the settle window; the title arriving with this navigation is announced by
      // the browser / Next's built-in announcer, not by us.
      isSettlingNavigationRef.current = true
      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current)
      }
      settleTimerRef.current = setTimeout(() => {
        isSettlingNavigationRef.current = false
        settleTimerRef.current = null
      }, 0)
      return
    }
    if (isSettlingNavigationRef.current || !titleChanged || !resolvedTitle) {
      return
    }
    // eslint-disable-next-line i18next/no-literal-string -- ARIA assertiveness level, not user copy
    announce(resolvedTitle, "polite")
  }, [resolvedTitle, pathname])

  useEffect(() => {
    return () => {
      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current)
      }
    }
  }, [])

  return null
}

export default PageTitleManager
