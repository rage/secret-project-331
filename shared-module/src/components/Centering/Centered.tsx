import { css } from "@emotion/css"
import React from "react"

import { defaultContainerWidth, wideContainerWidth } from "../../styles/constants"
import { respondToOrLarger } from "../../styles/respond"

// Centering is done with this because we don't want to constrict all components
// in a page to be inside a container. Some elements need the entire width
// of the page.

// eslint-disable-next-line i18next/no-literal-string
export const wideWidthCenteredComponentStyles = css`
  max-width: ${wideContainerWidth}rem;
  margin-left: auto;
  margin-right: auto;
  padding: 0rem 1.375rem;
  margin-bottom: 1.25rem;
  ${respondToOrLarger.xl} {
    padding: 0rem;
  }
`

// eslint-disable-next-line i18next/no-literal-string
export const normalWidthCenteredComponentStyles = css`
  max-width: ${defaultContainerWidth}rem;
  margin-left: auto;
  margin-right: auto;
  padding: 0rem 1.375rem;
  margin-bottom: 1.25rem;
  ${respondToOrLarger.md} {
    padding: 0rem;
  }
`

interface CenteredProps {
  variant: "default" | "narrow"
}

const Centered: React.FC<CenteredProps> = ({ children, variant }) => {
  if (variant === "narrow") {
    return <div className={normalWidthCenteredComponentStyles}>{children}</div>
  } else {
    return <div className={wideWidthCenteredComponentStyles}>{children}</div>
  }
}

export default Centered
