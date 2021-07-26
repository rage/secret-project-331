import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import css from "@styled-system/css"
import React from "react"

import { baseTheme, fontWeights, primaryFont, typography } from "../utils"

export interface SpinnerExtraProps {
  variant: "large" | "medium" | "small"
}

export type SpinnerProps = React.HTMLAttributes<HTMLDivElement> & SpinnerExtraProps

const rotation = keyframes`
0% { transform: rotate(0deg) }
100% { transform: rotate(360deg) }
`

const StyledSpinner = styled.div`
  width: 40px;
  height: 40px;
  border: 5px solid #f1f1f1;
  border-bottom-color: #ff3d00;
  border-radius: 50%;
  display: inline-block;
  animation: ${rotation} 1s linear infinite;
`

const Spinner: React.FC<SpinnerProps> = (props) => {
  return <StyledSpinner {...props}></StyledSpinner>
}

export default Spinner
