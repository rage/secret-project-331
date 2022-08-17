import React from "react"

import { PublicQuiz } from "../../types/types"
import { UserInformation } from "../shared-module/exercise-service-protocol-types"

import Widget from "./widget"

export interface ExerciseProps {
  port: MessagePort
  quiz: PublicQuiz
  user_information: UserInformation
}

const Exercise: React.FC<React.PropsWithChildren<ExerciseProps>> = ({
  port,
  quiz,
  user_information,
}) => {
  return <Widget port={port} quiz={quiz} user_information={user_information} />
}

export default Exercise
