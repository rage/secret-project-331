"use client"

import { css, cx } from "@emotion/css"
import type { TabListState } from "@react-stately/tabs"
import React, { useRef } from "react"
import { useTabList } from "react-aria"
import { useTranslation } from "react-i18next"

import { baseTheme, fontWeights } from "@/shared-module/common/styles"

/**
 * The container both tab strips share: `Tabs` (state-driven) and `RouteTabList` (route-driven).
 *
 * Full width and wrapping, so a strip with more tabs than fit on one line grows a second row
 * instead of clipping or scrolling them out of reach. Pills keep their own content-sized `flex`
 * (see `tabPillCss`), so a wrapped row goes ragged rather than stretching to fill it.
 */
export const tabStripCss = css`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  width: 100%;
  max-width: 100%;
  gap: 4px;
  padding: 4px;
  margin-bottom: 1.5rem;
  background: ${baseTheme.colors.gray[75]};
  border: 1px solid ${baseTheme.colors.gray[100]};
  border-radius: 8px;
`

export const tabStripVerticalCss = css`
  flex-direction: column;
  flex-wrap: nowrap;
  width: auto;
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
    /* Without this, a nowrap label can't shrink below its own width and forces the wrapped row —
       and the strip's container — wider than it has room for. */
    overflow: hidden;
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

const tabStripClassName = (
  orientation: "horizontal" | "vertical",
  className: string | undefined,
): string => cx(tabStripCss, orientation === "vertical" && tabStripVerticalCss, className)

export interface TabStripProps {
  state: TabListState<object>
  orientation: "horizontal" | "vertical"
  className?: string | undefined
  children: React.ReactNode
}

/**
 * The tab strip's own element: ARIA list wiring and the shared visual treatment. `Tabs` and both
 * `RouteTabList` variants render one of these around their tabs rather than repeating the hooks
 * and the class list each.
 */
export const TabStrip: React.FC<TabStripProps> = ({ state, orientation, className, children }) => {
  const { t } = useTranslation()
  const stripRef = useRef<HTMLDivElement>(null)
  const { tabListProps } = useTabList(
    { orientation, "aria-label": t("tab-aria-label-default") },
    state,
    stripRef,
  )

  return (
    <div {...tabListProps} ref={stripRef} className={tabStripClassName(orientation, className)}>
      {children}
    </div>
  )
}
