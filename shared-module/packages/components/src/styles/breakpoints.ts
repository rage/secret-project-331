/**
 * Viewport widths, in px, where the package changes layout.
 *
 * CSS custom properties cannot be used inside `@media`, so these are plain TS constants rather
 * than tokens.ts entries. Values are deliberately identical to `common`'s `BREAKPOINT_REMS`
 * (480/576/768/992/1200) so the two packages cannot disagree on a breakpoint; `components`
 * cannot import `common` to share the source directly.
 */
export const BREAKPOINT_PX = {
  xs: 480,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
} as const

type Breakpoint = keyof typeof BREAKPOINT_PX

/** Media query matching viewports at or above `breakpoint`. */
export function atLeast(breakpoint: Breakpoint): string {
  return `@media (min-width: ${BREAKPOINT_PX[breakpoint]}px)`
}

/**
 * Media query matching viewports below `breakpoint`.
 *
 * Subtracts 0.02px from the boundary so this and `atLeast` never both match (and never both
 * miss) the same viewport width.
 */
export function below(breakpoint: Breakpoint): string {
  return `@media (max-width: ${BREAKPOINT_PX[breakpoint] - 0.02}px)`
}
