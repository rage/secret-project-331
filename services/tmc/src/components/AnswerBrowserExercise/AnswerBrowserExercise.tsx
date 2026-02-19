"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { ActionButtons, EditorSection, OutputPanel, ResetConfirmDialog } from "./components"
import { useEditorState, useRunOutput, useTestRun } from "./hooks"
import { Card } from "./styles"
import { AnswerBrowserExerciseProps } from "./types"
import { isSupportedForBrowserTest } from "./utils"

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
  const { testResults, testInProgress, runTests } = useTestRun(publicSpec)
  // eslint-disable-next-line i18next/no-literal-string -- internal state discriminant (not user-facing)
  const [lastOutputKind, setLastOutputKind] = useState<"run" | "test">("run")

  if (editorFiles.length === 0) {
    return <div>{t("no-exercise-files")}</div>
  }

  const { filepath, contents } = editorFiles[0]
  const isPython = filepath.endsWith(".py")
  const runDisabled = pyodideLoading || runExecuting
  const hasBrowserTestScript =
    publicSpec.browser_test != null && publicSpec.browser_test.script.length > 0
  const canRunBrowserTest =
    hasBrowserTestScript &&
    (publicSpec.browser_test?.runtime == null ||
      isSupportedForBrowserTest(filepath, publicSpec.browser_test.runtime))
  const testDisabled = runDisabled || testInProgress || !canRunBrowserTest
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
    : lastOutputKind === "test" && testResults != null
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
        runDisabled={runDisabled}
        testDisabled={testDisabled}
        testInProgress={testInProgress}
        showRun={showRun}
        contents={contents}
        onRun={(code) => {
          // eslint-disable-next-line i18next/no-literal-string -- internal state discriminant
          setLastOutputKind("run")
          runPython(code)
        }}
        onTest={() => {
          // eslint-disable-next-line i18next/no-literal-string -- internal state discriminant
          setLastOutputKind("test")
          runTests(filepath, contents)
        }}
        onResetClick={() => setResetConfirmOpen(true)}
        testUnavailableReason={publicSpec.browser_test?.error}
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
