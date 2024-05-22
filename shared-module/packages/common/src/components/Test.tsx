import styled from "@emotion/styled"
import React from "react"

export interface TestExtraProps {
  variant: "large" | "medium" | "small"
}

export type TestProps = React.HTMLAttributes<HTMLDivElement> & TestExtraProps

const StyledText = styled.div`
  color: red;
`

const PLACEHOLDER_TEXT = "I am testing"

const Test: React.FC<React.PropsWithChildren<React.PropsWithChildren<TestProps>>> = (props) => {
  return <StyledText {...props}>{PLACEHOLDER_TEXT}</StyledText>
}

export default Test
