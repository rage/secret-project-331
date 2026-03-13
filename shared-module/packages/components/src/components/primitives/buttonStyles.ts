import { css, cx, keyframes } from "@emotion/css"
import type { PressEvent } from "@react-types/shared"

import { assertNever } from "../../lib/utils/assertNever"

export type ButtonSize = "sm" | "md" | "lg"
export type IconPosition = "start" | "end"

export type ButtonVariant = "primary" | "secondary" | "tertiary"

export type PressHandlers = {
  onPress?: (e: PressEvent) => void
  onPressStart?: (e: PressEvent) => void
  onPressEnd?: (e: PressEvent) => void
  onPressChange?: (isPressed: boolean) => void
  onPressUp?: (e: PressEvent) => void
}

type ResolveStylesInput = {
  size: ButtonSize
  variant: ButtonVariant
}

const spin = keyframes`
  to { transform: rotate(360deg); }
`

export const srOnlyCss = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`

export const rootBaseCss = css`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  gap: var(--control-gap);

  border-radius: var(--control-radius);
  font-weight: 600;
  line-height: 1;
  text-decoration: none;

  border: 1px solid transparent;
  background: transparent;
  color: inherit;

  cursor: pointer;
  user-select: none;

  transition: var(--btn-transition);

  outline: none;
  &:focus-visible {
    box-shadow:
      0 0 0 var(--focus-ring-offset) var(--focus-ring-offset-color),
      0 0 0 calc(var(--focus-ring-offset) + var(--focus-ring-width)) var(--focus-ring-color);
  }

  /* Disabled styles:
     - keep pointer cursor default (better UX for some a11y tooling)
     - show not-allowed only on hover
     - for links, also block pointer interactions (while still tabbable) */
  &[aria-disabled="true"],
  &:disabled {
    opacity: var(--btn-disabled-opacity);
    cursor: default;
    transition: none;
  }

  /* Prevent pointer activation for disabled links (still keyboard-focusable via tabIndex). */
  &[aria-disabled="true"] {
    pointer-events: none;
  }

  &[aria-disabled="true"]:hover,
  &:disabled:hover {
    cursor: not-allowed;
  }

  /* Pressed state (hook-driven) */
  &[data-pressed="true"] {
    transform: translateY(var(--btn-pressed-offset)) scale(0.98);
    transition: var(--btn-press-transition);
  }

  /* Subtle loading hint */
  &[aria-busy="true"] {
    opacity: var(--btn-loading-opacity);
  }
`

export const contentCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--control-gap);
`

export const contentLoadingCss = css`
  opacity: 0;
`

export const iconSlotCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;

  & > svg {
    width: 1em;
    height: 1em;
  }
`

export const spinnerOverlayCss = css`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
`

export const spinnerCss = css`
  width: 1em;
  height: 1em;
  border-radius: 9999px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: ${spin} 0.8s linear infinite;
`

const sizeSmCss = css`
  height: var(--control-height-sm);
  padding: 0 var(--control-padding-x-sm);
  font-size: var(--font-size-sm);
`

const sizeMdCss = css`
  height: var(--control-height-md);
  padding: 0 var(--control-padding-x-md);
  font-size: var(--font-size-md);
`

const sizeLgCss = css`
  height: var(--control-height-lg);
  padding: 0 var(--control-padding-x-lg);
  font-size: var(--font-size-lg);
`

const primaryCss = css`
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  border-color: var(--btn-primary-border);

  &:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--btn-primary-bg-hover);
    color: var(--btn-primary-fg-hover);
    border-color: var(--btn-primary-border-hover);
    box-shadow:
      var(--btn-primary-shadow-hover),
      inset 0 0 0 var(--btn-primary-outline-width) var(--btn-primary-bg);
  }

  &:focus-visible:not(:disabled):not([aria-disabled="true"]) {
    background: var(--btn-primary-bg-hover);
    color: var(--btn-primary-fg-hover);
    border-color: var(--btn-primary-border-hover);
    box-shadow:
      var(--btn-primary-shadow-hover),
      inset 0 0 0 var(--btn-primary-outline-width) var(--btn-primary-bg);
  }

  &[data-pressed="true"] {
    background: var(--btn-primary-bg-pressed);
    box-shadow: var(--btn-pressed-shadow);
  }
`

const secondaryCss = css`
  background: var(--btn-secondary-bg);
  color: var(--btn-secondary-fg);
  border-color: var(--btn-secondary-border);

  &:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--btn-secondary-bg-hover);
    color: var(--btn-secondary-fg-hover);
    border-color: var(--btn-secondary-border-hover);
    box-shadow:
      var(--btn-secondary-shadow-hover),
      inset 0 0 0 var(--btn-secondary-outline-width) var(--btn-secondary-bg);
  }

  &:focus-visible:not(:disabled):not([aria-disabled="true"]) {
    background: var(--btn-secondary-bg-hover);
    color: var(--btn-secondary-fg-hover);
    border-color: var(--btn-secondary-border-hover);
    box-shadow:
      var(--btn-secondary-shadow-hover),
      inset 0 0 0 var(--btn-secondary-outline-width) var(--btn-secondary-bg);
  }

  &[data-pressed="true"] {
    background: var(--btn-secondary-bg-pressed);
    box-shadow: var(--btn-pressed-shadow);
  }
`

const tertiaryCss = css`
  background: var(--btn-tertiary-bg);
  color: var(--btn-tertiary-fg);
  border-color: var(--btn-tertiary-border);

  &:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--btn-tertiary-bg-hover);
    color: var(--btn-tertiary-fg-hover);
    border-color: var(--btn-tertiary-border-hover);
    box-shadow:
      var(--btn-tertiary-shadow-hover),
      inset 0 0 0 var(--btn-tertiary-outline-width) var(--btn-tertiary-bg-hover);
  }

  &:focus-visible:not(:disabled):not([aria-disabled="true"]) {
    background: var(--btn-tertiary-bg-hover);
    color: var(--btn-tertiary-fg-hover);
    border-color: var(--btn-tertiary-border-hover);
    box-shadow:
      var(--btn-tertiary-shadow-hover),
      inset 0 0 0 var(--btn-tertiary-outline-width) var(--btn-tertiary-bg-hover);
  }

  &[data-pressed="true"] {
    background: var(--btn-tertiary-bg-pressed);
    box-shadow: var(--btn-pressed-shadow);
  }
`

const sizeStyles: Record<ButtonSize, string> = {
  sm: sizeSmCss,
  md: sizeMdCss,
  lg: sizeLgCss,
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: primaryCss,
  secondary: secondaryCss,
  tertiary: tertiaryCss,
}

function resolveVariantCss(variant: ButtonVariant): string {
  switch (variant) {
    case "primary":
      return variantStyles.primary
    case "secondary":
      return variantStyles.secondary
    case "tertiary":
      return variantStyles.tertiary
    default:
      return assertNever(variant)
  }
}

export function resolveButtonRootCss(input: ResolveStylesInput): string {
  return cx(rootBaseCss, sizeStyles[input.size], resolveVariantCss(input.variant))
}
