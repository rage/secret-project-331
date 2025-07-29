import { css } from "@emotion/css"

import { baseTheme } from "@/shared-module/common/styles"

export const fadeStyle = css`
  mask-image: linear-gradient(0.5turn, black 66%, transparent);
`
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
