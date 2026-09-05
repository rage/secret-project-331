import { css } from "@emotion/css"

/**
 * Width of the checkbox and expand-toggle columns. Fixed so `stickyFirstColumn` can offset the
 * pinned data column by a known amount instead of measuring.
 */
export const CONTROL_COLUMN_WIDTH = "3rem"

export const frameCss = css`
  position: relative;
`

export const scrollCss = css`
  overflow-x: auto;
`

export const tableCss = css`
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-2);
`

export const tableFixedCss = css`
  table-layout: fixed;
`

export const tableCompactCss = css`
  font-size: var(--font-size-1);
`

export const captionCss = css`
  text-align: start;
  padding-bottom: var(--space-3);
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

export const cellCss = css`
  text-align: start;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-clear-300);
  vertical-align: top;
`

export const cellCompactCss = css`
  padding: var(--space-2) var(--space-3);
`

export const headerCellCss = css`
  color: var(--color-gray-500);
  font-weight: 600;
  white-space: nowrap;
`

export const bodyCellCss = css`
  color: var(--color-gray-700);
  font-variant-numeric: tabular-nums;
`

export const nowrapCss = css`
  white-space: nowrap;
`

export const wrapCss = css`
  white-space: normal;
`

export const emptyStateCellCss = css`
  color: var(--color-gray-500);
`

export const growFixedCss = css`
  width: auto;
`

export const alignCss = {
  start: css`
    text-align: start;
  `,
  center: css`
    text-align: center;
  `,
  end: css`
    text-align: end;
  `,
} as const

export const rowHoverCss = css`
  & tbody tr:hover > * {
    background: var(--color-clear-100);
  }
`

export const overflowMaskCss = css`
  position: absolute;
  top: 0;
  bottom: 0;
  width: var(--space-5);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const overflowMaskStartCss = css`
  left: 0;
  background: linear-gradient(to right, var(--table-fade-color, #ffffff), transparent);
`

export const overflowMaskEndCss = css`
  right: 0;
  background: linear-gradient(to left, var(--table-fade-color, #ffffff), transparent);
`

export const overflowMaskVisibleCss = css`
  opacity: 1;
`

// Rows are transparent, so a pinned cell needs its own ground to hide what slides under it.
export const stickyCellCss = css`
  position: sticky;
  z-index: 1;
  background: var(--table-sticky-bg, #ffffff);
`

/** Edge shadow for a pinned cell; only earns its place once something has scrolled under it. */
export const stickyCellScrolledCss = css`
  box-shadow: 6px 0 6px -6px rgba(10, 15, 23, 0.25);
`

export function stickyOffsetCss(offset: string): string {
  return css`
    left: ${offset};
  `
}

export const controlCellCss = css`
  width: ${CONTROL_COLUMN_WIDTH};
  padding-right: 0;
`

export const controlColumnWidthCss = css`
  width: ${CONTROL_COLUMN_WIDTH};
`

export const checkboxShellCss = css`
  position: relative;
  display: inline-flex;

  & input:focus-visible + span {
    box-shadow: 0 0 0 var(--focus-ring-width) rgba(8, 69, 122, 0.18);
  }
`

export const sortButtonCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--space-1);
  background: none;
  color: inherit;
  font: inherit;
  text-align: inherit;
  cursor: pointer;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);
  }

  &:hover {
    color: var(--color-gray-700);
  }
`

export const sortIndicatorCss = css`
  width: 8px;
  height: 6px;
  flex: none;
  background: currentColor;
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
  opacity: 0.3;
  transition:
    transform 0.15s ease,
    opacity 0.15s ease;

  &[data-direction="ascending"] {
    opacity: 1;
  }

  &[data-direction="descending"] {
    opacity: 1;
    transform: rotate(180deg);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const expandButtonCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--space-5);
  height: var(--space-5);
  padding: 0;
  border: 0;
  border-radius: var(--space-2);
  background: none;
  color: var(--color-gray-500);
  cursor: pointer;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);
  }

  &:hover {
    background: var(--color-clear-200);
    color: var(--color-gray-700);
  }
`

export const expandIconCss = css`
  display: inline-flex;
  transition: transform 0.15s ease;

  &[data-expanded="true"] {
    transform: rotate(90deg);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const detailCellCss = css`
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-clear-300);
  background: var(--color-clear-100);
  color: var(--color-gray-700);
`

/** Hidden until the table stacks, where it becomes the row's label for that cell. */
export const stackLabelCss = css`
  display: none;
`

/** Neutral until the table stacks, so the wrapper does not change a wide table's layout. */
export const stackValueCss = css`
  display: contents;
`

/**
 * Below `below` pixels each row reads as a labelled list instead of scrolling sideways. Done in
 * CSS rather than at a JS breakpoint so a server-rendered page does not flip layouts after
 * hydration; `Table` pairs it with explicit ARIA roles, which `display: block` would otherwise
 * strip from the table.
 */
export function stackCss(below: number): string {
  return css`
    @media (max-width: ${below - 0.02}px) {
      & table {
        display: block;
        width: 100%;
      }

      & colgroup {
        display: none;
      }

      & thead {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
      }

      & tbody {
        display: block;
      }

      & tr {
        display: block;
        padding: var(--space-3);
        border: 1px solid var(--color-clear-300);
        border-radius: var(--surface-radius);
      }

      & tr + tr {
        margin-top: var(--space-3);
      }

      & th,
      & td {
        position: static;
        box-shadow: none;
      }

      & td:not([data-table-control="true"], [data-table-detail="true"]) {
        display: grid;
        grid-template-columns: minmax(0, 40%) minmax(0, 1fr);
        gap: var(--space-3);
        align-items: baseline;
        min-width: 0;
        padding: var(--space-2) 0;
        border-bottom: 0;
        white-space: normal;
      }

      & td[data-table-control="true"] {
        display: inline-flex;
        width: auto;
        padding: 0 var(--space-3) var(--space-2) 0;
        border-bottom: 0;
      }

      & td[data-table-detail="true"] {
        display: block;
        margin-top: var(--space-2);
        border-bottom: 0;
      }

      & [data-table-stack-label="true"] {
        display: block;
        color: var(--color-gray-500);
        font-size: var(--font-size-0);
        font-weight: 600;
      }

      & [data-table-stack-value="true"] {
        display: block;
        min-width: 0;
      }
    }
  `
}
