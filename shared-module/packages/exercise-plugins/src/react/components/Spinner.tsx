"use client"

import { css, keyframes } from "@emotion/css"

const rotation = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`

const spinner = css`
  margin: 1rem;
  width: 30px;
  height: 30px;
  border: 5px solid #90abc3;
  border-bottom-color: #44827e;
  border-radius: 50%;
  display: inline-block;
  animation: ${rotation} 1s linear infinite;
`

// A small, dependency-free loading spinner shared across exercise services. Colors are baked in so
// the component does not depend on any consumer's theme.
const Spinner: React.FC = () => <div className={spinner} />

export default Spinner
