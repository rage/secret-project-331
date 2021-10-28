import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { headingFont } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"

import CourseProgressExtraProps from "./index"

const load = keyframes`
  0% { width: 0; }
  100% { width: 68%; }

`

const LinearProgress = styled.div`
  background: #24124b;
  justify-content: flex-start;
  border-radius: 100px;
  align-items: center;
  position: relative;
  padding: 0 5px;
  display: flex;
  height: 30px;
  width: 290px;

  ${respondToOrLarger.sm} {
    height: 40px;
    width: 500px;
  }

  div {
    animation: ${load} 3s normal forwards;
    border-radius: 100px;
    height: 20px;
    width: 0;
    background: #f4649f;
    display: flex;
    justify-content: end;

    ${respondToOrLarger.sm} {
      height: 30px;
    }

    span {
      display: block;
      justify-self: end;
      color: white;
    }
  }
`

const Label = styled.div`
  min-width: 125px;
  font-weight: 500;
  margin-right: 1rem;
  display: grid;
  margin-bottom: 0.4rem;
  grid-template-columns: 1fr 1fr;
  align-items: center;

  span:first-of-type {
    justify-self: start;
    font-size: 1.2em;
    font-weight: 400;
    font-family: ${headingFont};
    opacity: 0.9;
  }

  span:last-child {
    justify-self: end;
    font-weight: 700;
    font-size: 0.8em;
  }
`

export interface CourseProgressExtraProps {
  max: number | null
  given: number | null
  point: number
  n: number
  exercisesDone: number
  exercisesTotal: number
  label: string
}

const ProgresssBar: React.FC<CourseProgressExtraProps> = ({
  n = 20,
  exercisesDone = 10,
  exercisesTotal = 30,
}) => {
  const { t } = useTranslation()
  const exerciseScaled = (exercisesDone / exercisesTotal) * 100
  const percentage = Math.floor(exerciseScaled)
  return (
    <div>
      <Label>
        <span>
          {n ? t("percent-done", { percentage }) : `${exercisesDone} / ${exercisesTotal}`}
        </span>
        <span></span>{" "}
      </Label>
      {/* <BorderLinearProgress variant="determinate" value={n ? exerciseScaled : pointScaled} /> */}
      <LinearProgress>
        <div></div>
      </LinearProgress>
    </div>
  )
}

export default ProgresssBar
