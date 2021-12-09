import React from "react"

import { PublicQuiz } from "../../types/types"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"

import Widget from "./widget"

export interface ExerciseProps {
  port: MessagePort
  maxWidth: number
  quiz: PublicQuiz
}

const Exercise: React.FC<ExerciseProps> = ({ port, maxWidth, quiz }) => {
  return (
    <HeightTrackingContainer port={port}>
      <Widget port={port} maxWidth={maxWidth} quiz={quiz} />
    </HeightTrackingContainer>
  )
}

export default Exercise
