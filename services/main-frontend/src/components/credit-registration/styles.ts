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

/*
 * Grid items refuse to shrink below their content unless told to, so without `min-width: 0` one
 * wide block widens the page instead of itself, and nothing can scroll to what falls off.
 */
const stackCss = css`
  display: grid;

  > * {
    min-width: 0;
  }
`

/** Page root: stacks whole sections. */
export const sectionsCss = cx(
  stackCss,
  css`
    gap: var(--space-5);
  `,
)

/** One section: heading, controls, tiles, table. Sub-blocks inside it take `subsectionCss`. */
export const sectionCss = cx(
  stackCss,
  css`
    gap: var(--space-4);
  `,
)

/**
 * A section rendered as a card, for a dashboard page that stacks six or more of them. Bare
 * sections on a shared ground give a reader no edge to find, so the section carries its own.
 */
export const sectionCardCss = cx(
  sectionCss,
  css`
    padding: var(--space-4-5);
    border: 1px solid var(--color-clear-400);
    border-radius: var(--surface-radius);
    background: var(--color-clear-50);
  `,
)

/**
 * A `sectionCardCss` heading row, ruled off from the body, with room on the right for the one
 * control that scopes the section. The rule is what makes a section's start findable at a glance
 * once every section on the page is a card.
 */
export const sectionCardHeaderCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-4);
  align-items: center;
  justify-content: space-between;
  /* Pulled back out to the card's edges: a rule inset by the card's own padding reads as an
     underlined paragraph, where one that spans the full width reads as the card's header. */
  margin: calc(var(--space-4-5) * -1) calc(var(--space-4-5) * -1) 0;
  padding: var(--space-4) var(--space-4-5);
  border-bottom: 1px solid var(--color-clear-300);
`

/** Page root for a page of `sectionCardCss` sections; cards need more air between them than blocks. */
export const sectionCardsCss = cx(
  stackCss,
  css`
    gap: var(--space-6);
  `,
)

/** Binds a heading to the `noteCss` line under it so the two read as one unit. */
export const sectionHeaderCss = css`
  display: grid;
  gap: var(--space-2);
`

/** An h3 and the block it introduces. */
export const subsectionCss = cx(
  stackCss,
  css`
    gap: var(--space-3);
  `,
)

/** The page's h1. */
export const pageTitleCss = css`
  margin: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-5);
  font-weight: 600;
  line-height: 1.2;
`

/** A section h2. */
export const headingCss = css`
  margin: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-3-5);
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
  /* A field root fills its line, so without a basis each control claims a whole row of the
     toolbar; growing keeps a control from stopping short of the field above it. */
  flex: 1 1 18rem;
  min-width: 12rem;
  max-width: 24rem;

  /* One or two controls to a row down here, where the cap would only leave that ragged gap. */
  @media (max-width: 40rem) {
    max-width: none;
  }
`

/**
 * A checkbox in a `controlsCss` row. `controlsCss` aligns items to `start`, but a floating-label
 * field is much taller than an inline checkbox, so the checkbox needs centering on its own.
 */
export const toolbarCheckboxCss = css`
  align-self: center;
`

/** A wrapping row of badges, buttons or chips. */
export const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
`

/** A `rowCss` whose ends are pushed apart: a name on the left, its status or action on the right. */
export const spacedRowCss = cx(
  rowCss,
  css`
    justify-content: space-between;
  `,
)

/**
 * A card inside a section: a repeated grid item, or a form that appears on demand. A section's own
 * card is [`sectionCardCss`], which carries the padding and gaps a whole section needs.
 */
export const cardCss = css`
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-clear-300);
  border-radius: var(--surface-radius);
  background: var(--color-clear-50);
`

/**
 * A card whose content is a stack of full-width bands, each ruled off from the last: a title
 * block, then a step, then the step after it. The card carries no padding of its own, because each
 * band takes the padding and the rule has to reach both edges to read as a divider.
 */
export const bandedCardCss = css`
  display: grid;
  border: 1px solid var(--color-clear-300);
  border-radius: var(--surface-radius);
  background: var(--color-clear-50);
  overflow: hidden;

  > * {
    min-width: 0;
    padding: var(--space-4-5);
    border-top: 1px solid var(--color-clear-300);
  }

  > *:first-child {
    border-top: none;
  }
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

/** A `dialogFormCss` whose controls keep their own width instead of stretching to the grid. */
export const dialogFormStartCss = cx(
  dialogFormCss,
  css`
    justify-items: start;
  `,
)

/**
 * Action bar for a table with selectable rows. Belongs above the table, with the controls that
 * filter it: a bar under the table can only stick as far as its container reaches below it, which
 * on a long table is a row of pagination, so the actions scroll away with the last row.
 */
export const toolbarCss = css`
  position: sticky;
  top: 0;
  z-index: 1;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-clear-300);
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

/** The steps a reader has to take, numbered. */
export const stepsCss = css`
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding-left: var(--space-5);
`

/** Wraps a status badge that navigates or opens a dialog; the badge keeps its own shape. */
export const statusTriggerCss = css`
  display: inline-flex;
  flex-wrap: wrap;
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

/** Holds the arrow to the state it leads away from, so it never starts a line of its own. */
export const stateChangeFromCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
`

/** Any code-like value: identifiers, error codes, student numbers. */
export const monospaceCss = css`
  font-family: ${monospaceFont};
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
`

/** A claimed student number shown as a page's hero value. */
export const studentNumberCss = css`
  font-size: var(--font-size-4);
  font-weight: 600;
  color: var(--color-gray-700);
  font-variant-numeric: tabular-nums;
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
