const mediaQuery = (minWidth: number) => `@media (min-width: ${minWidth}rem)`

// Base font size for pixel calculations (typically 16px)
export const BASE_FONT_SIZE = 16

// Rem values for breakpoints
export const BREAKPOINT_REMS = {
  xxxs: 2, // 32px
  xxs: 25, // 400px
  xs: 30, // 480px
  sm: 36, // 576px
  md: 48, // 768px
  lg: 62, // 992px
  xl: 75, // 1200px
  xxl: 87.5, // 1400px
  xxxl: 100, // 1600px
  xxxxl: 125, // 2000px
  xxxxxl: 150, // 2400px
} as const

export const respondToOrLarger = {
  xxxs: mediaQuery(BREAKPOINT_REMS.xxxs),
  xxs: mediaQuery(BREAKPOINT_REMS.xxs),
  xs: mediaQuery(BREAKPOINT_REMS.xs),
  sm: mediaQuery(BREAKPOINT_REMS.sm),
  md: mediaQuery(BREAKPOINT_REMS.md),
  lg: mediaQuery(BREAKPOINT_REMS.lg),
  xl: mediaQuery(BREAKPOINT_REMS.xl),
  xxl: mediaQuery(BREAKPOINT_REMS.xxl),
  xxxl: mediaQuery(BREAKPOINT_REMS.xxxl),
  xxxxl: mediaQuery(BREAKPOINT_REMS.xxxxl),
  xxxxxl: mediaQuery(BREAKPOINT_REMS.xxxxxl),
}

// Breakpoint pixel values calculated from rem values
export const BACKGROUND_BREAKPOINT_PIXELS = {
  MEDIUM: BREAKPOINT_REMS.md * BASE_FONT_SIZE, // 48 * 16 = 768px
  LARGE: BREAKPOINT_REMS.lg * BASE_FONT_SIZE, // 62 * 16 = 992px
  X_LARGE: BREAKPOINT_REMS.xl * BASE_FONT_SIZE, // 75 * 16 = 1200px
} as const
