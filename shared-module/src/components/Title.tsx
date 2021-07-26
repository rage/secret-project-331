import styled from "@emotion/styled"
import css from "@styled-system/css"
import React from "react"

import { baseTheme, fontWeights, primaryFont, typography } from "../utils"

export interface HeadingExtraProps {
  variant: "large" | "medium" | "small"
}

export type ButtonProps = React.HTMLAttributes<HTMLHeadingElement> & HeadingExtraProps

const StyledTitle = styled.h1(
  css({
    fontFamily: "Josefin Sans, sans-serif",
    fontWeight: fontWeights.bold,
    color: baseTheme.colors.neutral[600],
    fontSize: ({ variant }) =>
      variant === "large" ? typography.h1 : variant === "medium" ? typography.h2 : typography.h3,
  }),
)

const Title: React.FC<ButtonProps> = (props) => {
  return <StyledTitle {...props}>{props.children}</StyledTitle>
}

export default Title
