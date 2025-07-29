import { css } from "@emotion/css"

import { baseTheme } from "@/shared-module/common/styles"

export const hrefStyle = css`
  a {
    &:hover {
      span {
        color: ${baseTheme.colors.blue[700]}; /* TODO accessibility issue, not enough contrast?*/
        text-decoration: underline;
      }
    }
  }
`
