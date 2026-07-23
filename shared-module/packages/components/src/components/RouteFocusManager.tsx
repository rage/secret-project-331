"use client"

import { useEffect, useRef } from "react"

const DEFAULT_TARGET_SELECTOR = "#maincontent"

const HEADING_SELECTOR = "h1"

const TABINDEX_ATTRIBUTE = "tabindex"

export interface RouteFocusManagerProps {
  /** Current route path, e.g. from Next.js `usePathname()`. */
  pathname: string
  /** CSS selector for the main content container; focus lands on its first `h1`, or itself if none. */
  targetSelector?: string
}

/**
 * Moves focus to the new page's main heading on client-side navigation, so assistive
 * technology users notice the page changed (WCAG 2.4.3). Mount once, high in the tree.
 * No-op on the initial page load (the browser already handles focus then).
 *
 * Takes `pathname` as a prop rather than reading it via `next/navigation` itself, so this
 * package stays framework-agnostic (it's built standalone by Storybook, which can't resolve
 * Next.js imports).
 */
const RouteFocusManager: React.FC<RouteFocusManagerProps> = ({
  pathname,
  targetSelector = DEFAULT_TARGET_SELECTOR,
}) => {
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
