import { css } from "@emotion/css"
import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { baseTheme, headingFont } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"

import { ProgressBarExtraProps } from "."

const LinearProgress = styled.div`
  display: flex;
  background: ${baseTheme.colors.yellow[100]};
  border-radius: 100px;
  align-items: center;
  padding: 0 5px;
  height: 30px;
  width: 290px;

  ${respondToOrLarger.sm} {
    height: 40px;
    width: 500px;
  }
`
interface LinearProgressFillProps {
  percentage: number
}

// eslint-disable-next-line i18next/no-literal-string
const load = (percentage: number) => keyframes`
  0% { width: 0; }
  100% { width: ${percentage}%; }
`

// eslint-disable-next-line i18next/no-literal-string
const LinearProgressFill = styled.div<LinearProgressFillProps>`
  animation: ${(props: LinearProgressFillProps) => load(props.percentage)} 3s normal forwards;
  border-radius: 100px;
  height: 20px;
  width: 0;
  background: ${baseTheme.colors.yellow[700]};
  justify-content: end;

  ${respondToOrLarger.sm} {
    height: 30px;
  }
`

const Label = styled.div`
  min-width: 265px;
  font-weight: 500;
  margin-right: 1rem;
  margin-bottom: 0.4rem;
  text-align: left;

  span:first-of-type {
    font-size: 0.8em;
    font-weight: 400;
    font-family: ${headingFont};
    opacity: 0.9;
    text-transform: uppercase;
  }
  ${respondToOrLarger.sm} {
    min-width: 450px;
    span:first-of-type {
      font-size: 1.2em;
    }
  }
`

const ProgresssBar: React.FC<ProgressBarExtraProps> = ({
  showAsPercentage = false,
  exercisesDone = 10,
  exercisesTotal = 30,
}) => {
  const { t } = useTranslation()
  const done = exercisesDone ?? 0
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
        <Label>
          <span>
            {showAsPercentage
              ? `${percentage}% ${t("exercises-attempted")}`
              : `${done} / ${total} ${t("exercises-attempted")}`}
          </span>
        </Label>
        <LinearProgress>
          <LinearProgressFill percentage={percentage} />
        </LinearProgress>
      </div>
    </>
  )
}

export default ProgresssBar
