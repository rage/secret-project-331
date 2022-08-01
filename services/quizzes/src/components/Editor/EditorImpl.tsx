import React, { useEffect, useState } from "react"
import { useDispatch } from "react-redux"

import { useSendEditorStateOnChange } from "../../hooks/useSendEditorStateOnChange"
import { initializedEditor } from "../../store/editor/editorActions"
import { useTypedSelector } from "../../store/store"
import { normalizeData } from "../../util/normalizerFunctions"
import BasicInformation from "../QuizEditForms/BasicInfo"
import QuizItems from "../QuizEditForms/QuizItems"

import { EditorProps } from "."

const EditorImpl: React.FC<React.PropsWithChildren<EditorProps>> = ({ port, privateSpec }) => {
  const [render, setRender] = useState(false)
  const dispatch = useDispatch()
  useEffect(() => {
    dispatch(initializedEditor(normalizeData(privateSpec), privateSpec))
    setRender(true)
  }, [dispatch, privateSpec])
  const state = useTypedSelector((state) => state)
  useSendEditorStateOnChange(port, state)

  if (!render) {
    return null
  }

  return (
    <>
      <QuizItems />
      <BasicInformation />
    </>
  )
}

export default EditorImpl
