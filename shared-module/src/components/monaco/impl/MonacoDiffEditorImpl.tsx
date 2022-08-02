import { DiffEditor, DiffEditorProps } from "@monaco-editor/react"
import React from "react"
import "./loader"

import { monospaceFont } from "../../../styles"
import monacoFontFixer from "../../../styles/monacoFontFixer"

const WORDWRAP_DEFAULT_VALUE = "on"

const MonacoDiffEditorImpl: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<DiffEditorProps>>
> = (props) => {
  const options = props.options ?? {}
  options.fontFamily = monospaceFont
  if (!options.wordWrap) {
    options.wordWrap = WORDWRAP_DEFAULT_VALUE
  }
  return (
    <div className={monacoFontFixer}>
      <DiffEditor {...props} options={options} />
    </div>
  )
}

export default MonacoDiffEditorImpl
