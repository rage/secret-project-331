import React from "react"

import { PublicQuiz } from "../../types/types"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"

import Widget from "./widget"

export interface PlaygroundExerciseProps {
  port: MessagePort
  maxWidth: number | null
  quiz: PublicQuiz
}

const PlaygroundExercise: React.FC<PlaygroundExerciseProps> = ({ port, maxWidth, quiz }) => {
  return (
    <HeightTrackingContainer port={port}>
      <Widget quiz={quiz} maxWidth={maxWidth} port={port} />
    </HeightTrackingContainer>
  )
}

export default PlaygroundExercise
