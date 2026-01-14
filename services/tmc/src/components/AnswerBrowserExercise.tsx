"use client"

import { Editor } from "@monaco-editor/react"
import _ from "lodash"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import { RunResult } from "@/tmc/cli"
import { runBrowserTests, waitForTestResults } from "@/util/requests"
import { ExerciseFile, ExerciseIframeState, PublicSpec } from "@/util/stateInterfaces"

interface Props {
  publicSpec: PublicSpec
  initialState: Array<ExerciseFile>
  testRequestResponse: RunResult | null
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
}

const AnswerBrowserExercise: React.FC<React.PropsWithChildren<Props>> = ({
  publicSpec,
  initialState,
  testRequestResponse,
  setState,
}) => {
  const { t } = useTranslation()

  const [editorFiles, setEditorFiles] = useState(initialState)
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
  const [testResults, setTestResults] = useState<RunResult | null>(null)

  // "inline" exercise, solved in the browser
  if (publicSpec.student_file_paths.length == 0) {
    return <div>{t("no-student-files")}</div>
  }

  // todo: support multiple files
  const exerciseFile = editorFiles.find((ef) => publicSpec.student_file_paths.includes(ef.filepath))
  if (exerciseFile === undefined) {
    return <div>{t("no-exercise-files")}</div>
  }
  const { filepath, contents } = exerciseFile
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
          const testRunId = await runBrowserTests(publicSpec.stub_download_url, filepath, contents)
          waitForTestResults(testRunId).then((result) => {
            setTestResults(result)
          })
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
          // todo: custom dialog
          const res = confirm(t("are-you-sure"))
          if (res) {
            // cloneDeep prevents setState from changing the initial spec (??)
            setEditorState(_.cloneDeep(initialState))
          }
        }}
      >
        {t("reset")}
      </Button>
      <div>{testResults && testResults.status}</div>
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
