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
  /* An auto table layout treats a width as a preference and shrinks the column to its content
     when the row is tight, which slides the pinned column off its sticky offset and over the
     neighbouring column. A min-width is the floor that offset needs. */
  width: ${CONTROL_COLUMN_WIDTH};
  min-width: ${CONTROL_COLUMN_WIDTH};
  padding-right: 0;
`

export const controlColumnWidthCss = css`
  width: ${CONTROL_COLUMN_WIDTH};
`

export const checkboxShellCss = css`
  position: relative;
  display: inline-flex;
  cursor: pointer;

  &[data-disabled="true"] {
    cursor: not-allowed;
  }

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

/** Hidden until the table stacks, where the toggle loses the column header that named it. */
export const expandLabelCss = css`
  display: none;
`

/** Width below which a table stacks; the wrapper and the cards it draws must agree on it. */
const STACK_BELOW_PX = 640

/** Neutral until the table stacks, so the wrapper does not change a wide table's layout. */
export const stackValueCss = css`
  display: contents;
`

/**
 * Below `STACK_BELOW_PX` each row reads as a labelled list instead of scrolling sideways. Done in
 * CSS rather than at a JS breakpoint so a server-rendered page does not flip layouts after
 * hydration; `Table` pairs it with explicit ARIA roles, which `display: block` would otherwise
 * strip from the table.
 */
export const stackCss = css`
  @media (max-width: ${STACK_BELOW_PX - 0.02}px) {
    & table {
      display: block;
      width: 100%;
    }

    & colgroup {
      display: none;
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

    /* Blocks rather than table parts: table layout sizes a header row from its columns and
       ignores the 1px clip, which pushed the header cells right off the viewport. The stacking
       table spells its ARIA roles out, so dropping the table display does not cost semantics. */
    & thead {
      position: absolute;
      display: block;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }

    & thead tr {
      display: block;
    }

    & thead th {
      display: block;
      width: 1px;
      padding: 0;
      overflow: hidden;
    }

    & td:not([data-table-control="true"], [data-table-detail="true"]) {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-3);
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

    & [data-table-expand="true"] {
      width: auto;
      gap: var(--space-2);
      padding: 0 var(--space-2);
    }

    & [data-table-expand-label="true"] {
      display: inline;
    }

    & td[data-table-detail="true"] {
      display: block;
      margin-top: var(--space-2);
      border-bottom: 0;
    }

    & [data-table-stack-label="true"] {
      display: block;
      flex: 0 0 40%;
      color: var(--color-gray-500);
      font-size: var(--font-size-0);
      font-weight: 600;
      /* A numeric column's end alignment lands on the label too, sending it to the opposite
         edge from the labels beside it. */
      text-align: start;
      overflow-wrap: anywhere;
    }

    /* Keeping the flex default min-width wraps a value too wide to sit beside its label — a
       status pill, a badge and an arrow — onto a line of its own instead of past the card's
       edge; breaking anywhere stops ordinary text doing that for want of a break point. */
    & [data-table-stack-value="true"] {
      display: block;
      flex: 1 1 0;
      overflow-wrap: anywhere;
    }
  }
`
