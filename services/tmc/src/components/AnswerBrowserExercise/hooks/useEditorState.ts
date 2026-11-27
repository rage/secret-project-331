import cloneDeep from "lodash/cloneDeep"
import { useState } from "react"

import type { ExerciseFile } from "@/util/stateInterfaces"

export function useEditorState(
  initialState: ExerciseFile[],
  startingFiles: ExerciseFile[] | null,
  onFilesChange?: (files: ExerciseFile[]) => void,
) {
  const [editorFiles, setEditorFiles] = useState(initialState)
  const [editorKey, setEditorKey] = useState(0)

  const setEditorState = (files: ExerciseFile[]) => {
    setEditorFiles(files)
    onFilesChange?.(files)
  }

  const resetToStart = () => {
    if (startingFiles === null) {
      return
    }
    setEditorState(cloneDeep(startingFiles))
    setEditorKey((k) => k + 1)
  }

  return { editorFiles, editorKey, setEditorState, resetToStart }
}
