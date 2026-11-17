"use client"

import { injectGlobal } from "@emotion/css"
import { useEffect, useRef } from "react"

import { runWhenNoModalOpen } from "../lib/utils/openModals"

const DEFAULT_TARGET_SELECTOR = "#maincontent"

const HEADING_SELECTOR = "h1"

const ANY_HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6"

/** How long after a navigation late content may still pull focus to the heading. */
const OBSERVE_MS = 8000

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

const noop = () => {}

const applyFocus = (target: HTMLElement, options: FocusOptions): (() => void) => {
  if (!target.hasAttribute(TABINDEX_ATTRIBUTE)) {
    target.setAttribute(TABINDEX_ATTRIBUTE, "-1")
  }
  target.setAttribute(MANAGED_FOCUS_ATTRIBUTE, "")
  const clearManagedFocus = () => target.removeAttribute(MANAGED_FOCUS_ATTRIBUTE)
  target.addEventListener("blur", clearManagedFocus, { once: true })
  target.focus(options)
  return () => target.removeEventListener("blur", clearManagedFocus)
}

/** Headings in side navigation (TOC), inert or hidden subtrees are not page content. */
const EXCLUDED_ANCESTORS = "nav, aside, [inert], [aria-hidden='true']"

const firstContentHeading = (container: HTMLElement, selector: string): HTMLElement | null => {
  for (const heading of container.querySelectorAll<HTMLElement>(selector)) {
    if (!heading.closest(EXCLUDED_ANCESTORS)) {
      return heading
    }
  }
  return null
}

/** Focuses from script with tabindex=-1 and no ring for this focus; waits while a modal is open.
 * Returns a cancel function. */
export const focusProgrammatically = (
  target: HTMLElement,
  options: FocusOptions = {},
): (() => void) => {
  let removeBlurListener = noop
  const cancelWait = runWhenNoModalOpen(() => {
    if (target.isConnected) {
      removeBlurListener = applyFocus(target, options)
    }
  }, target)
  return () => {
    cancelWait()
    removeBlurListener()
  }
}

const headingOrSelf = (container: HTMLElement): HTMLElement => {
  // h1, else the first heading of any level (pages whose content starts at h2), else the container.
  // Headings inside nav/aside/inert/hidden (e.g. the "In this page" TOC) are skipped.
  return (
    firstContentHeading(container, HEADING_SELECTOR) ??
    firstContentHeading(container, ANY_HEADING_SELECTOR) ??
    container
  )
}

/** Focuses the container's heading and refocuses it for a while if late content replaces it.
 * `watched` (a clicked link) keeps focus until it unmounts. Returns a stop function. */
const settleFocusOnHeading = (
  getContainer: () => HTMLElement | null,
  watched: HTMLElement | null,
  options: FocusOptions,
): (() => void) => {
  let managed: HTMLElement | null = null
  let cleanupBlur: (() => void) | null = null
  let retryFrame = 0
  let stopped = false
  const focusIfWithinWindow = () => {
    if (!stopped && update()) {
      stopped = true
    }
  }
  const focusTarget = () => {
    const container = getContainer()
    if (!container) {
      return
    }
    const target = headingOrSelf(container)
    if (target === managed) {
      return
    }
    cleanupBlur?.()
    cleanupBlur = focusProgrammatically(target, options)
    // Only remember the target once focus took, so a failed focus() is retried on the next mutation.
    managed = document.activeElement === target ? target : null
    if (managed === null) {
      retryFrame = window.requestAnimationFrame(focusIfWithinWindow)
    }
  }
  // Returns true once the page / user took focus elsewhere, so the observer can stop.
  const update = (): boolean => {
    const active = document.activeElement
    if (watched !== null && active === watched) {
      return false
    }
    const focusIsLost = !active || active === document.body || active === managed
    if (!focusIsLost) {
      return true
    }
    focusTarget()
    return false
  }

  if (!watched) {
    focusTarget()
  }
  // Watches the body, as the whole layout (not just main) may be replaced while the page loads.
  // Mutations outside the current container (toasts, live regions) are ignored.
  let observedContainer = getContainer()
  const observer = new MutationObserver((records) => {
    if (typeof document === "undefined") {
      // Environment torn down (tests) while the window was still open.
      observer.disconnect()
      return
    }
    const container = getContainer()
    const relevant =
      container !== observedContainer || records.some((r) => container?.contains(r.target))
    observedContainer = container
    if (relevant && update()) {
      observer.disconnect()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  const timeout = window.setTimeout(() => {
    stopped = true
    observer.disconnect()
  }, OBSERVE_MS)
  return () => {
    stopped = true
    window.cancelAnimationFrame(retryFrame)
    observer.disconnect()
    window.clearTimeout(timeout)
    cleanupBlur?.()
  }
}

const getMainElement = () => document.querySelector<HTMLElement>("main")

/**
 * Focuses main's h1, else its first heading, else `main`, and keeps it there if the heading is
 * replaced while the page settles. Does not scroll by default, so the page stays where it is.
 */
export const focusMainHeading = (options?: FocusOptions): void => {
  runWhenNoModalOpen(() => {
    if (getMainElement()) {
      settleFocusOnHeading(getMainElement, null, options ?? { preventScroll: true })
    }
  })
}

export interface RouteFocusManagerProps {
  /** Current route path, e.g. from Next.js `usePathname()`. */
  pathname: string
  /** CSS selector for the main content container; focus lands on its first `h1`, else its first heading, else itself. */
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
    const getContainer = () => {
      const container = document.querySelector(targetSelector)
      return container instanceof HTMLElement ? container : null
    }
    const initialContainer = getContainer()
    if (!initialContainer) {
      return
    }
    const initialActive = document.activeElement
    // Focus the new page already placed inside main is kept. A clicked link inside main is still
    // focused here, but unmounts as the page swaps, so we wait for that instead of keeping it.
    const watched =
      initialActive instanceof HTMLElement && initialContainer.contains(initialActive)
        ? initialActive
        : null

    return settleFocusOnHeading(getContainer, watched, { preventScroll: true })
  }, [pathname, targetSelector])

  return null
}

export default RouteFocusManager
