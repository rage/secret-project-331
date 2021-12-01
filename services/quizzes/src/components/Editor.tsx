import React from "react"

import { useSendEditorStateOnChange } from "../hooks/useSendEditorStateOnChange"
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
    <div>
      <BasicInformation />
      <QuizItems />
    </div>
  )
}

export default Editor
