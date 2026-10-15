import cloneDeep from "lodash/cloneDeep"
import { useEffect, useRef, useState } from "react"

import type { ExerciseFile } from "@/util/stateInterfaces"

export function useEditorState(
  initialState: ExerciseFile[],
  stubDownloadUrl: string,
  onFilesChange?: (files: ExerciseFile[]) => void,
) {
  const originalStateRef = useRef<ExerciseFile[]>(cloneDeep(initialState))
  const [editorFiles, setEditorFiles] = useState(initialState)
  const [editorKey, setEditorKey] = useState(0)

  useEffect(() => {
    originalStateRef.current = cloneDeep(initialState)
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- sync only when exercise changes
  }, [stubDownloadUrl])

  const setEditorState = (files: ExerciseFile[]) => {
    setEditorFiles(files)
    onFilesChange?.(files)
  }

  const resetToInitial = () => {
    setEditorState(cloneDeep(originalStateRef.current))
    setEditorKey((k) => k + 1)
  }

  return { editorFiles, editorKey, setEditorState, resetToInitial }
}
