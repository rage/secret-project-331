import { css } from "@emotion/css"
import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

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
}
interface LinearProgressProps {
  height: string
}

// eslint-disable-next-line i18next/no-literal-string
const load = (percentage: number) => keyframes`
  0% { width: 0; }
  100% { width: ${percentage}%; }
`

// eslint-disable-next-line i18next/no-literal-string
const LinearProgressFill = styled.div<LinearProgressFillProps>`
  animation: ${(props: LinearProgressFillProps) => load(props.percentage)} 3s normal forwards;
  height: ${({ height }) => (height === "small" ? "16px" : "20px")};
  width: 0;
  background: ${baseTheme.colors.green[600]};
  justify-content: end;

  ${respondToOrLarger.sm} {
    height: ${({ height }) => (height === "small" ? "16px" : "28px")};
  }
`

const Label = styled.div`
  min-width: 100%;
  font-weight: 500;
  margin-right: 1rem;
  margin-bottom: 0.4rem;
  text-align: center;
  padding-left: 10px;

  span:first-of-type {
    font-size: 0.8em;
    font-weight: 400;
    font-family: ${headingFont};
    opacity: 0.9;
    text-transform: uppercase;
  }
  ${respondToOrLarger.sm} {
    span:first-of-type {
      font-size: 1.2em;
    }
  }
`

const ProgresssBar: React.FC<ProgressBarExtraProps> = ({
  showAsPercentage = false,
  exercisesAttempted = 10,
  exercisesTotal = 30,
  height = "medium",
  label = true,
}) => {
  const { t } = useTranslation()
  const done = exercisesAttempted ?? 0
  const total = exercisesTotal ?? 0
  const exerciseScaled = showAsPercentage && done !== 0 && total !== 0 ? (done / total) * 100 : 0
  const percentage = Math.floor(exerciseScaled)
  return (
    <>
      <div
        className={css`
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
        `}
      >
        {label && (
          <Label>
            <span>
              {showAsPercentage
                ? `${percentage}% ${t("exercises-attempted")}`
                : `${done} / ${total} ${t("exercises-attempted")}`}
            </span>
          </Label>
        )}
        <LinearProgress height={height}>
          <LinearProgressFill percentage={percentage} height={height} />
        </LinearProgress>
      </div>
    </>
  )
}

export default ProgresssBar
