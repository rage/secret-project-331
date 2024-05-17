import Editor from "@monaco-editor/react"
import _ from "lodash"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "../shared-module/components/Button"
import { ExerciseFile, ExerciseIframeState, PublicSpec } from "../util/stateInterfaces"

interface Props {
  initialPublicSpec: PublicSpec & { type: "browser" }
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
}

const AnswerBrowserExercise: React.FC<React.PropsWithChildren<Props>> = ({
  initialPublicSpec,
  setState,
}) => {
  const { t } = useTranslation()

  const initialEditorState = initialPublicSpec.files
  const [editorState, _setEditorState] = useState(initialEditorState)
  const setEditorState = (files: Array<ExerciseFile>) => {
    _setEditorState(files)
    setState((old) => {
      if (old?.viewType == "answer-exercise") {
        return { ...old, userAnswer: { type: "browser", files } }
      } else {
        return null
      }
    })
  }

  // "inline" exercise, solved in the browser
  // todo: support multiple files
  const { filepath, contents } = editorState[0]
  return (
    <>
      <div>{filepath}</div>
      <Editor
        height="30rem"
        width="100%"
        language={extensionToLanguage(filepath)}
        value={contents}
        onChange={(newContents) => {
          if (newContents !== undefined) {
            const newState = _.cloneDeep(editorState)
            const changed = newState.find((ef) => ef.filepath == filepath)
            if (changed) {
              changed.contents = newContents
            }
            setEditorState(newState)
          }
        }}
      />
      <Button
        variant="primary"
        size="medium"
        onClick={() => {
          // cloneDeep prevents setState from changing the initial spec (??)
          setEditorState(_.cloneDeep(initialEditorState))
        }}
      >
        {t("reset")}
      </Button>
    </>
  )
}

const extensionToLanguage = (path: string): string | undefined => {
  /* eslint-disable i18next/no-literal-string */
  const separator = path.lastIndexOf(".")
  if (separator == -1) {
    return undefined
  }
  const extension = path.substring(separator + 1)
  switch (extension) {
    case "js":
      return "javascript"
    case "ts":
      return "typescript"
    case "py":
    case "ipynb":
      return "python"
    case "cs":
      return "csharp"
    default:
      // try to use the extension as language,
      // works in most other cases like java, c...
      // worst case scenario the editor doesn't recognise the extension as a language and doesn't provide syntax highlighting
      return extension
  }
  /* eslint-enable i18next/no-literal-string */
}
export default AnswerBrowserExercise
