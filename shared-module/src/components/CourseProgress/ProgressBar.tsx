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
  background: ${baseTheme.colors.yellow[200]};
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
const load = (percentage: number) => keyframes`
  0% { width: 0; }
  100% { width: ${percentage}%; }
`

// eslint-disable-next-line i18next/no-literal-string
const LinearProgressFill = styled.div<LinearProgressFillProps>`
  animation: ${(props: LinearProgressFillProps) => load(props.percentage)} 3s normal forwards;
  height: ${({ height }) => (height === "small" ? "16px" : "20px")};
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  background: ${(props) =>
    props.light ? baseTheme.colors.green[100] : baseTheme.colors.green[600]};
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
    font-weight: 600;
    font-family: ${headingFont};
    color: #313947;
  }
  ${respondToOrLarger.sm} {
    span:first-of-type {
      font-size: 1.1em;
    }
  }
`

const ProgresssBar: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<ProgressBarExtraProps>>
> = ({
  showAsPercentage = false,
  exercisesAttempted,
  exercisesTotal,
  height = "medium",
  label = true,
  required,
}) => {
  const { t } = useTranslation()
  const ratio = (exercisesTotal ?? 0) > 0 ? (exercisesAttempted ?? 0) / (exercisesTotal ?? 0) : 0
  const requiredRatio = (exercisesTotal ?? 0) > 0 ? (required ?? 0) / (exercisesTotal ?? 0) : 0

  const percentage = ratio * 100
  const requiredPercentage = requiredRatio * 100

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
                : `${exercisesAttempted ?? 0} / ${exercisesTotal ?? 0} ${t("exercises-attempted")}`}
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
            <LinearProgressFill percentage={percentage} height={height} />
          </div>
        </LinearProgress>
      </div>
    </>
  )
}

export default ProgresssBar
