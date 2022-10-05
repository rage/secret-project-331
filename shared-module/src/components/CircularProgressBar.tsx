import styled from "@emotion/styled"
import React from "react"

import { baseTheme, headingFont } from "../styles"

export interface CircularProgressBarExtraProps {
  scoreMaximum: number
  userPoints: number
}

interface CircleBoxProps {
  point: number
}

export type CircularProgressBarProps = React.HTMLAttributes<HTMLDivElement> &
  CircularProgressBarExtraProps

// eslint-disable-next-line i18next/no-literal-string
const CircleBox = styled.div`
  width: 60px;
  height: 60px;
  margin: 0.2rem !important;
  display: inline-block;
  dislay: relative;
  padding: 0;
  .progress {
    position: absolute;
    height: 60px;
    width: 60px;
    cursor: pointer;
  }

  .progress-circle {
    transform: rotate(-90deg);
  }

  .progress-circle-bg {
    fill: none;
    stroke: ${baseTheme.colors.green[200]};
    stroke-width: 7px;
    stroke-linecap: round;
  }
  .progress-circle-value {
    fill: none;
    stroke: ${baseTheme.colors.green[600]};
    stroke-width: 7px;
    stroke-linecap: round;
    stroke-dasharray: 131 131;
    stroke-dashoffset: ${({ point }: CircleBoxProps) => 131 - point * 131};
    transition: stroke-dashoffset 0.7s ease-in-out;
  }
  .progress-text {
    position: absolute;
    top: 20px;
    left: 21px;
    font-size: 12px;
    font-family: ${headingFont};
  }
`
// To get the appropriate stroke-dasharray; It is 2 * PI * radius = 131

const CircularProgressBar: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<CircularProgressBarProps>>
> = ({ scoreMaximum, userPoints }) => {
  const complete = userPoints / scoreMaximum
  return (
    <CircleBox point={complete}>
      <div className="progress">
        <svg className="progress-circle" width="60" height="60" xmlns="http://www.w3.org/2000/svg">
          <circle className="progress-circle-bg" cx="50%" cy="50%" r="20.9155"></circle>
          <circle
            className="progress-circle-value update-value"
            cx="50%"
            cy="50%"
            r="20.9155"
          ></circle>
        </svg>
        <div className="progress-text" data-progress="50">
          {userPoints}/{scoreMaximum}
        </div>
      </div>
    </CircleBox>
  )
}

export default CircularProgressBar
