"use client"

import _ from "lodash"
import { useEffect, useRef, useState } from "react"

import { ExerciseFile, ExerciseIframeState } from "@/util/stateInterfaces"

export function useEditorState(
  initialState: Array<ExerciseFile>,
  stubDownloadUrl: string,
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void,
) {
  const originalStateRef = useRef<Array<ExerciseFile>>(_.cloneDeep(initialState))
  const [editorFiles, setEditorFiles] = useState(initialState)
  const [editorKey, setEditorKey] = useState(0)

  useEffect(() => {
    originalStateRef.current = _.cloneDeep(initialState)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when exercise changes
  }, [stubDownloadUrl])

  const setEditorState = (files: Array<ExerciseFile>) => {
    setEditorFiles(files)
    setState((old) => {
      if (old?.view_type === "answer-exercise") {
        return { ...old, user_answer: { type: "browser", files } }
      }
      return null
    })
  }

  const resetToInitial = () => {
    setEditorState(_.cloneDeep(originalStateRef.current))
    setEditorKey((k) => k + 1)
  }

  return { editorFiles, editorKey, setEditorState, resetToInitial }
}
