import { css, cx } from "@emotion/css"
import type { PressEvent } from "react-aria"

export type ButtonSize = "small" | "medium" | "large"
export type IconPosition = "start" | "end"

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "icon" | "danger"

export interface PressHandlers {
  onPress?: (e: PressEvent) => void
  onPressStart?: (e: PressEvent) => void
  onPressEnd?: (e: PressEvent) => void
  onPressChange?: (isPressed: boolean) => void
  onPressUp?: (e: PressEvent) => void
}

interface ResolveStylesInput {
  size: ButtonSize
  variant: ButtonVariant
}

/** Used for non-React/CSS-only screen-reader text; prefer `VisuallyHidden` in components. */
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

const disabledStateRules = `
  &[aria-disabled="true"],
  &:disabled {
    opacity: var(--btn-disabled-opacity);
    cursor: default;
    transition: none;
  }

  /* An aria-disabled anchor stays tabbable and would otherwise still navigate when clicked. */
  &[aria-disabled="true"] {
    pointer-events: none;
  }

  &:disabled:hover {
    cursor: not-allowed;
  }
`

/**
 * Disabled affordance for a link that is not styled as a button, which gets none of `rootBaseCss`.
 *
 * Without it an `isDisabled` link looks exactly like a working one while doing nothing.
 */
export const disabledPlainLinkCss = css`
  ${disabledStateRules}

  &[aria-disabled="true"] {
    text-decoration: none;
  }
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
  /* A button that wraps to two lines has already lost its shape. A label too long to fit wants
     shortening; a caller that cannot shorten it overrides this through its own className. */
  white-space: nowrap;

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

  ${disabledStateRules}

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

const iconSizeSmCss = css`
  padding-inline: var(--btn-icon-padding-x-sm);
`

const iconSizeMdCss = css`
  padding-inline: var(--btn-icon-padding-x-md);
`

const iconSizeLgCss = css`
  padding-inline: var(--btn-icon-padding-x-lg);
`

/**
 * One variant's colours, over the `--btn-<variant>-*` tokens.
 *
 * `insetHoverColor` is the inner ring drawn on hover and focus. It matches the resting fill on the
 * filled variants; `tertiary` has no resting fill to match, so it takes the hover fill instead.
 */
const variantCss = (variant: string, insetHoverColor: string) => css`
  background: var(--btn-${variant}-bg);
  color: var(--btn-${variant}-fg);
  border-color: var(--btn-${variant}-border);

  &:hover:not(:disabled):not([aria-disabled="true"]),
  &:focus-visible:not(:disabled):not([aria-disabled="true"]) {
    background: var(--btn-${variant}-bg-hover);
    color: var(--btn-${variant}-fg-hover);
    border-color: var(--btn-${variant}-border-hover);
    box-shadow:
      var(--btn-${variant}-shadow-hover),
      inset 0 0 0 var(--btn-${variant}-outline-width) ${insetHoverColor};
  }

  &[data-pressed="true"] {
    background: var(--btn-${variant}-bg-pressed);
    box-shadow: var(--btn-pressed-shadow);
  }
`

const primaryCss = variantCss("primary", "var(--btn-primary-bg)")
const secondaryCss = variantCss("secondary", "var(--btn-secondary-bg)")
const tertiaryCss = variantCss("tertiary", "var(--btn-tertiary-bg-hover)")
const dangerCss = css`
  background: var(--btn-danger-bg);
  color: var(--btn-danger-fg);
  border-color: var(--btn-danger-border);

  &:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--btn-danger-bg-hover);
    border-color: var(--btn-danger-bg-hover);
  }

  /* Danger communicates pressed state by fill weight alone: cancels rootBaseCss's press translate. */
  &[data-pressed="true"] {
    background: var(--btn-danger-bg-pressed);
    border-color: var(--btn-danger-bg-pressed);
    box-shadow: var(--btn-pressed-shadow);
    transform: none;
  }
`

const iconCss = css`
  background: var(--btn-icon-bg);
  color: var(--btn-icon-fg);
  border-color: var(--btn-icon-border);
  box-shadow: none;

  &:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--btn-icon-bg-hover);
    color: var(--btn-icon-fg-hover);
    border-color: var(--btn-icon-border-hover);
    box-shadow: var(--btn-icon-shadow-hover);
  }

  &:focus-visible:not(:disabled):not([aria-disabled="true"]) {
    background: var(--btn-icon-bg-hover);
    color: var(--btn-icon-fg-hover);
    border-color: var(--btn-icon-border-hover);
  }

  &[data-pressed="true"] {
    background: var(--btn-icon-bg-pressed);
    color: var(--btn-icon-fg-pressed);
    box-shadow: none;
  }
`

const sizeStyles: Record<ButtonSize, string> = {
  small: sizeSmCss,
  medium: sizeMdCss,
  large: sizeLgCss,
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: primaryCss,
  secondary: secondaryCss,
  tertiary: tertiaryCss,
  icon: iconCss,
  danger: dangerCss,
}

const iconSizeStyles: Record<ButtonSize, string> = {
  small: iconSizeSmCss,
  medium: iconSizeMdCss,
  large: iconSizeLgCss,
}

function resolveVariantCss(variant: ButtonVariant): string {
  return variantStyles[variant]
}

export function resolveButtonRootCss(input: ResolveStylesInput): string {
  return cx(
    rootBaseCss,
    sizeStyles[input.size],
    resolveVariantCss(input.variant),
    input.variant === "icon" ? iconSizeStyles[input.size] : undefined,
  )
}
