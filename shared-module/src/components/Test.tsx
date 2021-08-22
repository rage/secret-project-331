import styled from "@emotion/styled"
import React from "react"

export interface TestExtraProps {
  variant: "large" | "medium" | "small"
}

export type TestProps = React.HTMLAttributes<HTMLDivElement> & TestExtraProps

const StyledText = styled.div`
  color: red;
`

const Test: React.FC<TestProps> = (props) => {
  return <StyledText {...props}>I am testing</StyledText>
}

export default Test
