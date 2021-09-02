import styled from "@emotion/styled"
import React from "react"

import { baseTheme, headingFont } from "../styles"

export interface ExtraProps {
  variant?: "large" | "medium" | "small"
  point: number
}

export type CircularProgressBarProps = React.HTMLAttributes<HTMLDivElement> & ExtraProps

const CircleBox = styled.div`
  width: 50px;
  height: 50px;
  margin: 0.2rem !important;
  display: inline-block;
  position: relative;
  padding: 0;
  .progress {
    position: absolute;
    height: 60px;
    width: 60px;
    cursor: pointer;
  }

  .progress-circle {
    transform: rotate(-90deg);
    margin-top: 0px;
  }

  .progress-circle-bg {
    fill: none;
    stroke: #d2d2d2;
    stroke-width: 4px;
  }
  .progress-circle-value {
    fill: none;
    stroke: ${baseTheme.colors.green[100]};
    stroke-width: 4px;
    stroke-dasharray: 100 100;
    stroke-dashoffset: ${({ point }: ExtraProps) => 100 - point * 100};
    transition: stroke-dashoffset 0.7s ease-in-out;
  }
  .progress-text {
    position: absolute;
    top: 16px;
    left: 18px;
    font-size: 12px;
    font-family: ${headingFont};
  }
`

const CircularProgressBar: React.FC<CircularProgressBarProps> = ({ point }) => {
  const complete = point / 100
  return (
    <CircleBox point={complete}>
      <div className="progress">
        <svg
          className="progress-circle"
          width="50px"
          height="50px"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle className="progress-circle-bg" cx="26" cy="26" r="15.9155"></circle>
          <circle
            className="progress-circle-value update-value"
            cx="26"
            cy="26"
            r="15.9155"
          ></circle>
        </svg>
        <div className="progress-text" data-progress="50">
          1/2
        </div>
      </div>
    </CircleBox>
  )
}

export default CircularProgressBar
