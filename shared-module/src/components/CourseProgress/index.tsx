import React from "react"

import CircularProgress from "./CircularProgress"
import ProgressBar from "./ProgressBar"
export interface CircularProgressExtraProps {
  variant: "circle"
  size?: "medium" | "large"
  max: number | null
  given: number | null
  point: number
  label: string
}
export interface ProgressBarExtraProps {
  variant: "bar"
  showAsPercentage?: boolean
  exercisesAttempted: number | null
  exercisesTotal: number | null
  height?: string
  label?: boolean
}

type ProgressExtraProps = CircularProgressExtraProps | ProgressBarExtraProps

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & ProgressExtraProps

const Progress: React.FC<ProgressProps> = (props) => {
  return (
    <>{props.variant === "circle" ? <CircularProgress {...props} /> : <ProgressBar {...props} />}</>
  )
}

export default Progress
