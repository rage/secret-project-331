import { DiffEditorProps } from "@monaco-editor/react"
import dynamic from "next/dynamic"
import React from "react"

import Spinner from "../Spinner"

const MonacoLoading = <Spinner variant="medium" />

const MonacoDiffEditorImpl = dynamic(() => import("./impl/MonacoDiffEditorImpl"), {
  ssr: false,
  loading: () => MonacoLoading,
})

const MonacoDiffEditor: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<DiffEditorProps>>
> = (props) => {
  return <MonacoDiffEditorImpl {...props} />
}

export default MonacoDiffEditor
