import React from "react"

import { useSendEditorStateOnChange } from "../hooks/useSendEditorStateOnChange"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"
import { useTypedSelector } from "../store/store"

import BasicInformation from "./QuizEditForms/BasicInfo"
import QuizItems from "./QuizEditForms/QuizItems"

interface EditorProps {
  port: MessagePort
}

const Editor: React.FC<EditorProps> = ({ port }) => {
  const state = useTypedSelector((state) => state)
  useSendEditorStateOnChange(port, state)

  return (
    <HeightTrackingContainer port={port}>
      <QuizItems />
      <BasicInformation />
    </HeightTrackingContainer>
  )
}

export default Editor
