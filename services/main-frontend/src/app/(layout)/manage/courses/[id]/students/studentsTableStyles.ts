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
  border: 1px solid var(--color-clear-300);
  border-radius: var(--surface-radius);
  background: var(--color-clear-50);
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
  background: var(--color-clear-50);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
  overflow: hidden;
  display: inline-block;
  pointer-events: auto;
`

// Dims a subtab's table while its columns/data are being recomputed from a newer
// query result (see useDeferredValue usage in the tab components).
export const staleTableCss = css`
  opacity: 0.6;
  transition: opacity 0.15s;
`

// Fixed layout is what makes the columns hold still: under `auto` the widths follow whichever
// rows the virtualizer currently has mounted, so they shift as the body scrolls. Widths come from
// the <colgroup> the table renders; see useMeasuredColumnWidths.
export const tableStyle = css`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
`

// text-overflow only clips a block's own inline content, so cell bodies are wrapped in this
// rather than it being applied to the td.
export const cellTruncateCss = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

// Single line, right-aligned so every row is the same height and grades read as numbers, which is
// what keeps the virtualized body from shifting as it scrolls.
export const inlineCellCss = css`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  min-width: 0;
  gap: var(--space-2);
  font-variant-numeric: tabular-nums;
`

export const resizeHandleCss = css`
  position: absolute;
  top: 0;
  /* Absolute offsets resolve against the padding box, so right: 0 would sit inside the cell's
     1px border -- the very line the handle is supposed to grab. */
  right: -1px;
  width: 16px;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
  /* Without this the browser's horizontal pan wins over the drag on touch devices. */
  touch-action: none;

  &::after {
    content: "";
    position: absolute;
    top: 20%;
    right: 0;
    width: 1px;
    height: 60%;
    background: transparent;
  }

  &:hover::after,
  &:focus-visible::after {
    background: ${baseTheme.colors.green[700]};
    right: -1px;
    width: 3px;
  }
`

export const headerRowStyle = css`
  background: var(--color-clear-100);
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
  background: var(--color-clear-100);
  border-bottom: 1px solid var(--color-clear-300);
  vertical-align: middle;
  border-right: 1px solid var(--color-clear-300);

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
    border-radius: var(--surface-radius) 0 0 0;
  }
  &:last-of-type {
    border-radius: 0 var(--surface-radius) 0 0;
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
  font-variant-numeric: tabular-nums;
  padding-left: 8px;
  padding-right: 8px;
  height: 42px;
  vertical-align: middle;
  background: var(--color-clear-50);
  border-bottom: 1px solid var(--color-clear-300);
  border-right: 1px solid var(--color-clear-300);

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
