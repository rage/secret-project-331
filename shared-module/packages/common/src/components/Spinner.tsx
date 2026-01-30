"use client"

import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"

import { baseTheme } from "../styles"
import { SPINNER_CLASS } from "../utils/constants"

export interface SpinnerProps {
  variant?: "large" | "medium" | "small" | "placeholder"
  disableMargin?: boolean
}
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
  placeholder: {
    width: "30px",
    height: "30px",
  },
}

const StyledSpinner = styled.div<SpinnerProps>`
  margin: ${(props) => (props.disableMargin ? "0" : "1rem")};
  width: ${(props) => variantSizes[props.variant || "medium"].width};
  height: ${(props) => variantSizes[props.variant || "medium"].height};
  border: ${(props) => (props.variant === "placeholder" ? "4px dashed" : "5px solid")} #f1f1f1;
  border-bottom-color: ${(props) =>
    props.variant === "placeholder" ? baseTheme.colors.blue[500] : baseTheme.colors.green[500]};
  border-top-color: ${(props) =>
    props.variant === "placeholder" ? baseTheme.colors.blue[300] : "transparent"};
  border-radius: 50%;
  display: inline-block;
  /** Showing the spinner is delayed because showing a spinner for a moment on fast transitions makes the application to feel like more slow than it is **/
  opacity: 0;
  animation-name: ${rotation}, ${fadeIn};
  animation-duration: ${(props) => (props.variant === "placeholder" ? "0.8s" : "1s")}, 600ms;
  animation-timing-function: linear, ease;
  animation-iteration-count: infinite, 1;
  animation-delay: 400ms;
  animation-fill-mode: forwards;
`

const Spinner = (props: SpinnerProps) => {
  return <StyledSpinner className={SPINNER_CLASS} {...props}></StyledSpinner>
}

export default Spinner
