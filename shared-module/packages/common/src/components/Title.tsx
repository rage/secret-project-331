import styled from "@emotion/styled"
import React from "react"

import { baseTheme, fontWeights, typography } from "../styles"

export interface HeadingExtraProps {
  variant: "large" | "medium" | "small"
}

export type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & HeadingExtraProps

// eslint-disable-next-line i18next/no-literal-string
const StyledTitle = styled.h1`
  font-weight: ${fontWeights.bold};
  color: ${baseTheme.colors.clear[200]};
  font-size: ${({ variant }: HeadingProps) =>
    variant === "large" ? typography.h1 : variant === "medium" ? typography.h2 : typography.h3};
`

const Title: React.FC<React.PropsWithChildren<React.PropsWithChildren<HeadingProps>>> = (props) => {
  return <StyledTitle {...props}>{props.children}</StyledTitle>
}

export default Title
