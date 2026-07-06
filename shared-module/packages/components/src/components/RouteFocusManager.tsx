"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

const DEFAULT_TARGET_SELECTOR = "#maincontent"

const HEADING_SELECTOR = "h1"

const TABINDEX_ATTRIBUTE = "tabindex"

export interface RouteFocusManagerProps {
  /**
   * CSS selector for the main content container. Focus lands on the first `h1` inside it,
   * or on the container itself if no `h1` has rendered yet. Defaults to `#maincontent`
   * (the skip-link target).
   */
  targetSelector?: string
}

/**
 * Moves keyboard/screen-reader focus to the new page's main heading on client-side (soft)
 * navigation, so assistive technology users get a cue that the page changed (WCAG 1.3.1/2.4.3).
 *
 * Mount exactly once, high in the client tree (next to `PageTitleManager`). Headless: renders
 * nothing. On the initial (full) page load the browser handles focus, so nothing is done then.
 *
 * The focus move is skipped when:
 * - the URL has a fragment (`#...`) — the browser / in-page scroll handling owns the target, or
 * - focus already sits inside the main content (e.g. an autofocused field or an opened dialog),
 *   so we never steal focus from something the new page placed it on intentionally.
 *
 * The target gets `tabindex="-1"` so that non-interactive elements are programmatically
 * focusable, and is focused with `preventScroll` so the router's own scroll restoration
 * (scroll to top) is not disturbed.
 */
const RouteFocusManager: React.FC<RouteFocusManagerProps> = ({
  targetSelector = DEFAULT_TARGET_SELECTOR,
}) => {
  const pathname = usePathname()
  const previousPathnameRef = useRef<string | null>(null)

  useEffect(() => {
    const previousPathname = previousPathnameRef.current
    previousPathnameRef.current = pathname
    if (previousPathname === null || previousPathname === pathname) {
      // Initial mount (full page load) or a re-render without navigation.
      return
    }
    if (typeof document === "undefined" || typeof window === "undefined") {
      return
    }
    if (window.location.hash) {
      // Fragment navigation: the fragment target owns focus/scroll.
      return
    }
    const container = document.querySelector(targetSelector)
    if (!(container instanceof HTMLElement)) {
      return
    }
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement && container.contains(activeElement)) {
      // The new page already placed focus inside the main content; don't steal it.
      return
    }
    const heading = container.querySelector(HEADING_SELECTOR)
    const target = heading instanceof HTMLElement ? heading : container
    if (!target.hasAttribute(TABINDEX_ATTRIBUTE)) {
      target.setAttribute(TABINDEX_ATTRIBUTE, "-1")
    }
    target.focus({ preventScroll: true })
  }, [pathname, targetSelector])

  return null
}

export default RouteFocusManager
