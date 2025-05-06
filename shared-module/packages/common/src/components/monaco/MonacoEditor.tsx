import { EditorProps } from "@monaco-editor/react"
import React from "react"

import dynamicImport from "../../utils/dynamicImport"

const MonacoEditorImpl = dynamicImport(() => import("./impl/MonacoEditorImpl"))

const MonacoEditor: React.FC<React.PropsWithChildren<EditorProps>> = (props) => {
  return <MonacoEditorImpl {...props} />
}

export default MonacoEditor
