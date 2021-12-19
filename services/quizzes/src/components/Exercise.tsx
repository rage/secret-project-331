import React from "react"

import { PublicQuiz } from "../../types/types"

import Widget from "./widget"

export interface ExerciseProps {
  port: MessagePort
  maxWidth: number
  quiz: PublicQuiz
}

const Exercise: React.FC<ExerciseProps> = ({ port, maxWidth, quiz }) => {
  return <Widget port={port} maxWidth={maxWidth} quiz={quiz} />
}

export default Exercise
