import { css, keyframes } from "@emotion/css"
import type { Placement } from "react-aria"

import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

/** Colours shared by the course progress charts, key strips and requirements list. */
export const progressColors = {
  fill: baseTheme.colors.green[600],
  track: baseTheme.colors.green[200],
  heading: baseTheme.colors.green[700],
  text: baseTheme.colors.gray[700],
  mutedText: baseTheme.colors.gray[500],
  rule: baseTheme.colors.clear[400],
  panel: baseTheme.colors.blue[50],
  tick: baseTheme.colors.green[800],
  tooltip: baseTheme.colors.green[900],
  divider: baseTheme.colors.clear[300],
  disc: "rgba(0, 0, 0, 0.03)",
  keyStrip: baseTheme.colors.primary[100],
}

/** Section heading element per outline level. */
export const HEADING_TAG = { 2: "h2", 3: "h3" } as const

/** Screen-reader-only text sits inside paragraphs and list items, so it must be inline. */
export const INLINE_ELEMENT = "span"

/** Above the chart, so the tooltip never covers the key strip below it. */
export const TOOLTIP_PLACEMENT: Placement = "top"

/** Media query under which the grow-in animations are turned off. */
export const reducedMotion = "@media (prefers-reduced-motion: reduce)"

// No `to` frames: each animation ends at the rendered value, so server markup needs no client state.
/** Grows the bar fill in from zero width. */
export const growWidth = keyframes`
  from { width: 0; }
`

/** Grows the donut arc in from its start. */
export const growArc = keyframes`
  from { stroke-dasharray: 0.001 100; }
`

/** Swings the donut end cap in from `--cap-from`, keeping it on the growing arc. */
export const growCapAngle = keyframes`
  from { transform: rotate(var(--cap-from)); }
`

/** Keyboard focus ring for a chart, which is its section's only tab stop. */
export const chartFocusCss = css`
  &:focus-visible {
    outline: 2px solid ${progressColors.tick};
    outline-offset: 2px;
    border-radius: 0.5rem;
  }
`

/** Heading of every card section; one style, so the three headings resize together. */
export const sectionHeadingCss = css`
  margin: 0 0 1rem;
  padding-block-end: 0.6rem;
  border-block-end: 3px solid ${progressColors.rule};
  font: 500 1.3rem ${headingFont};
  color: ${progressColors.heading};

  @media (max-width: 22rem) {
    font-size: 1.2rem;
  }

  ${respondToOrLarger.sm} {
    font-size: 1.6rem;
  }

  @media (forced-colors: active) {
    color: CanvasText;
    border-color: CanvasText;
  }
`
