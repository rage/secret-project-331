import { css } from "@emotion/css"
import React from "react"

import { narrowContainerWidthRem, normalContainerWidthRem } from "../../styles/constants"
import { respondToOrLarger } from "../../styles/respond"

export const defaultWidthCenteredComponentStyles = css`
  max-width: ${normalContainerWidthRem}rem;
  margin-left: auto;
  margin-right: auto;
  padding: 0rem 1.375rem;
  margin-bottom: 1.25rem;
  ${respondToOrLarger.xl} {
    padding: 0rem;
  }
`

export const narrowWidthCenteredComponentStyles = css`
  max-width: ${narrowContainerWidthRem}rem;
  margin-left: auto;
  margin-right: auto;
  padding: 0rem 1.375rem;
  margin-bottom: 1.25rem;
  ${respondToOrLarger.md} {
    padding: 0rem;
  }
`

export interface CenteredProps {
  variant: "default" | "narrow"
}

const Centered: React.FC<React.PropsWithChildren<CenteredProps>> = ({ children, variant }) => {
  if (variant === "narrow") {
    return <div className={narrowWidthCenteredComponentStyles}>{children}</div>
  } else {
    return <div className={defaultWidthCenteredComponentStyles}>{children}</div>
  }
}

export default Centered
