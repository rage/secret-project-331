import { css as emotionCss } from "@emotion/css"
import { css } from "@emotion/react"

// Problematic fix later
export const tableOuterWrap = css`
  width: 100%;
  overflow-x: auto;
  position: relative;
`
// Problematic fix later
export const tableStyle = css`
  width: 100%;
  min-width: 900px;
  border-collapse: separate;
  border-spacing: 0;
`
export const headerRowStyle = emotionCss`
  background: #f7f8f9;
  height: 48px;
`

export const thStyle = emotionCss`
  color: #1a2333;
  font-weight: 500;
  font-size: 14px;
  line-height: 140%;
  padding-left: 24px;
  text-align: left;
  height: 48px;
  background: #f7f8f9;
  border-bottom: 1px solid #ced1d7;
  vertical-align: middle;
  border-right: 1px solid #ced1d7;
  &:first-of-type {
    border-radius: 7px 0 0 0;
  }
  &:last-of-type {
    border-radius: 0 7px 0 0;
  }
`
export const rowStyle = emotionCss`
  height: 50px;
`
export const tdStyle = emotionCss`
  color: #1a2333;
  opacity: 0.8;
  font-weight: 400;
  font-size: 14px;
  line-height: 140%;
  padding-left: 24px;
  height: 50px;
  vertical-align: middle;
  background: #fff;
  border-bottom: 1px solid #ced1d7;
  border-right: 1px solid #ced1d7;
`
export const lastRowTdStyle = emotionCss`
  border-bottom: none;
`

export const noRightBorder = emotionCss`
  border-right: none !important;
`

export const noLeftBorder = emotionCss`
  border-left: none !important;
`

export const tableOuterScroll = emotionCss`
  width: 100%;
  overflow-x: auto;
  /* no flex! */
  background: transparent;
  /* preserves scroll bar */
`

export const tableCenteredInner = emotionCss`
  display: block;
  margin-left: auto;
  margin-right: auto;
  min-width: 900px;
  max-width: 90vw; // Optional: sets table max width to 90% of viewport
`

// Problematic, fix later
export const tableRoundedWrap = css`
  position: relative;
  border-radius: 8px;
  border: 1px solid #ced1d7;
  background: #fff;
  overflow: hidden;
  box-sizing: border-box;
`

export const stickyShellCss = emotionCss`
  position: fixed;
  top: 0;
  z-index: 1000;
  pointer-events: none;
  background: transparent;
  overflow: hidden;
  margin: 0;
  padding: 0;
  transition: left 0.2s, width 0.2s;
`

export const stickyInnerCss = emotionCss`
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
  background: #fff;
  overflow: hidden;
  display: inline-block;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
`

// --- dynamic helpers (no inline styles needed) ---
export const stickyShellDynamic = (left: number, width: number) =>
  emotionCss`
    left: ${left}px;
    width: ${width}px;
  `

export const stickyTableWidthClass = (w: number) =>
  emotionCss`
    border-collapse: separate;
    border-spacing: 0;
    width: ${w}px;
  `

export const trailerBarCss = emotionCss`
  pointer-events: auto;
  padding-left: 2px;
  padding-right: 2px;
`

// Problematic fix later
export const headerUnderlineCss = css`
  position: absolute;
  left: 0;
  right: 0;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  top: 0;
  z-index: 2;
  pointer-events: none;
`

// --- shared sizing/padding ---
export const PAD = 16
export const COMPLETIONS_LEAF_WIDTH = 120
export const COMPLETIONS_LEAF_MIN_WIDTH = 80

// --- inline style helpers/atoms ---
export const padX = (px: number) => ({ paddingLeft: px, paddingRight: px })

export const cellBase = emotionCss`
  whiteSpace: "nowrap",
  verticalAlign: "middle",
`

export const actionCellFixed = emotionCss`
  width: 80,
  minWidth: 80,
  maxWidth: 80,
  ...padX(4),
`

export const contentCell = (w?: number, minW?: number) => emotionCss`
  ${w != null ? `width: ${w}px;` : ``}
  ${minW != null ? `min-width: ${minW}px;` : ``}
  ${padX(PAD)};
`
