import { css } from "@emotion/css"

export const tableOuterWrap = css`
  width: 100%;
  overflow-x: auto;
  position: relative;
`
export const tableStyle = css`
  width: 100%;
  min-width: 900px;
  border-collapse: separate;
  border-spacing: 0;
`
export const headerRowStyle = css`
  background: #f7f8f9;
  height: 48px;
`

export const thStyle = css`
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
export const rowStyle = css`
  height: 50px;
`
export const tdStyle = css`
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
export const lastRowTdStyle = css`
  border-bottom: none;
`

export const noRightBorder = css`
  border-right: none !important;
`

export const noLeftBorder = css`
  border-left: none !important;
`

export const tableOuterScroll = css`
  width: 100%;
  overflow-x: auto;
  /* no flex! */
  background: transparent;
  /* preserves scroll bar */
`

export const tableCenteredInner = css`
  display: block;
  margin-left: auto;
  margin-right: auto;
  min-width: 900px;
  max-width: 90vw; // Optional: sets table max width to 90% of viewport
`

export const tableRoundedWrap = css`
  position: relative;
  border-radius: 8px;
  border: 1px solid #ced1d7;
  background: #fff;
  overflow: hidden;
  box-sizing: border-box;
`

export const stickyShellCss = css`
  position: fixed;
  top: 0;
  z-index: 1000;
  pointer-events: none;
  background: transparent;
  overflow: hidden;
  margin: 0;
  padding: 0;
  transition:
    left 0.2s,
    width 0.2s;
`

export const stickyInnerCss = css`
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
  background: #fff;
  overflow: hidden;
  display: inline-block;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
`

// --- dynamic helpers (no inline styles needed) ---
export const stickyShellDynamic = (left: number, width: number) => css`
  left: ${left}px;
  width: ${width}px;
`

export const stickyTableWidthClass = (w: number) => css`
  border-collapse: separate;
  border-spacing: 0;
  width: ${w}px;
`

export const trailerBarCss = css`
  pointer-events: auto;
  padding-left: 2px;
  padding-right: 2px;
`

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

export const cellBase = css`
  whiteSpace: "nowrap",
  verticalAlign: "middle",
`

export const actionCellFixed = css`
  width: 80,
  minWidth: 80,
  maxWidth: 80,
  ...padX(4),
`

export const contentCell = (w?: number, minW?: number) => css`
  ${w != null ? `width: ${w}px;` : ``}
  ${minW != null ? `min-width: ${minW}px;` : ``}
  ${padX(PAD)};
`

// --- Trailer / Scrollbar ---
export const dockedTrailerCss = css`
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  z-index: 60;
  pointer-events: none;
`

export const topScrollbarWrap = css`
  height: 7px;
  overflow-x: auto;
  overflow-y: hidden;
  pointer-events: auto;
  background: transparent;
  border: none;
  margin-top: 0;

  /* WebKit */
  &::-webkit-scrollbar {
    height: 20px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #000;
    border-radius: 8px;
    border-left: 2px solid transparent;
    border-right: 2px solid transparent;
    background-clip: padding-box;
  }

  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: #000 transparent;
`

export const topScrollbarInner = css`
  height: 0px;
  width: 100%;
`

export const trailerWrapCss = css`
  pointer-events: auto;
  padding-left: 2px;
  padding-right: 2px;
`

// Fixed trailer shell depends on rect; expose a tiny helper:
export const fixedTrailerShellDynamic = (left: number, width: number) => css`
  position: fixed;
  left: ${left}px;
  bottom: 0;
  width: ${width}px;
  z-index: 100;
  pointer-events: none;
  padding-bottom: env(safe-area-inset-bottom);
`

// --- Root / Wrap / Table sizing ---
export const rootRelative = css`
  position: relative;
`

export const wrapAutoX = css`
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  border-radius: 8px;
  border: none;
  background: none;
`

export const wrapHiddenX = css`
  width: 100%;
  overflow-x: hidden;
  overflow-y: hidden;
  border-radius: 8px;
  border: none;
  background: none;
`

export const tableMinWidth = css`
  min-width: 900px;
`

// Inner width depends on runtime; expose a helper:
export const innerWidthDynamic = (widthPx: number) => css`
  width: ${widthPx}px;
`
