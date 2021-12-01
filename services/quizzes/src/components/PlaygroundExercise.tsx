import React from "react"

import { PublicQuiz } from "../../types/types"

import Widget from "./widget"

export interface PlaygroundExerciseProps {
  port: MessagePort
  maxWidth: number | null
  quiz: PublicQuiz
}

const PlaygroundExercise: React.FC<PlaygroundExerciseProps> = ({ port, maxWidth, quiz }) => {
  return <Widget quiz={quiz} maxWidth={maxWidth} port={port} />
}

export default PlaygroundExercise
