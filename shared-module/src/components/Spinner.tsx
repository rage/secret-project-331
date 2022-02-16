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

const fadeIn = keyframes`
0% {
  opacity: 0;
}
100% {
  opacity: 1;
}
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
  margin: 1rem;
  width: ${(props) => variantSizes[props.variant].width};
  height: ${(props) => variantSizes[props.variant].height};
  border: 5px solid #f1f1f1;
  border-bottom-color: ${baseTheme.colors.green[500]};
  border-radius: 50%;
  display: inline-block;
  /** Showing the spinner is delayed because showing a spinner for a moment on fast transitions makes the application to feel like more slow than it is **/
  opacity: 0;
  animation-name: ${rotation}, ${fadeIn};
  animation-duration: 1s, 600ms;
  animation-timing-function: linear, ease;
  animation-iteration-count: infinite, 1;
  animation-delay: 400ms;
  animation-fill-mode: forwards;
`

const Spinner: React.FC<SpinnerProps> = (props) => {
  return <StyledSpinner {...props}></StyledSpinner>
}

export default Spinner
