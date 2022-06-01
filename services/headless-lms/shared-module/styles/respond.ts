/* eslint-disable i18next/no-literal-string */
const mediaQuery = (minWidth: number) => `@media (min-width: ${minWidth}rem)`

export const respondToOrLarger = {
  xxxs: mediaQuery(2), // 320px
  xxs: mediaQuery(25), // 400px
  xs: mediaQuery(30), // 480px
  sm: mediaQuery(36), // 576px
  md: mediaQuery(48), // 768px
  lg: mediaQuery(62), // 992px
  xl: mediaQuery(75), // 1200px
  xxl: mediaQuery(87.5), // 1400px
  xxxl: mediaQuery(100), // 1600px
  xxxxl: mediaQuery(125), // 2000px
}
