"use client"

import { css } from "@emotion/css"
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
  grading,
  readOnly = false,
}) => {
  const { t } = useTranslation()
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const passed =
    grading != null && grading.score_given >= grading.score_maximum && grading.score_maximum > 0

  const { editorFiles, editorKey, setEditorState, resetToInitial } = useEditorState(
    initialState,
    publicSpec.stub_download_url,
    setState,
  )
  const {
    runOutput,
    runError,
    pyodideLoading,
    runExecuting,
    runPython,
    stopRun,
    waitingForInput,
    stdinPrompt,
    segments,
    submitStdinLine,
  } = useRunOutput()
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
      waitingForInput ||
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
      {grading != null && (
        <div
          className={css`
            margin-bottom: 1rem;
            padding: 0.75rem 1rem;
            border-radius: 0.5rem;
            background-color: ${passed ? "#dcfce7" : "#fef3c7"};
            color: ${passed ? "#166534" : "#92400e"};
            font-size: 0.9375rem;
          `}
        >
          {passed
            ? t("submit-result-passed", {
                score: grading.score_given,
                max: grading.score_maximum,
              })
            : t("submit-result-failed", {
                score: grading.score_given,
                max: grading.score_maximum,
              })}
          {grading.feedback_text != null && grading.feedback_text.trim() !== "" && (
            <div
              className={css`
                margin-top: 0.5rem;
              `}
            >
              {grading.feedback_text}
            </div>
          )}
        </div>
      )}
      <EditorSection
        filepath={filepath}
        contents={contents}
        editorKey={editorKey}
        editorFiles={editorFiles}
        setEditorState={setEditorState}
        readOnly={readOnly}
      />
      {!readOnly && (
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
          onStop={stopRun}
          onTest={() => {
            // eslint-disable-next-line i18next/no-literal-string -- internal state discriminant
            setLastOutputKind("test")
            runTests(filepath, contents)
          }}
          onResetClick={() => setResetConfirmOpen(true)}
          testUnavailableReason={publicSpec.browser_test?.error}
        />
      )}
      {!readOnly && (
        <ResetConfirmDialog
          open={resetConfirmOpen}
          onCancel={() => setResetConfirmOpen(false)}
          onConfirm={() => {
            resetToInitial()
            setResetConfirmOpen(false)
          }}
        />
      )}
      {showOutput && (
        <OutputPanel
          mode={outputMode}
          pyodideLoading={pyodideLoading}
          runExecuting={runExecuting}
          runOutput={runOutput}
          runError={runError}
          waitingForInput={waitingForInput}
          stdinPrompt={stdinPrompt}
          segments={segments}
          submitStdinLine={submitStdinLine}
          testResults={testResults}
        />
      )}
    </Card>
  )
}

export default AnswerBrowserExercise
