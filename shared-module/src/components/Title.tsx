import { ThemeProvider } from "@emotion/react"
import styled from "@emotion/styled"
import React from "react"

import { fontWeights, neutral, primaryFont, typography } from "../utils"

export interface HeadingExtraProps {
  variant: "small" | "medium" | "large"
}

const getFontSize = (props: HeadingExtraProps) =>
  `font-size: ${
    props.variant == "large"
      ? typography.h1
      : props.variant == "medium"
      ? typography.h2
      : typography.h3
  }`

export type ButtonProps = React.HTMLAttributes<HTMLHeadingElement> & HeadingExtraProps

const StyledTitle = styled.h1`
  font-family: ${primaryFont};
  font-weight: ${fontWeights.bold};
  color: ${neutral[600]};
  ${getFontSize}
`

const Title: React.FC<ButtonProps> = ({ children }, props) => {
  return <StyledTitle {...props}>This is the main Title</StyledTitle>
}

export default Title
