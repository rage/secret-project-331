import { Editor, EditorProps } from "@monaco-editor/react"
import React from "react"
import "./loader"

import { monospaceFont } from "../../../styles"
import monacoFontFixer from "../../../styles/monacoFontFixer"

const WORDWRAP_DEFAULT_VALUE = "on"

const MonacoEditorImpl: React.FC<React.PropsWithChildren<EditorProps>> = (props) => {
  const options = props.options ?? {}
  options.fontFamily = monospaceFont
  if (!options.wordWrap) {
    options.wordWrap = WORDWRAP_DEFAULT_VALUE
  }
  return (
    <div className={monacoFontFixer}>
      <Editor {...props} options={options} />
    </div>
  )
}

export default MonacoEditorImpl
