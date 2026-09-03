import { css } from "@emotion/css"

import { BREAKPOINT_PX } from "../styles/breakpoints"

/**
 * `../styles/breakpoints`'s `atLeast`/`below` only emit `@media` strings; a container query
 * needs `@container`, so this reuses the same `BREAKPOINT_PX.sm` threshold directly.
 */
const COMPACT_CONTAINER_QUERY = `@container (max-width: ${BREAKPOINT_PX.sm - 0.02}px)`

export const navCss = css`
  container-type: inline-size;
`

export const pageListCss = css`
  display: flex;
  align-items: center;
  justify-content: center;
  list-style: none;
  margin: 0;
  padding-inline: 0;
  gap: var(--space-2);
  block-size: var(--control-height-md);
`

const controlCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--control-height-sm);
  block-size: var(--control-height-sm);
`

export const pageButtonCss = css`
  ${controlCss}
  padding: 0;
  border: none;
  border-radius: var(--radius-2);
  background: transparent;
  color: var(--color-gray-600);
  font-family: var(--font-sans);
  font-size: var(--font-size-1);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    background-color var(--duration-instant) var(--ease-standard),
    color var(--duration-instant) var(--ease-standard);

  &:disabled {
    opacity: var(--btn-disabled-opacity);
    cursor: default;
    transition: none;
  }
  &:disabled:hover {
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--color-clear-100);
    color: var(--color-gray-800);
  }

  &[aria-current="page"] {
    background: var(--color-green-600);
    color: var(--color-clear-50);
    font-weight: 600;
  }

  &[data-focus-visible="true"] {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
  @media (forced-colors: active) {
    &[data-focus-visible="true"] {
      outline-color: Highlight;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const iconCss = css`
  display: inline-flex;

  & > svg {
    display: block;
  }
`

export const ellipsisCss = css`
  ${controlCss}
  color: var(--color-gray-400);
  font-size: var(--font-size-1);
  user-select: none;
`

/** Hides the numbered/ellipsis `<li>`s in the compact form; prev/next stay outside this class. */
export const numberedItemCss = css`
  ${COMPACT_CONTAINER_QUERY} {
    display: none;
  }
`

/**
 * The "Page X of Y" text. Hidden by default (its content still reaches AT via the nav's
 * `aria-describedby`, which reads a referenced element's text regardless of its display) and
 * shown in its place once the container is too narrow for the numbered form.
 */
export const compactStatusCss = css`
  display: none;
  font-size: var(--font-size-1);
  color: var(--color-gray-600);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  ${COMPACT_CONTAINER_QUERY} {
    display: inline-flex;
    align-items: center;
  }
`
