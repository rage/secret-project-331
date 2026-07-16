import { css } from "@emotion/css"

import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

// --- shared sizing ---
export const PAD = 8
export const COMPLETIONS_LEAF_MIN_WIDTH = 60

// Scroll viewport: the table scrolls inside this so the header stays pinned and rows virtualize,
// instead of the whole page scrolling.
export const tableViewportCss = css`
  position: relative;
  width: 100%;
  max-height: calc(100vh - 220px);
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  border: 1px solid #ced1d7;
  border-radius: 8px;
  background: #fff;
`

export const stickyTheadCss = css`
  position: sticky;
  top: 0;
  z-index: 3;
`

export const tableStyle = css`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: auto;
`

export const headerRowStyle = css`
  background: #f7f8f9;
  height: 40px;

  ${respondToOrLarger.md} {
    height: 48px;
  }
`

export const thStyle = css`
  color: ${baseTheme.colors.gray[700]};
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

export const sortableThCss = css`
  cursor: pointer;
  user-select: none;

  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[700]};
    outline-offset: -2px;
  }
`

export const rowStyle = css`
  height: 42px;

  ${respondToOrLarger.md} {
    height: 50px;
  }
`

export const tdStyle = css`
  color: ${baseTheme.colors.gray[700]};
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

export const tableEmptyCell = css`
  text-align: center;
  padding: 32px 16px;
  color: ${baseTheme.colors.gray[500]};
  font-size: 14px;
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
