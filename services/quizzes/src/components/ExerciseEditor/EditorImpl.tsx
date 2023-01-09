import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { PrivateSpecQuiz } from "../../../types/quizTypes"
import QuizzesExerciseServiceContext from "../../contexts/QuizzesExerciseServiceContext"
import { useSendEditorStateOnChange } from "../../hooks/useSendEditorStateOnChange"
import Button from "../../shared-module/components/Button"
import { initializedEditor } from "../../store/editor/editorActions"
import { useTypedSelector } from "../../store/store"
import { denormalizeData, normalizeData } from "../../util/normalizerFunctions"
import { migrateQuiz } from "../../util/quizMigration"
import BasicInformation from "../QuizEditForms/BasicInfo"
import QuizItems from "../QuizEditForms/QuizItems"
import QuizItemsV2 from "../QuizV2/QuizCreation"

import { EditorProps } from "."

const EditorImpl: React.FC<React.PropsWithChildren<EditorProps>> = ({ port, privateSpec }) => {
  const [render, setRender] = useState(false)
  const [migratedQuiz, setMigratedQuiz] = useState<PrivateSpecQuiz | null>(null)
  const [experimentalMode, setExperimentalMode] = useState(true)

  const dispatch = useDispatch()
  useEffect(() => {
    dispatch(initializedEditor(normalizeData(privateSpec), privateSpec))
    setRender(true)
  }, [dispatch, privateSpec])
  const state = useTypedSelector((state) => state)
  useSendEditorStateOnChange(port, state)
  const { t } = useTranslation()

  if (!render) {
    return null
  }

  // Preload migrated quiz
  if (state && !migratedQuiz) {
    setMigratedQuiz(migrateQuiz(denormalizeData(state)))
  }

  const toggleMode = () => {
    setMigratedQuiz(migrateQuiz(denormalizeData(state)))
    setExperimentalMode(!experimentalMode)
  }

  return (
    <QuizzesExerciseServiceContext.Provider
      value={{
        outputState: migratedQuiz,
        port: port,
        _rawSetOutputState: setMigratedQuiz,
      }}
    >
      {experimentalMode ? <QuizItemsV2 quiz={migratedQuiz} /> : <QuizItems />}
      <BasicInformation />
      <Button variant="secondary" size="small" onClick={() => toggleMode()}>
        {t("switch-to-experimental-mode")}
      </Button>
    </QuizzesExerciseServiceContext.Provider>
  )
}

export default EditorImpl
