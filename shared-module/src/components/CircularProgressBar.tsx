import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import React from "react"

import { baseTheme } from "../utils"

export interface SpinnerExtraProps {
  variant: "large" | "medium" | "small"
}

export type SpinnerProps = React.HTMLAttributes<HTMLDivElement> & SpinnerExtraProps

const rotation = keyframes`
0% { transform: rotate(0deg) }
100% { transform: rotate(360deg) }
`

const CircleBox = styled.div`
  font-size: 36px;
  color: #fff;
  text-align: center;

  div {
    position: relative;
  }

  span {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
    font-size: 40px;
  }

  circle {
    stroke-width: 20px;
    fill: none;
  }

  circle:nth-child(1) {
    stroke: #fff;
  }
  circle:nth-child(2) {
    stroke: #f00;
    position: relative;
    z-index: 1;
  }

  &:nth-child(1) circle:nth-child(2) {
    stroke-dasharray: calc(100 * 6);
    stroke-dashoffset: calc((100 * 6) - ((100 * 6) * 90) / 100);
    stroke-position: inside;
  }
`

const CircularProgressBar: React.FC<SpinnerProps> = (props) => {
  return (
    <CircleBox>
      <div>
        <svg>
          <circle cx="100" cy="100" r="95" />
          <circle cx="100" cy="100" r="95" />
        </svg>
        <span>90%</span>
      </div>
      <strong>c++ developer</strong>
    </CircleBox>
  )
}

export default CircularProgressBar
