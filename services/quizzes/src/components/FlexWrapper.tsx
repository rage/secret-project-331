import { css } from "@emotion/css"
import React from "react"

import { respondToOrLarger } from "../shared-module/common/styles/respond"
import { FlexDirection } from "../util/css-sanitization"

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
        flex-wrap: wrap;

        ${respondToOrLarger.sm} {
          flex-direction: ${wideScreenDirection};
        }
      `}
    >
      {children}
    </div>
  )
}

export default FlexWrapper
