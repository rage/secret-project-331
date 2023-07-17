import React, { useState } from "react"

import { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"
import QuizzesExerciseServiceContext from "../contexts/QuizzesExerciseServiceContext"

// import BasicInformation from "./QuizEditForms/BasicInfo"
import QuizItemsV2 from "./QuizV2/QuizCreation"

export interface EditorProps {
  port: MessagePort
  privateSpec: PrivateSpecQuiz
}

const EditorImpl: React.FC<React.PropsWithChildren<EditorProps>> = ({ port, privateSpec }) => {
  const [outputState, setOutputState] = useState<PrivateSpecQuiz | null>(privateSpec)
  return (
    <QuizzesExerciseServiceContext.Provider
      value={{
        outputState,
        port: port,
        _rawSetOutputState: setOutputState,
      }}
    >
      <QuizItemsV2 />
      {/* TODO: port to use the new hook instead of redux <BasicInformation /> */}
    </QuizzesExerciseServiceContext.Provider>
  )
}

export default EditorImpl
