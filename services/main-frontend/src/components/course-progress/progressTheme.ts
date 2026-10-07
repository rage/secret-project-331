import { css } from "@emotion/css"

import { baseTheme, secondaryFont } from "@/shared-module/common/styles"

/** Colours shared by the course progress charts and the exercise list. */
export const progressColors = {
  fill: baseTheme.colors.green[600],
  track: baseTheme.colors.green[200],
  /** The donut's threshold arc. */
  required: baseTheme.colors.yellow[300],
  heading: baseTheme.colors.green[700],
  text: baseTheme.colors.gray[700],
  mutedText: baseTheme.colors.gray[500],
  rule: baseTheme.colors.clear[400],
  panel: baseTheme.colors.blue[50],
  error: baseTheme.colors.crimson[700],
}

/** Screen-reader-only text sits inside paragraphs and list items, so it must be inline. */
export const INLINE_ELEMENT = "span"

/** The small grey "?" that opens a chart's or the requirements' explanation. */
export const helpButtonCss = css`
  --btn-icon-fg: var(--color-gray-400);
  --btn-icon-fg-hover: var(--color-gray-600);
  --btn-icon-fg-pressed: var(--color-gray-700);

  width: 1.25rem;
  height: 1.25rem;
  min-width: 0;
  padding: 0;
  font: 700 0.9375rem/1 ${secondaryFont};
  text-transform: none;
`
