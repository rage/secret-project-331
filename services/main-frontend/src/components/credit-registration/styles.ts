import { css } from "@emotion/css"

export const sectionsCss = css`
  display: grid;
  gap: 2rem;
`

export const sectionCss = css`
  display: grid;
  gap: 0.75rem;
`

export const headingCss = css`
  font-weight: 500;
  margin: 0;
`

export const noteCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  margin: 0;
`

/** A two-line table cell: primary value over a `noteCss` secondary line. */
export const stackedCellCss = css`
  display: grid;
`

export const controlsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: end;
`

export const controlCss = css`
  min-width: 12rem;
`

/** A bordered block for content that is not a whole page section: a detail header, one phase. */
export const cardCss = css`
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--color-clear-300);
  border-radius: 8px;
  background: var(--color-clear-50);
`

/** A wrapping row of badges, buttons or chips. */
export const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
`

export const monospaceCss = css`
  font-family: monospace;
  overflow-wrap: anywhere;
`
