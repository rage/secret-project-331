import styled from "@emotion/styled"
import React from "react"

import { baseTheme, fontWeights, typography } from "../utils"

export interface HeadingExtraProps {
  variant: "large" | "medium" | "small"
}

export type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & HeadingExtraProps

const StyledTitle = styled.h1`
  font-family: Josefin Sans, sans-serif;
  font-weight: ${fontWeights.bold};
  color: ${baseTheme.colors.neutral[600]};
  font-size: ${({ variant }: HeadingProps) =>
    variant === "large" ? typography.h1 : variant === "medium" ? typography.h2 : typography.h3};
`

const Title: React.FC<HeadingProps> = (props) => {
  return <StyledTitle {...props}>{props.children}</StyledTitle>
}

export default Title
