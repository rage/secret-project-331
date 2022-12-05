import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useEffect, useState } from "react"

import { baseTheme, headingFont } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"

import { ProgressBarExtraProps } from "."

// eslint-disable-next-line i18next/no-literal-string
const LinearProgress = styled.div<LinearProgressProps>`
  display: flex;
  background: ${baseTheme.colors.green[100]};
  border-radius: 100px;
  overflow: hidden;
  align-items: center;
  height: ${({ height }) => (height === "small" ? "16px" : "20px")};
  width: 290px;

  ${respondToOrLarger.sm} {
    height: ${({ height }) => (height === "small" ? "16px" : "28px")};
    /* width: 500px; */
    width: 100%;
  }
`
interface LinearProgressFillProps {
  percentage: number
  height: string
  light?: boolean
}
interface LinearProgressProps {
  height: string
}
// eslint-disable-next-line i18next/no-literal-string
const LinearProgressFill = styled.div<LinearProgressFillProps>`
  height: ${({ height }) => (height === "small" ? "16px" : "20px")};
  position: absolute;
  top: 0;
  left: 0;
  transition: 1.5s ease-in-out;
  border-radius: 50px;
  width: ${(props) => props.percentage}%;
  background: ${(props) =>
    props.light ? baseTheme.colors.yellow[200] : baseTheme.colors.green[600]};
  justify-content: end;

  ${respondToOrLarger.sm} {
    height: ${({ height }) => (height === "small" ? "16px" : "28px")};
  }
`

const Label = styled.div`
  min-width: 100%;
  font-weight: 500;
  margin-right: 1rem;
  margin-bottom: 0.5rem;
  text-align: center;
  padding-left: 10px;

  span:first-of-type {
    font-size: 0.8em;
    font-weight: 500;
    font-family: ${headingFont};
    color: #313947;
  }
  ${respondToOrLarger.sm} {
    span:first-of-type {
      font-size: 1.1em;
    }
  }
`

const ProgressBar: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<ProgressBarExtraProps>>
> = ({
  showAsPercentage = false,
  exercisesAttempted,
  exercisesTotal,
  height = "medium",
  label,
  required,
}) => {
  const ratio = (exercisesTotal ?? 0) > 0 ? (exercisesAttempted ?? 0) / (exercisesTotal ?? 0) : 0
  const requiredRatio = (exercisesTotal ?? 0) > 0 ? (required ?? 0) / (exercisesTotal ?? 0) : 0

  const percentage = ratio * 100
  const requiredPercentage = requiredRatio * 100
  // Make the progress bar animate from 0 when the page loads
  const [visualPercentage, setVisualPercentage] = useState(0)
  useEffect(() => {
    setTimeout(() => {
      setVisualPercentage(percentage)
    }, 100)
  }, [percentage])

  return (
    <>
      <div
        className={css`
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-transform: lowercase;
        `}
      >
        {label && (
          <Label>
            <span>
              {showAsPercentage
                ? `${percentage}% ${label}`
                : `${exercisesAttempted ?? 0} / ${exercisesTotal ?? 0} ${label}`}
            </span>
          </Label>
        )}
        <LinearProgress height={height}>
          <div
            className={css`
              width: 100%;
              position: relative;
              height: inherit;
            `}
          >
            <LinearProgressFill light percentage={requiredPercentage} height={height} />
            <LinearProgressFill percentage={visualPercentage} height={height} />
          </div>
        </LinearProgress>
      </div>
    </>
  )
}

export default ProgressBar
