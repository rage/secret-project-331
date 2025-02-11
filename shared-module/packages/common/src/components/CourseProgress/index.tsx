import React from "react"

import CircularProgress from "./CircularProgress"
import ProgressBar from "./ProgressBar"
export interface CircularProgressExtraProps {
  variant: "circle"
  size?: "medium" | "large"
  max: number | null
  given: number | null
  label: string
  required?: number
}
export interface ProgressBarExtraProps {
  variant: "bar"
  showAsPercentage?: boolean
  exercisesAttempted: number | null
  exercisesTotal: number | null
  height?: string
  label: string
  required?: number
}

type ProgressExtraProps = CircularProgressExtraProps | ProgressBarExtraProps

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & ProgressExtraProps

const Progress: React.FC<React.PropsWithChildren<ProgressProps>> = (
  props,
) => {
  return (
    <>{props.variant === "circle" ? <CircularProgress {...props} /> : <ProgressBar {...props} />}</>
  )
}

export default Progress
