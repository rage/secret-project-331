import { css } from "@emotion/css"

import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

// --- shared sizing ---
export const PAD = 8
export const COMPLETIONS_LEAF_MIN_WIDTH = 60

// Table wrapper: no longer a scroll container. Rows virtualize against the window scroll
// position (see useWindowVirtualizer in StudentsTable.tsx), so the table grows in normal
// page flow and this div only supplies the visual chrome.
export const tableViewportCss = css`
  position: relative;
  width: 100%;
  border: 1px solid #ced1d7;
  border-radius: 8px;
  background: #fff;
`

// Fixed-position clone of the header shown once the real thead scrolls above the viewport.
// pointer-events: none on the shell lets clicks in the gutters beside the table fall through
// to the page; the inner box re-enables them so sort clicks still reach the header cells.
export const floatingHeaderShellCss = css`
  position: fixed;
  top: 0;
  z-index: 1000;
  pointer-events: none;
  overflow: hidden;
`

export const floatingHeaderShellDynamic = (left: number, width: number) => css`
  left: ${left}px;
  width: ${width}px;
`

export const floatingHeaderInnerCss = css`
  background: #fff;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
  overflow: hidden;
  display: inline-block;
  pointer-events: auto;
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
