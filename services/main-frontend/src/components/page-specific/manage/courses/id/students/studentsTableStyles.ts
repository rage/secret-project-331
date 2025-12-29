import { css } from "@emotion/css"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export const tableOuterWrap = css`
  width: 100%;
  overflow-x: auto;
  position: relative;
`
export const tableStyle = css`
  width: auto;
  min-width: 100px;
  border-collapse: separate;
  border-spacing: 0;
  margin: 0 auto;

  ${respondToOrLarger.md} {
    min-width: 300px;
  }

  ${respondToOrLarger.lg} {
    min-width: 600px;
  }
`
export const headerRowStyle = css`
  background: #f7f8f9;
  height: 40px;

  ${respondToOrLarger.md} {
    height: 48px;
  }
`

export const thStyle = css`
  color: #1a2333;
  font-weight: 500;
  font-size: 12px;
  line-height: 140%;
  padding-left: 8px;
  padding-right: 8px;
  text-align: left;
  height: 40px;
  background: #f7f8f9;
  border-bottom: 1px solid #ced1d7;
  vertical-align: middle;
  border-right: 1px solid #ced1d7;

  ${respondToOrLarger.md} {
    font-size: 14px;
    padding-left: 16px;
    padding-right: 16px;
    height: 48px;
  }

  ${respondToOrLarger.lg} {
    padding-left: 24px;
    padding-right: 24px;
  }

  &:first-of-type {
    border-radius: 4px 0 0 0;

    ${respondToOrLarger.md} {
      border-radius: 7px 0 0 0;
    }
  }
  &:last-of-type {
    border-radius: 0 4px 0 0;

    ${respondToOrLarger.md} {
      border-radius: 0 7px 0 0;
    }
  }
`
export const rowStyle = css`
  height: 42px;

  ${respondToOrLarger.md} {
    height: 50px;
  }
`
export const tdStyle = css`
  color: #1a2333;
  opacity: 0.8;
  font-weight: 400;
  font-size: 12px;
  line-height: 140%;
  padding-left: 8px;
  padding-right: 8px;
  height: 42px;
  vertical-align: middle;
  background: #fff;
  border-bottom: 1px solid #ced1d7;
  border-right: 1px solid #ced1d7;

  ${respondToOrLarger.md} {
    font-size: 14px;
    padding-left: 16px;
    padding-right: 16px;
    height: 50px;
  }

  ${respondToOrLarger.lg} {
    padding-left: 24px;
    padding-right: 24px;
  }
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
  overflow-x: visible;
  overflow-y: visible;
  /* no flex! */
  background: transparent;
  /* preserves scroll bar */
`

export const tableCenteredInner = css`
  display: inline-block;
  min-width: 100%;
  width: auto;

  ${respondToOrLarger.md} {
    display: block;
    margin-left: auto;
    margin-right: auto;
    width: fit-content;
    max-width: 90vw;
    min-width: 300px;
  }

  ${respondToOrLarger.lg} {
    min-width: 600px;
  }
`

export const tableRoundedWrap = css`
  position: relative;
  border-radius: 4px;
  border: 1px solid #ced1d7;
  background: #fff;
  overflow: visible;
  box-sizing: border-box;

  ${respondToOrLarger.md} {
    border-radius: 8px;
    overflow: hidden;
  }
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
export const PAD = 8
export const COMPLETIONS_LEAF_WIDTH = 120
export const COMPLETIONS_LEAF_MIN_WIDTH = 60

// --- inline style helpers/atoms ---
export const padX = (px: number) => ({ paddingLeft: px, paddingRight: px })

export const cellBase = css`
  white-space: nowrap;
  vertical-align: middle;
`

export const actionCellFixed = css`
  width: 60px;
  min-width: 60px;
  max-width: 60px;
  padding-left: 2px;
  padding-right: 2px;

  ${respondToOrLarger.md} {
    width: 70px;
    min-width: 70px;
    max-width: 70px;
    padding-left: 4px;
    padding-right: 4px;
  }

  ${respondToOrLarger.lg} {
    width: 80px;
    min-width: 80px;
    max-width: 80px;
  }
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
  overflow-x: visible;
  overflow-y: visible;
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
  min-width: 100px;

  ${respondToOrLarger.md} {
    min-width: 300px;
  }

  ${respondToOrLarger.lg} {
    min-width: 600px;
  }
`

// Inner width depends on runtime; expose a helper:
export const innerWidthDynamic = (widthPx: number) => css`
  width: ${widthPx}px;
`
