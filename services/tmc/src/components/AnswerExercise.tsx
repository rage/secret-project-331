/* eslint-disable i18next/no-literal-string */
import Editor from "@monaco-editor/react"
import _ from "lodash"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "../shared-module/components/Button"
import { ExerciseFile, IframeState, PublicSpec } from "../util/stateInterfaces"

interface Props {
  initialPublicSpec: PublicSpec
  setState: (updater: (state: IframeState | null) => IframeState | null) => void
}

const AnswerExercise: React.FC<React.PropsWithChildren<Props>> = ({
  initialPublicSpec,
  setState,
}) => {
  const { t } = useTranslation()

  const initialEditorState = publicSpecToEditorState(initialPublicSpec)
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

  // student exercise view
  if (initialPublicSpec.type === "browser") {
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
  } else if (initialPublicSpec.type === "editor") {
    // solved in an external editor
    return (
      <>
        <div>{t("solve-in-editor")}</div>
        <a download={"testts"} href={initialPublicSpec.archiveDownloadUrl}>
          {t("download")}
        </a>
      </>
    )
  } else {
    // eslint-disable-next-line i18next/no-literal-string
    throw "Unhandled exercise type"
  }
}

const publicSpecToEditorState = (publicSpec: PublicSpec): Array<ExerciseFile> => {
  if (publicSpec.type === "browser") {
    return publicSpec.files
  }
  return []
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

export default AnswerExercise
