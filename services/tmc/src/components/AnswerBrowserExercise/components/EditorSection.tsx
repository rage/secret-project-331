import { Editor } from "@monaco-editor/react"
import _ from "lodash"
import React from "react"

import { EditorSection as EditorSectionStyled, EditorWrapper } from "../styles"
import { extensionToLanguage } from "../utils"

import type { ExerciseFile } from "@/util/stateInterfaces"

interface EditorSectionProps {
  filepath: string
  contents: string
  editorKey: number
  editorFiles: ExerciseFile[]
  setEditorState: (files: ExerciseFile[]) => void
  readOnly?: boolean
}

export const EditorSection: React.FC<EditorSectionProps> = (props) => {
  const { filepath, contents, editorKey, editorFiles, setEditorState, readOnly = false } = props
  const language = extensionToLanguage(filepath)
  const onChange = (newContents: string | undefined) => {
    if (readOnly || newContents === undefined) {
      return
    }
    const newState = _.cloneDeep(editorFiles)
    const changed = newState.find((ef) => ef.filepath === filepath)
    if (changed) {
      changed.contents = newContents
    }
    setEditorState(newState)
  }
  return (
    <EditorSectionStyled>
      <EditorWrapper height="400px">
        <Editor
          key={editorKey}
          height="100%"
          width="100%"
          {...(language !== undefined ? { language } : {})}
          value={contents}
          onChange={onChange}
          options={{ readOnly }}
        />
      </EditorWrapper>
    </EditorSectionStyled>
  )
}
