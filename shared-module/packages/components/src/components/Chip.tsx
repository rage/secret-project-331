"use client"

import { css } from "@emotion/css"
import React from "react"

const REMOVE_SYMBOL = "×"

const rootCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
  border: 1px solid var(--color-clear-400);
  border-radius: 999px;
  background: var(--color-clear-100);
  color: var(--color-gray-700);
  font-size: var(--font-size-1);
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
`

const removeButtonCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--space-4);
  height: var(--space-4);
  flex: none;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: var(--font-size-2);
  line-height: 1;

  &:hover {
    background: var(--color-clear-300);
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`

type ChipRemoval =
  | { onRemove?: undefined; removeLabel?: undefined }
  | {
      /** Called when the "×" is activated. */
      onRemove: () => void
      /** Accessible name for the "×" button, naming what it removes, e.g. "Remove filter: State — blocked". */
      removeLabel: string
    }

export type ChipProps = ChipRemoval & {
  children: React.ReactNode
}

/** A single removable filter value: content plus, when `onRemove` is given, an "×" to clear it. */
export const Chip: React.FC<ChipProps> = ({ children, onRemove, removeLabel }) => (
  <span className={rootCss}>
    <span>{children}</span>
    {onRemove ? (
      <button type="button" className={removeButtonCss} onClick={onRemove} aria-label={removeLabel}>
        <span aria-hidden="true">{REMOVE_SYMBOL}</span>
      </button>
    ) : null}
  </span>
)
