import { css } from "@emotion/css"
import React from "react"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import type { FlexDirection } from "@/util/css-sanitization"

export interface FlexWrapperProps {
  wideScreenDirection: FlexDirection
}

const FlexWrapper: React.FC<React.PropsWithChildren<FlexWrapperProps>> = ({
  children,
  wideScreenDirection,
}) => {
  return (
    <div
      className={css`
        column-gap: 1rem;
        display: flex;
        flex-direction: column;
        flex-wrap: nowrap;

        ${respondToOrLarger.sm} {
          flex-wrap: wrap;
          flex-direction: ${wideScreenDirection};
        }
      `}
    >
      {children}
    </div>
  )
}

export default FlexWrapper
