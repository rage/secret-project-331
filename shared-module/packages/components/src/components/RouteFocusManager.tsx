"use client"

import { injectGlobal } from "@emotion/css"
import { useEffect, useRef } from "react"

const DEFAULT_TARGET_SELECTOR = "#maincontent"

const HEADING_SELECTOR = "h1"

/** How long after a navigation late content may still pull focus to the heading. */
const OBSERVE_MS = 3000

const TABINDEX_ATTRIBUTE = "tabindex"

// Marks exactly the element this component focused: Chrome still matches :focus-visible on a
// programmatic focus that lands before any user interaction, so a :not(:focus-visible) rule can't
// tell it apart from real keyboard focus there. Cleared on blur, so a later real Tab to the same
// element still gets a ring.
const MANAGED_FOCUS_ATTRIBUTE = "data-route-focus-manager-active"

void injectGlobal`
  [${MANAGED_FOCUS_ATTRIBUTE}]:focus {
    outline: none;
  }
`

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
    const initialContainer = document.querySelector(targetSelector)
    if (!(initialContainer instanceof HTMLElement)) {
      return
    }
    const initialActive = document.activeElement
    // Focus the new page already placed inside main is kept. A clicked link inside main is still
    // focused here, but unmounts as the page swaps, so we wait for that instead of keeping it.
    const watched =
      initialActive instanceof HTMLElement && initialContainer.contains(initialActive)
        ? initialActive
        : null

    let managed: HTMLElement | null = null
    let cleanupBlur: (() => void) | null = null
    const focusTarget = (container: HTMLElement) => {
      const heading = container.querySelector(HEADING_SELECTOR)
      const target = heading instanceof HTMLElement ? heading : container
      if (target === managed) {
        return
      }
      cleanupBlur?.()
      if (!target.hasAttribute(TABINDEX_ATTRIBUTE)) {
        target.setAttribute(TABINDEX_ATTRIBUTE, "-1")
      }
      target.setAttribute(MANAGED_FOCUS_ATTRIBUTE, "")
      const clearManagedFocus = () => target.removeAttribute(MANAGED_FOCUS_ATTRIBUTE)
      target.addEventListener("blur", clearManagedFocus, { once: true })
      cleanupBlur = () => target.removeEventListener("blur", clearManagedFocus)
      managed = target
      target.focus({ preventScroll: true })
    }
    // Moves focus when it is nowhere useful. Returns true once the heading owns focus (or the
    // page / user took focus elsewhere), so the observer can stop.
    const update = (): boolean => {
      const active = document.activeElement
      if (watched?.isConnected && active === watched) {
        return false
      }
      const focusIsLost = !active || active === document.body || active === managed
      if (!focusIsLost && active !== watched) {
        return true
      }
      focusTarget(initialContainer)
      return managed !== initialContainer
    }

    if (!watched) {
      focusTarget(initialContainer)
      if (managed !== initialContainer) {
        return () => cleanupBlur?.()
      }
    }
    // Late-arriving page content (the h1 or the swap of a clicked link) moves focus again. The
    // container itself persists across navigations, so only its subtree is watched.
    const observer = new MutationObserver(() => {
      if (update()) {
        observer.disconnect()
      }
    })
    observer.observe(initialContainer, { childList: true, subtree: true })
    const timeout = window.setTimeout(() => observer.disconnect(), OBSERVE_MS)
    return () => {
      observer.disconnect()
      window.clearTimeout(timeout)
      cleanupBlur?.()
    }
  }, [pathname, targetSelector])

  return null
}

export default RouteFocusManager
