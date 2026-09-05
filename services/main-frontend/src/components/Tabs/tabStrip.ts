"use client"

import { css } from "@emotion/css"
import type React from "react"
import { useEffect } from "react"

import { baseTheme } from "@/shared-module/common/styles"

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
  gap: 4px;
  padding: 4px;
  margin-bottom: 1.5rem;
  background: ${baseTheme.colors.gray[75]};
  border: 1px solid ${baseTheme.colors.gray[100]};
  border-radius: 8px;
`

export const tabStripVerticalCss = css`
  flex-direction: column;
  width: auto;
  overflow-x: visible;
`

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
    selected?.scrollIntoView?.({ block: "nearest", inline: "nearest" })
  }, [selectedKey, stripRef])
}
