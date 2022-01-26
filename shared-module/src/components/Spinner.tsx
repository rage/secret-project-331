import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import React from "react"

import { baseTheme } from "../styles"

export interface SpinnerExtraProps {
  variant: "large" | "medium" | "small"
}

export type SpinnerProps = React.HTMLAttributes<HTMLDivElement> & SpinnerExtraProps

// eslint-disable-next-line i18next/no-literal-string
const rotation = keyframes`
  0% { transform: rotate(0deg) }
  100% { transform: rotate(360deg) }
`

const variantSizes = {
  small: {
    width: "16px",
    height: "16px",
  },
  medium: {
    width: "30px",
    height: "30px",
  },
  large: {
    width: "42px",
    height: "42px",
  },
}

// eslint-disable-next-line i18next/no-literal-string
const StyledSpinner = styled.div<SpinnerProps>`
  width: ${(props) => variantSizes[props.variant].width};
  height: ${(props) => variantSizes[props.variant].height};
  border: 5px solid #f1f1f1;
  border-bottom-color: ${baseTheme.colors.green[500]};
  border-radius: 50%;
  display: inline-block;
  animation: ${rotation} 1s linear infinite;
`

const Spinner: React.FC<SpinnerProps> = (props) => {
  return <StyledSpinner {...props}></StyledSpinner>
}

export default Spinner
