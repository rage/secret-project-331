"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { ActionButtons, EditorSection, OutputPanel, ResetConfirmDialog } from "./components"
import { useEditorState, useRunOutput, useTestRun } from "./hooks"
import { Card } from "./styles"
import { AnswerBrowserExerciseProps } from "./types"

const AnswerBrowserExercise: React.FC<React.PropsWithChildren<AnswerBrowserExerciseProps>> = ({
  publicSpec,
  initialState,
  testRequestResponse: _testRequestResponse,
  setState,
}) => {
  const { t } = useTranslation()
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  const { editorFiles, editorKey, setEditorState, resetToInitial } = useEditorState(
    initialState,
    publicSpec.stub_download_url,
    setState,
  )
  const { runOutput, runError, pyodideLoading, runExecuting, runPython } = useRunOutput()
  const { testResults, testInProgress, runTests } = useTestRun(publicSpec.stub_download_url)

  if (editorFiles.length === 0) {
    return <div>{t("no-exercise-files")}</div>
  }

  const { filepath, contents } = editorFiles[0]
  const isPython = filepath.endsWith(".py")
  const runOrTestDisabled = pyodideLoading || runExecuting
  const showRun = !runExecuting && !pyodideLoading
  const showOutput =
    isPython &&
    (pyodideLoading ||
      runExecuting ||
      !!runOutput ||
      runError != null ||
      testInProgress ||
      testResults != null)
  const outputMode: "run" | "test-running" | "test-results" = testInProgress
    ? // eslint-disable-next-line i18next/no-literal-string -- internal mode value (not user-facing text)
      "test-running"
    : testResults != null
      ? // eslint-disable-next-line i18next/no-literal-string -- internal mode value (not user-facing text)
        "test-results"
      : // eslint-disable-next-line i18next/no-literal-string -- internal mode value (not user-facing text)
        "run"

  return (
    <Card>
      <EditorSection
        filepath={filepath}
        contents={contents}
        editorKey={editorKey}
        editorFiles={editorFiles}
        setEditorState={setEditorState}
      />
      <ActionButtons
        isPython={isPython}
        runOrTestDisabled={runOrTestDisabled}
        testInProgress={testInProgress}
        showRun={showRun}
        contents={contents}
        onRun={runPython}
        onTest={() => runTests(filepath, contents)}
        onResetClick={() => setResetConfirmOpen(true)}
      />
      <ResetConfirmDialog
        open={resetConfirmOpen}
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={() => {
          resetToInitial()
          setResetConfirmOpen(false)
        }}
      />
      {showOutput && (
        <OutputPanel
          mode={outputMode}
          pyodideLoading={pyodideLoading}
          runExecuting={runExecuting}
          runOutput={runOutput}
          runError={runError}
          testResults={testResults}
        />
      )}
    </Card>
  )
}

export default AnswerBrowserExercise
