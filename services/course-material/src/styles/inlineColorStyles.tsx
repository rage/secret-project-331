import { css } from "@emotion/css"

import { colorMap } from "./colorMapper"

export const inlineColorStyles = css`
  ${Object.entries(colorMap)
    .map(([key, value]) => {
      return `.has-${key}-color {
          color: ${value};
        }`
    })
    .join(",")}
`
