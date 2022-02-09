import React, { useEffect, useState } from "react"
import { useDispatch } from "react-redux"

import { useSendEditorStateOnChange } from "../../hooks/useSendEditorStateOnChange"
import HeightTrackingContainer from "../../shared-module/components/HeightTrackingContainer"
import { initializedEditor } from "../../store/editor/editorActions"
import { useTypedSelector } from "../../store/store"
import { normalizeData } from "../../util/normalizerFunctions"
import BasicInformation from "../QuizEditForms/BasicInfo"
import QuizItems from "../QuizEditForms/QuizItems"

import { EditorProps } from "."

const EditorImpl: React.FC<EditorProps> = ({ port, privateSpec }) => {
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
    // HeightTracking container needed here again because of Redux
    <HeightTrackingContainer port={port}>
      <QuizItems />
      <BasicInformation />
    </HeightTrackingContainer>
  )
}

export default EditorImpl
