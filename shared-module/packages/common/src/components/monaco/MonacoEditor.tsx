import { EditorProps } from "@monaco-editor/react"
import dynamic from "next/dynamic"
import React from "react"

import Spinner from "../Spinner"

const MonacoLoading = <Spinner variant="medium" />

const MonacoEditorImpl = dynamic(() => import("./impl/MonacoEditorImpl"), {
  ssr: false,
  loading: () => MonacoLoading,
})

const MonacoEditor: React.FC<React.PropsWithChildren<EditorProps>> = (
  props,
) => {
  return <MonacoEditorImpl {...props} />
}

export default MonacoEditor
