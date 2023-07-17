import { ThemeProvider } from "@mui/material"
import React from "react"
import { Provider } from "react-redux"

import { PrivateSpecQuiz } from "../../../types/quizTypes/privateSpec"
import muiTheme from "../../shared-module/styles/muiTheme"
import store from "../../store/store"

import EditorImpl from "./EditorImpl"

export interface EditorProps {
  port: MessagePort
  privateSpec: PrivateSpecQuiz
}
// Wrapper enables to use the redux provider only for the editor
const Editor: React.FC<React.PropsWithChildren<EditorProps>> = (props) => {
  return (
    <Provider store={store}>
      <ThemeProvider theme={muiTheme}>
        <EditorImpl {...props} />
      </ThemeProvider>
    </Provider>
  )
}

export default Editor
