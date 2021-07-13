import { css } from "@emotion/css"

import { breakpoints } from "./variables"

export const respond = Object.keys(breakpoints).reduce((accumulator, label) => {
  accumulator[label] = (...args) =>
    label === "mobile"
      ? css`
          @media (max-width: ${breakpoints[label]}) {
            ${css(...args)}
          }
        `
      : css`
          @media (min-width: ${breakpoints[label]}) {
            ${css(...args)}
          }
        `
  return accumulator
}, {})
