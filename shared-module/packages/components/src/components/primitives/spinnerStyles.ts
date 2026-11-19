import { css, keyframes } from "@emotion/css"

export type SpinnerSize = "sm" | "md" | "lg"
export type SpinnerTone = "accent" | "current" | "inverse"

const DIAMETER_PX: Record<SpinnerSize, number> = { sm: 16, md: 20, lg: 24 }
const STROKE_PX: Record<SpinnerSize, number> = { sm: 2, md: 2, lg: 3 }

const TONE_COLOR: Record<SpinnerTone, string> = {
  accent: "var(--color-green-600)",
  current: "currentColor",
  inverse: "var(--color-clear-50)",
}

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`

const reducedMotionPulse = keyframes`
  0%, 49.99% {
    opacity: 1;
  }
  50%, 100% {
    opacity: 0.45;
  }
`

/**
 * CSS for the indeterminate ring at a given size and tone, as an `@emotion/css` class name.
 * A plain style export rather than a component, so any control that renders its own busy glyph
 * can reuse the same ring without wrapping `Spinner`. `display: inline-block` is required for
 * the width and border to apply outside a flex/grid parent.
 */
export function spinnerGlyphCss(size: SpinnerSize, tone: SpinnerTone): string {
  const diameter = DIAMETER_PX[size]
  const stroke = STROKE_PX[size]
  const color = TONE_COLOR[tone]

  return css`
    display: inline-block;
    width: ${diameter}px;
    height: ${diameter}px;
    border-radius: var(--radius-full);
    border: ${stroke}px solid ${color};
    border-right-color: transparent;
    animation: ${spin} var(--duration-spin) var(--ease-linear) infinite;

    @media (prefers-reduced-motion: reduce) {
      animation: ${reducedMotionPulse} var(--duration-slow) steps(2, jump-none) infinite;
    }

    @media (forced-colors: active) {
      border-color: CanvasText;
      border-right-color: transparent;
    }
  `
}
