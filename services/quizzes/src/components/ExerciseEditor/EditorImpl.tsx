import React, { useEffect, useState } from "react"
import { useDispatch } from "react-redux"

import { PrivateSpecQuiz } from "../../../types/quizTypes/privateSpec"
import QuizzesExerciseServiceContext from "../../contexts/QuizzesExerciseServiceContext"
import { useSendEditorStateOnChange } from "../../hooks/useSendEditorStateOnChange"
import { useTypedSelector } from "../../store/store"
import { isOldQuiz } from "../../util/migration/migrationSettings"
import { migratePrivateSpecQuiz } from "../../util/migration/privateSpecQuiz"
import { denormalizeData } from "../../util/normalizerFunctions"
import BasicInformation from "../QuizEditForms/BasicInfo"
import QuizItemsV2 from "../QuizV2/QuizCreation"

import { EditorProps } from "."

const EditorImpl: React.FC<React.PropsWithChildren<EditorProps>> = ({ port, privateSpec }) => {
  const [render, setRender] = useState(false)
  const [migratedQuiz, setMigratedQuiz] = useState<PrivateSpecQuiz | null>(null)

  const dispatch = useDispatch()
  useEffect(() => {
    // dispatch(initializedEditor(normalizeData(privateSpec), privateSpec))
    setRender(true)
  }, [dispatch, privateSpec])
  const state = useTypedSelector((state) => state)
  useSendEditorStateOnChange(port, state)

  if (!render) {
    return null
  }

  // Preload migrated quiz
  if (state && !migratedQuiz) {
    const quiz = denormalizeData(state)
    if (isOldQuiz(quiz)) {
      setMigratedQuiz(migratePrivateSpecQuiz(quiz))
    } else {
      setMigratedQuiz(quiz)
    }
  }

  return (
    <QuizzesExerciseServiceContext.Provider
      value={{
        outputState: migratedQuiz,
        port: port,
        _rawSetOutputState: setMigratedQuiz,
      }}
    >
      <QuizItemsV2 />
      <BasicInformation />
    </QuizzesExerciseServiceContext.Provider>
  )
}

export default EditorImpl
