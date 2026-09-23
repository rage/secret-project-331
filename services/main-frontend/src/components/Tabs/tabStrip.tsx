"use client"

import { css, cx } from "@emotion/css"
import type { TabListState } from "@react-stately/tabs"
import React, { useEffect, useRef, useState } from "react"
import { useTabList } from "react-aria"
import { useTranslation } from "react-i18next"

import { baseTheme, fontWeights } from "@/shared-module/common/styles"

/** How wide the "more tabs this way" fade is at an overflowing end of the strip. */
const STRIP_FADE_WIDTH = "1.5rem"

/**
 * The container both tab strips share: `Tabs` (state-driven) and `RouteTabList` (route-driven).
 *
 * Content-width rather than full-width, so a segmented control stretched across a 1920px page does
 * not read as a banner; and scrolling rather than wrapping, so a strip too narrow for its tabs
 * stays one row instead of becoming a three-row block on a phone.
 */
export const tabStripCss = css`
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  width: fit-content;
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
  /* Keeps a tab scrolled into view clear of the fade, which would otherwise slice it. */
  scroll-padding-inline: ${STRIP_FADE_WIDTH};
  gap: 4px;
  padding: 4px;
  margin-bottom: 1.5rem;
  background: ${baseTheme.colors.gray[75]};
  border: 1px solid ${baseTheme.colors.gray[100]};
  border-radius: 8px;
`

/**
 * Stretches the strip across its container and lets its tabs share the width evenly.
 *
 * Opt-in, because `tabStripCss`'s content width is deliberate: a segmented control that picks a
 * view should not span the page. A strip that *is* a page's primary navigation is the other case —
 * spanning the content column reads as the page's own chrome rather than as a stray control.
 */
export const tabStripFullWidthCss = css`
  width: 100%;

  /* Pills size to their labels, which on a full-width strip leaves dead space at the end rather
     than an even row. They still refuse to shrink below their label, so a strip too narrow for its
     tabs keeps scrolling instead of squashing them. */
  > * {
    flex: 1 1 auto;
  }
`

export const tabStripVerticalCss = css`
  flex-direction: column;
  width: auto;
  overflow-x: visible;
`

/** One tab's own state, for `tabPillCss`. */
export interface TabPillState {
  isSelected: boolean
  isFocusVisible: boolean
  isHovered: boolean
  isDisabled?: boolean
}

/**
 * One tab in the treatment both strips share: the selected tab lifts out of the trough on a white
 * fill, and the rest stay quiet until hovered.
 *
 * Typography and the wider-screen padding are the caller's, which is all the two strips still
 * differ by; compose them on with `cx`, which lets the caller's block win.
 */
export function tabPillCss({
  isSelected,
  isFocusVisible,
  isHovered,
  isDisabled = false,
}: TabPillState): string {
  return css`
    flex: 0 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    text-decoration: none;
    position: relative;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    transition: all 0.15s ease;
    cursor: ${isDisabled ? "not-allowed" : "pointer"};
    font-weight: ${isSelected ? fontWeights.semibold : fontWeights.medium};
    color: ${
      isDisabled
        ? baseTheme.colors.gray[300]
        : isSelected
          ? baseTheme.colors.green[700]
          : baseTheme.colors.gray[500]
    };
    background: ${isSelected ? baseTheme.colors.clear[50] : "transparent"};
    ${
      isSelected &&
      css`
        box-shadow:
          0 1px 3px rgba(0, 0, 0, 0.08),
          0 1px 2px rgba(0, 0, 0, 0.06);
      `
    }
    ${
      isFocusVisible &&
      css`
        outline: 2px solid ${baseTheme.colors.green[400]};
        outline-offset: 2px;
      `
    }
    ${
      isHovered &&
      !isSelected &&
      !isDisabled &&
      css`
        color: ${baseTheme.colors.gray[700]};
        background: rgba(255, 255, 255, 0.5);
      `
    }
  `
}

/** Which ends of the strip have tabs out of view. */
export interface StripOverflow {
  start: boolean
  end: boolean
}

/**
 * Fades whichever end of the strip has tabs behind it, so a clipped label reads as "scroll for
 * more" rather than as a rendering fault. Has to be a mask and not a background gradient, which
 * would paint behind the tabs. Undefined while the whole strip fits, so a strip that needs no cue
 * keeps its border and corners intact.
 */
export function tabStripFadeCss(overflow: StripOverflow): string | undefined {
  if (!overflow.start && !overflow.end) {
    return undefined
  }
  const start = overflow.start ? STRIP_FADE_WIDTH : "0px"
  const end = overflow.end ? STRIP_FADE_WIDTH : "0px"
  return css`
    mask-image: linear-gradient(
      to right,
      transparent 0,
      #000 ${start},
      #000 calc(100% - ${end}),
      transparent 100%
    );
  `
}

/** Tracks which ends of a scrolling strip have more tabs, for `tabStripFadeCss`. */
export function useStripOverflow(stripRef: React.RefObject<HTMLElement | null>): StripOverflow {
  const [overflow, setOverflow] = useState<StripOverflow>({ start: false, end: false })

  useEffect(() => {
    const strip = stripRef.current
    if (strip === null) {
      return
    }

    const measure = () => {
      // RTL counts scrollLeft down from zero, so the distance from the start is its magnitude.
      const fromStart = Math.abs(strip.scrollLeft)
      const scrollable = strip.scrollWidth - strip.clientWidth
      setOverflow((previous) => {
        const start = fromStart > 1
        const end = scrollable - fromStart > 1
        return previous.start === start && previous.end === end ? previous : { start, end }
      })
    }

    measure()
    strip.addEventListener("scroll", measure, { passive: true })
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
    observer?.observe(strip)
    // Also the tabs themselves: a count badge arriving widens one without resizing the strip.
    for (const tab of strip.children) {
      observer?.observe(tab)
    }

    return () => {
      strip.removeEventListener("scroll", measure)
      observer?.disconnect()
    }
  }, [stripRef])

  return overflow
}

/**
 * Brings the selected tab into view. A tab change is a route change here, so the strip re-renders
 * scrolled to the start and an active tab past the fold would otherwise be invisible.
 */
export function useScrollSelectedTabIntoView(
  stripRef: React.RefObject<HTMLDivElement | null>,
  selectedKey: React.Key | null | undefined,
) {
  useEffect(() => {
    const selected = stripRef.current?.querySelector('[aria-selected="true"]')
    // oxlint-disable-next-line i18next/no-literal-string -- scrollIntoView option values, not user-facing text
    selected?.scrollIntoView?.({ block: "nearest", inline: "nearest" })
  }, [selectedKey, stripRef])
}

const tabStripClassName = (
  orientation: "horizontal" | "vertical",
  overflow: StripOverflow,
  fullWidth: boolean,
  className: string | undefined,
): string =>
  cx(
    tabStripCss,
    orientation === "vertical" ? tabStripVerticalCss : tabStripFadeCss(overflow),
    fullWidth && orientation === "horizontal" && tabStripFullWidthCss,
    className,
  )

export interface TabStripProps {
  state: TabListState<object>
  orientation: "horizontal" | "vertical"
  /**
   * The tab to scroll into view. `Tabs` tracks it apart from `state.selectedKey`; both
   * `RouteTabList` variants can just pass `state.selectedKey`, which tracks it either way.
   */
  selectedKey: React.Key | null | undefined
  /** Span the container and share the width between the tabs; see `tabStripFullWidthCss`. */
  fullWidth?: boolean
  className?: string | undefined
  children: React.ReactNode
}

/**
 * The tab strip's own element: ARIA list wiring, the scroll-into-view and overflow-fade behaviour,
 * and the shared visual treatment. `Tabs` and both `RouteTabList` variants render one of these
 * around their tabs rather than repeating the hooks and the class list each.
 */
export const TabStrip: React.FC<TabStripProps> = ({
  state,
  orientation,
  selectedKey,
  fullWidth = false,
  className,
  children,
}) => {
  const { t } = useTranslation()
  const stripRef = useRef<HTMLDivElement>(null)
  const { tabListProps } = useTabList(
    { orientation, "aria-label": t("tab-aria-label-default") },
    state,
    stripRef,
  )
  useScrollSelectedTabIntoView(stripRef, selectedKey)
  const overflow = useStripOverflow(stripRef)

  return (
    <div
      {...tabListProps}
      ref={stripRef}
      className={tabStripClassName(orientation, overflow, fullWidth, className)}
    >
      {children}
    </div>
  )
}
