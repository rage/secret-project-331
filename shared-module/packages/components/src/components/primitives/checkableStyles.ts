import { css, cx } from "@emotion/css"

import type { FieldSize } from "./fieldStyles"

export const checkableRootCss = css`
  display: grid;
  gap: var(--space-2);
`

export const checkableRowCss = css`
  position: relative;
  display: inline-flex;
  align-items: flex-start;
  gap: var(--space-3);
  color: var(--field-fg);
  cursor: pointer;

  &[data-disabled="true"] {
    color: var(--field-disabled-fg);
    cursor: not-allowed;
  }
`

export const checkableInputCss = css`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: inherit;
`

export const checkableContentCss = css`
  display: grid;
  gap: var(--space-1);
`

export const checkableLabelCss = css`
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.35;
`

export const switchTrackCss = css`
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  width: 48px;
  height: 30px;
  padding: 3px;
  border-radius: 999px;
  background: var(--switch-track-off);
  box-shadow: inset 0 0 0 1px rgba(10, 15, 23, 0.12);
  transition:
    background-color 0.18s ease,
    box-shadow 0.18s ease;

  &[data-selected="true"] {
    background: var(--switch-track-on);
  }

  &[data-focus-visible="true"] {
    box-shadow:
      0 0 0 var(--focus-ring-width) rgba(8, 69, 122, 0.18),
      inset 0 0 0 1px rgba(10, 15, 23, 0.12);
  }

  &[data-invalid="true"] {
    box-shadow: inset 0 0 0 1px var(--field-error-border);
  }

  &[data-disabled="true"] {
    opacity: 0.72;
  }
`

export const switchThumbCss = css`
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--color-primary-100);
  box-shadow: 0 1px 4px rgba(10, 15, 23, 0.18);
  transform: translateX(0);
  transition: transform 0.18s ease;

  &[data-selected="true"] {
    transform: translateX(18px);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const choiceIndicatorCss = css`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border: 1px solid var(--field-border);
  background: var(--field-bg);
  color: var(--color-primary-100);
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;

  &[data-selected="true"] {
    background: var(--switch-track-on);
    border-color: var(--switch-track-on);
  }

  &[data-focus-visible="true"] {
    box-shadow: 0 0 0 var(--focus-ring-width) rgba(8, 69, 122, 0.18);
  }

  &[data-invalid="true"] {
    border-color: var(--field-error-border);
  }

  &[data-disabled="true"] {
    background: var(--field-disabled-bg);
    border-color: var(--field-disabled-border);
  }
`

export const checkboxIndicatorCss = css`
  border-radius: 6px;
`

export const radioIndicatorCss = css`
  border-radius: 999px;
`

export const choiceMarkCss = css`
  display: block;
  opacity: 0;
  transition: opacity 0.18s ease;
`

export const choiceMarkVisibleCss = css`
  opacity: 1;
`

export const checkboxMarkCss = css`
  width: 11px;
  height: 6px;
  border-left: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(-45deg) translateY(-1px);
`

export const indeterminateMarkCss = css`
  width: 10px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
`

export const radioMarkCss = css`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
`

export function resolveCheckableSizeCss(fieldSize: FieldSize) {
  switch (fieldSize) {
    case "sm":
      return css`
        font-size: var(--font-size-sm);
      `
    case "lg":
      return css`
        font-size: var(--font-size-lg);
      `
    case "md":
    default:
      return css`
        font-size: var(--font-size-md);
      `
  }
}

export function resolveChoiceIndicatorCss(fieldSize: FieldSize, shape: "checkbox" | "radio") {
  return cx(
    choiceIndicatorCss,
    shape === "radio" ? radioIndicatorCss : checkboxIndicatorCss,
    resolveCheckableSizeCss(fieldSize),
  )
}
