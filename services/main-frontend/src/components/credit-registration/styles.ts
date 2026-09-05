import { css, cx } from "@emotion/css"

import { monospaceFont } from "@/shared-module/common/styles"

/** Page shell for the standalone student pages. */
export const narrowPageCss = css`
  display: grid;
  gap: var(--space-5);
  max-width: 42rem;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4) var(--space-7);
`

/** Page root: stacks whole sections. */
export const sectionsCss = css`
  display: grid;
  gap: var(--space-5);
`

/** One section: heading, controls, tiles, table. Sub-blocks inside it take `subsectionCss`. */
export const sectionCss = css`
  display: grid;
  gap: var(--space-4);
`

/** Binds a heading to the `noteCss` line under it so the two read as one unit. */
export const sectionHeaderCss = css`
  display: grid;
  gap: var(--space-2);
`

/** An h3 and the block it introduces. */
export const subsectionCss = css`
  display: grid;
  gap: var(--space-3);
`

/** The page's h1. */
export const pageTitleCss = css`
  margin: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-4);
  font-weight: 600;
  line-height: 1.2;
`

/** A section h2. */
export const headingCss = css`
  margin: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-3);
  font-weight: 600;
  line-height: 1.3;
`

/** An h3 or h4 inside a section, and dialog sub-heads. */
export const subheadingCss = css`
  margin: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-2);
  font-weight: 600;
  line-height: 1.3;
`

/** Secondary text: the only tier below body copy. */
export const noteCss = css`
  margin: 0;
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

/** A two-line table cell: primary value over a `noteCss` secondary line. */
export const stackedCellCss = css`
  display: grid;
`

/** A row of form controls. `rowCss` is for badges and buttons. */
export const controlsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: start;
`

/** One field in a `controlsCss` row. */
export const controlCss = css`
  min-width: 12rem;
`

/** A wrapping row of badges, buttons or chips. */
export const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
`

/** The only card: a repeated grid item, or a form that appears on demand. Never a page section. */
export const cardCss = css`
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-clear-300);
  border-radius: var(--surface-radius);
  background: var(--color-clear-50);
`

/** Lays out repeated `cardCss` items. */
export const cardGridCss = css`
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
`

/** Rows separated by rules rather than boxes: module rows, certificates, phases. */
export const dividedListCss = css`
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;

  > li {
    padding-block: var(--space-3);
    border-top: 1px solid var(--color-clear-300);
  }

  > li:first-of-type {
    padding-top: 0;
    border-top: none;
  }
`

/** Stacks the fields of a dialog form. */
export const dialogFormCss = css`
  display: grid;
  gap: var(--space-4);
`

/** Sticky action bar under a table with selectable rows. */
export const toolbarCss = css`
  position: sticky;
  bottom: 0;
  z-index: 1;
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-clear-300);
  background: var(--color-clear-50);
`

/** Caps the line measure of body copy on the wide teacher and admin surfaces. */
export const proseCss = css`
  max-width: 42rem;
`

/** "Nothing here yet"; `noteCss` annotates content that does exist. */
export const emptyStateCss = css`
  margin: 0;
  padding: var(--space-4) 0;
  color: var(--color-gray-500);
  font-size: var(--font-size-2);
`

/** Wraps a status badge that navigates or opens a dialog; the badge keeps its own shape. */
export const statusTriggerCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;

  &:hover span {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`

/**
 * Marks a replaced attempt wherever one is listed beside the current row.
 *
 * Not `opacity`: it blends already contrast-checked colours toward the page background and
 * collapses the ratio below WCAG AA.
 */
export const supersededCss = css`
  text-decoration: line-through;
`

/** Any code-like value: identifiers, error codes, student numbers. */
export const monospaceCss = css`
  font-family: ${monospaceFont};
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
`

/** A stored request or response body in a `<pre>`. */
export const payloadCss = cx(
  monospaceCss,
  css`
    margin: 0;
    padding: var(--space-3);
    max-height: 20rem;
    overflow: auto;
    border: 1px solid var(--color-clear-300);
    border-radius: var(--surface-radius);
    background: var(--color-gray-50);
    font-size: var(--font-size-1);
    white-space: pre-wrap;
  `,
)
