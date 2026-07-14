import cloneDeep from "lodash/cloneDeep"
import { useEffect, useRef, useState } from "react"

import type { ExerciseFile, ExerciseIframeState } from "@/util/stateInterfaces"

export function useEditorState(
  initialState: ExerciseFile[],
  stubDownloadUrl: string,
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void,
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
    setState((old) => {
      if (old?.view_type === "answer-exercise") {
        return { ...old, user_answer: { type: "browser", files } }
      }
      return old ?? null
    })
  }

  const resetToInitial = () => {
    setEditorState(cloneDeep(originalStateRef.current))
    setEditorKey((k) => k + 1)
  }

  return { editorFiles, editorKey, setEditorState, resetToInitial }
}
