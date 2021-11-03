/* eslint-disable i18next/no-literal-string */
const mediaQuery = (minWidth: number) => `@media (min-width: ${minWidth}rem)`

export const respondToOrLarger = {
  xs: mediaQuery(0),
  sm: mediaQuery(36),
  md: mediaQuery(48),
  lg: mediaQuery(62),
  xl: mediaQuery(75),
  xxl: mediaQuery(87.5),
}
