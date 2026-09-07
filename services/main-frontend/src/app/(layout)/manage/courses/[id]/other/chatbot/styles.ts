import { css } from "@emotion/css"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export const itemsContainerCss = css`
  flex: 1;
  ${respondToOrLarger.sm} {
    flex: 0 45%;
  }
  display: flex;
  flex-direction: column;
  gap: 1rem;
`
