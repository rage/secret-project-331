"use client"

import { css, cx, keyframes } from "@emotion/css"
import React, { createContext, useContext } from "react"
import { useTranslation } from "react-i18next"

import { useLoadingAffordance } from "../lib/utils/loading"
import { LOADING_AFFORDANCE_DELAY_MS } from "../styles/motion"
import { spinnerGlyphCss, type SpinnerSize } from "./primitives/spinnerStyles"

const DEFAULT_TEST_ID = "loading-spinner-component"
const DEFAULT_MIN_HEIGHT = 160

/**
 * True once already inside a `LoadingRegion`'s announcement. A `LoadingRegion` rendered while
 * this is true skips its own live region, so a page shell and a panel suspending at once produce
 * one announcement, not two.
 */
export const LoadingRegionNestedContext = createContext(false)

export interface LoadingRegionProps {
  /** Accessible name, and the visible caption when `showLabel`. Defaults to `t("spinner.loading")`. */
  label?: string
  showLabel?: boolean
  /** Reserved height, held from first paint so the delayed glyph never causes a layout jump. Default 160. */
  minHeight?: number | string
  size?: SpinnerSize
  /** Suppress the affordance for this long after mount. Default `LOADING_AFFORDANCE_DELAY_MS`; 0 shows immediately. */
  delayMs?: number
  className?: string
  "data-testid"?: string
}

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
`

const rootCss = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
`

const contentCss = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  animation: ${fadeIn} var(--duration-base) var(--ease-standard);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const captionCss = css`
  font-size: var(--font-size-1);
  color: var(--color-gray-500);
  font-family: var(--font-sans);
`

function minHeightCss(minHeight: number | string): string {
  const value = typeof minHeight === "number" ? `${minHeight}px` : minHeight
  return css`
    min-height: ${value};
  `
}

/**
 * A region that is not ready yet: reserves `minHeight` from first paint so the delayed glyph
 * never shifts layout, then becomes a named `role="status"` live region once `delayMs` elapses.
 * Rendered underneath another `LoadingRegion`'s announcement, it renders its glyph without a
 * second live region, so only the outer one announces.
 */
export const LoadingRegion: React.FC<LoadingRegionProps> = ({
  label: labelProp,
  showLabel = false,
  minHeight = DEFAULT_MIN_HEIGHT,
  size = "md",
  delayMs = LOADING_AFFORDANCE_DELAY_MS,
  className,
  "data-testid": dataTestId = DEFAULT_TEST_ID,
}) => {
  const { t } = useTranslation("shared-module")
  const label = labelProp ?? t("spinner.loading")
  const isNested = useContext(LoadingRegionNestedContext)
  const isVisible = useLoadingAffordance(true, { delayMs })

  const rootClassName = cx(rootCss, minHeightCss(minHeight), className)
  const glyph = isVisible ? (
    <div className={contentCss}>
      <span className={spinnerGlyphCss(size, "accent")} aria-hidden="true" />
      {showLabel ? <span className={captionCss}>{label}</span> : null}
    </div>
  ) : null

  const region =
    isVisible && !isNested ? (
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- styled div role=status; <output> changes styling
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
        className={rootClassName}
        data-testid={dataTestId}
      >
        {glyph}
      </div>
    ) : (
      <div className={rootClassName} data-testid={dataTestId}>
        {glyph}
      </div>
    )

  return (
    <LoadingRegionNestedContext.Provider value={true}>{region}</LoadingRegionNestedContext.Provider>
  )
}
