import { ThemeProvider } from "@mui/material"
import React from "react"
import { Provider } from "react-redux"

import { useSendEditorStateOnChange } from "../hooks/useSendEditorStateOnChange"
import muiTheme from "../shared-module/styles/muiTheme"
import store, { useTypedSelector } from "../store/store"

import BasicInformation from "./QuizEditForms/BasicInfo"
import QuizItems from "./QuizEditForms/QuizItems"

interface EditorProps {
  port: MessagePort
}

const Editor: React.FC<EditorProps> = ({ port }) => {
  const state = useTypedSelector((state) => state)
  useSendEditorStateOnChange(port, state)

  return (
    <Provider store={store}>
      <ThemeProvider theme={muiTheme}>
        <QuizItems />
        <BasicInformation />
      </ThemeProvider>
    </Provider>
  )
}

export default Editor
