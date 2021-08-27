import { css } from "@emotion/css"

import { breakpoints } from "./variables"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const respond = Object.keys(breakpoints).reduce<Record<string, (...args: any[]) => string>>(
  (accumulator, label) => {
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
  },
  {},
)
