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
    stroke: #fff;
    stroke-width: 4px;
  }
  .progress-circle-value {
    fill: none;
    stroke: ${baseTheme.colors.blue[600]};
    stroke-width: 4px;
    stroke-dasharray: 100 100;
    stroke-dashoffset: ${({ point }: CircleBoxProps) => 100 - point * 100};
    transition: stroke-dashoffset 0.7s ease-in-out;
  }
  .progress-text {
    position: absolute;
    top: 17px;
    left: 36px;
    font-size: 12px;
    font-family: ${headingFont};
  }
`

const CircularProgressBar: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<CircularProgressBarProps>>
> = ({ scoreMaximum, userPoints }) => {
  const complete = userPoints / scoreMaximum
  return (
    <CircleBox point={complete}>
      <div className="progress">
        <svg
          className="progress-circle"
          width="74px"
          height="80px"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle className="progress-circle-bg" cx="50" cy="50" r="15.9155"></circle>
          <circle
            className="progress-circle-value update-value"
            cx="50"
            cy="50"
            r="15.9155"
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
