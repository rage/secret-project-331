import { css, cx } from "@emotion/css"
import React from "react"

import { respondToOrLarger } from "../../shared-module/styles/respond"
import { ROW } from "../../util/constants"
import { FlexDirection } from "../../util/css-sanitization"

const wrapperRowExtraStyles = css`
  ${respondToOrLarger.sm} {
    align-items: center;
    column-gap: 0.2rem;
  }
`

export interface CloseEndedQuestionWrapperProps {
  wideScreenDirection: FlexDirection
}

const CloseEndedQuestionWrapper: React.FC<
  React.PropsWithChildren<CloseEndedQuestionWrapperProps>
> = ({ children, wideScreenDirection }) => {
  return (
    <div
      className={cx(
        css`
          display: flex;
          flex-direction: column;
          flex: 1;

          ${respondToOrLarger.sm} {
            flex-direction: ${wideScreenDirection};
          }
        `,
        wideScreenDirection === ROW ? wrapperRowExtraStyles : null,
      )}
    >
      {children}
    </div>
  )
}

export default CloseEndedQuestionWrapper
