import { DiffEditorProps } from "@monaco-editor/react"
import React from "react"

import dynamicImport from "../../utils/dynamicImport"

const MonacoDiffEditorImpl = dynamicImport(() => import("./impl/MonacoDiffEditorImpl"))

const MonacoDiffEditor: React.FC<React.PropsWithChildren<DiffEditorProps>> = (props) => {
  return <MonacoDiffEditorImpl {...props} />
}

export default MonacoDiffEditor
