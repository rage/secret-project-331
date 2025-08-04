import { Editor, EditorProps } from "@monaco-editor/react"
import React from "react"
import "./loader"

import { monospaceFont } from "../../../styles"
import monacoStylesFixer from "../../../styles/monacoStylesFixer"

const WORDWRAP_DEFAULT_VALUE = "on"

const MonacoEditorImpl: React.FC<React.PropsWithChildren<EditorProps>> = (props) => {
  const options = props.options ?? {}
  options.fontFamily = monospaceFont
  if (!options.wordWrap) {
    options.wordWrap = WORDWRAP_DEFAULT_VALUE
  }
  return (
    <div className={monacoStylesFixer}>
      <Editor {...props} options={options} />
    </div>
  )
}

export default MonacoEditorImpl
