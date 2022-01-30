import React from "react"

import { PublicQuiz } from "../../types/types"

import Widget from "./widget"

export interface ExerciseProps {
  port: MessagePort
  quiz: PublicQuiz
}

const Exercise: React.FC<ExerciseProps> = ({ port, quiz }) => {
  return <Widget port={port} quiz={quiz} />
}

export default Exercise
