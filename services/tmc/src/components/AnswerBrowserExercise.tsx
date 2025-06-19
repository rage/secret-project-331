import { Editor } from "@monaco-editor/react"
import _ from "lodash"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { ExerciseFile, ExerciseIframeState, PublicSpec } from "../util/stateInterfaces"

import Button from "@/shared-module/common/components/Button"
import { RunResult } from "@/tmc/cli"

interface Props {
  initialPublicSpec: PublicSpec & { type: "browser" }
  sendTestRequestMessage: (archiveDownloadUrl: string, editorFiles: Array<ExerciseFile>) => void
  testRequestResponse: RunResult | null
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
}

const AnswerBrowserExercise: React.FC<React.PropsWithChildren<Props>> = ({
  initialPublicSpec,
  sendTestRequestMessage,
  testRequestResponse,
  setState,
}) => {
  const { t } = useTranslation()

  console.log("spec", initialPublicSpec)
  const initialEditorFiles = initialPublicSpec.files
  const [editorFiles, setEditorFiles] = useState(initialEditorFiles)
  const setEditorState = (files: Array<ExerciseFile>) => {
    setEditorFiles(files)
    setState((old) => {
      if (old?.view_type == "answer-exercise") {
        return { ...old, user_answer: { type: "browser", files } }
      } else {
        return null
      }
    })
  }

  // "inline" exercise, solved in the browser
  // todo: support multiple files
  const { filepath, contents } = editorFiles[0]
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
            const newState = _.cloneDeep(editorFiles)
            const changed = newState.find((ef) => ef.filepath == filepath)
            if (changed) {
              changed.contents = newContents
            }
            setEditorState(newState)
          }
        }}
      />
      {testRequestResponse && <div>{testRequestResponse.status}</div>}
      <Button
        variant="primary"
        size="medium"
        onClick={async () => {
          sendTestRequestMessage(initialPublicSpec.archive_download_url, editorFiles)
        }}
      >
        {t("test")}
      </Button>
      <Button variant="primary" size="medium" onClick={() => {}}>
        {t("submit")}
      </Button>
      <Button
        variant="primary"
        size="medium"
        onClick={() => {
          const res = confirm(t("are-you-sure"))
          if (res) {
            // cloneDeep prevents setState from changing the initial spec (??)
            setEditorState(_.cloneDeep(initialEditorFiles))
          }
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
