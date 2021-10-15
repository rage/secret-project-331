import React from "react"

import CircularProgress from "./CircularProgress"
import ProgressBar from "./ProgressBar"

export interface CourseProgressExtraProps {
  variant: "circle" | "bar"
  size: "medium" | "large"
  max: number | null
  given: number | null
  point: number
  n: number
  exercisesDone: number
  exercisesTotal: number
  label: string
}

export type CourseProgressProps = React.HTMLAttributes<HTMLDivElement> & CourseProgressExtraProps

const CoureProgress: React.FC<CourseProgressProps> = (props) => {
  return (
    <>{props.variant === "circle" ? <CircularProgress {...props} /> : <ProgressBar {...props} />}</>
  )
}

export default CoureProgress
