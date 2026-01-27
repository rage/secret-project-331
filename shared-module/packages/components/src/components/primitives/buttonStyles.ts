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

  border-radius: var(--radius-control);
  font-weight: 600;
  line-height: 1;
  text-decoration: none;

  border: 1px solid transparent;
  background: transparent;
  color: inherit;

  cursor: pointer;
  user-select: none;

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
    transform: translateY(var(--btn-pressed-offset));
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
  padding: 0 var(--control-pad-x-sm);
  font-size: var(--font-size-sm);
`

const sizeMdCss = css`
  height: var(--control-height-md);
  padding: 0 var(--control-pad-x-md);
  font-size: var(--font-size-md);
`

const sizeLgCss = css`
  height: var(--control-height-lg);
  padding: 0 var(--control-pad-x-lg);
  font-size: var(--font-size-lg);
`

const primaryCss = css`
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  border-color: var(--btn-primary-border);

  &:hover {
    background: var(--btn-primary-bg-hover);
  }

  &[data-pressed="true"] {
    background: var(--btn-primary-bg-pressed);
  }
`

const secondaryCss = css`
  background: var(--btn-secondary-bg);
  color: var(--btn-secondary-fg);
  border-color: var(--btn-secondary-border);

  &:hover {
    background: var(--btn-secondary-bg-hover);
  }

  &[data-pressed="true"] {
    background: var(--btn-secondary-bg-pressed);
  }
`

const tertiaryCss = css`
  background: var(--btn-tertiary-bg);
  color: var(--btn-tertiary-fg);
  border-color: var(--btn-tertiary-border);

  &:hover {
    background: var(--btn-tertiary-bg-hover);
  }

  &[data-pressed="true"] {
    background: var(--btn-tertiary-bg-pressed);
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
