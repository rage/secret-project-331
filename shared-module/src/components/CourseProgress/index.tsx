import { ThemeProvider } from "@emotion/react"
import React from "react"

import { theme } from "../../utils"

import ProgressBar from "./ProgressBar"
import ScoreBoard from "./ScoreBoard"

export interface CourseProgressExtraProps {
  variant: "circle" | "bar"
  size: "medium" | "large"
  max: number | null
  min: number | null
  point: number
  n: number
  exercisesDone: number
  exercisesTotal: number
  label: string
}

export type CourseProgressProps = React.HTMLAttributes<HTMLDivElement> & CourseProgressExtraProps

const CoureProgress: React.FC<CourseProgressProps> = (props) => {
  return (
    <ThemeProvider theme={theme}>
      {props.variant === "circle" ? (
        <ScoreBoard {...props}></ScoreBoard>
      ) : (
        <ProgressBar {...props} />
      )}
    </ThemeProvider>
  )
}

export default CoureProgress
