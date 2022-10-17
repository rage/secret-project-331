import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { useSendEditorStateOnChange } from "../../hooks/useSendEditorStateOnChange"
import Button from "../../shared-module/components/Button"
import { initializedEditor } from "../../store/editor/editorActions"
import { useTypedSelector } from "../../store/store"
import { normalizeData } from "../../util/normalizerFunctions"
import BasicInformation from "../QuizEditForms/BasicInfo"
import QuizItems from "../QuizEditForms/QuizItems"
import QuizItemsV2 from "../QuizV2/QuizCreation"

import { EditorProps } from "."

const EditorImpl: React.FC<React.PropsWithChildren<EditorProps>> = ({ port, privateSpec }) => {
  const [render, setRender] = useState(false)
  const [experimentalMode, setExperimentalMode] = useState(false)

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

  const toggleMode = () => {
    setExperimentalMode(!experimentalMode)
  }

  return (
    <>
      {experimentalMode ? <QuizItemsV2 /> : <QuizItems />}
      <BasicInformation />
      <Button variant="secondary" size="small" onClick={() => toggleMode()}>
        {experimentalMode ? t("switch-to-original-mode") : t("switch-to-experimental-mode")}
      </Button>
    </>
  )
}

export default EditorImpl
