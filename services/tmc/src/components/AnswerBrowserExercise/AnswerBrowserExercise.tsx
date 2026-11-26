import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { feedbackMessage } from "@/util/gradingFeedback"

import { ActionButtons, EditorSection, OutputPanel, ResetConfirmDialog } from "./components"
import { useEditorState, usePythonWorker, useRunOutput, useTestRun } from "./hooks"
import { Card } from "./styles"
import type { AnswerBrowserExerciseProps } from "./types"
import { isSupportedForBrowserTest } from "./utils"

const AnswerBrowserExercise: React.FC<React.PropsWithChildren<AnswerBrowserExerciseProps>> = ({
  publicSpec,
  initialState,
  startingFiles,
  testRequestResponse: _testRequestResponse,
  onFilesChange,
  grading,
  readOnly = false,
}) => {
  const { t } = useTranslation()
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const passed =
    grading !== null &&
    grading !== undefined &&
    grading.score_given >= grading.score_maximum &&
    grading.score_maximum > 0
  const feedbackText = grading ? feedbackMessage(t, grading) : null

  const { editorFiles, editorKey, setEditorState, resetToStart } = useEditorState(
    initialState,
    startingFiles,
    onFilesChange,
  )
  const pythonWorker = usePythonWorker()
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
  } = useRunOutput(pythonWorker)
  const { testResults, testInProgress, runTests } = useTestRun(publicSpec, pythonWorker)
  // oxlint-disable-next-line i18next/no-literal-string -- internal state discriminant (not user-facing)
  const [lastOutputKind, setLastOutputKind] = useState<"run" | "test">("run")

  const firstFile = editorFiles[0]
  if (firstFile === undefined) {
    return <div>{t("no-exercise-files")}</div>
  }

  const { filepath, contents } = firstFile
  const isPython = filepath.endsWith(".py")
  // Run and Test share one Python worker, so neither may start while the other is busy.
  const runDisabled = pyodideLoading || runExecuting || testInProgress
  const hasBrowserTestScript =
    publicSpec.browser_test !== undefined && publicSpec.browser_test.script.length > 0
  const canRunBrowserTest =
    hasBrowserTestScript &&
    (publicSpec.browser_test?.runtime === undefined ||
      isSupportedForBrowserTest(filepath, publicSpec.browser_test.runtime))
  const testDisabled = runDisabled || testInProgress || !canRunBrowserTest
  const showRun = !runExecuting && !pyodideLoading
  const showOutput =
    isPython &&
    (pyodideLoading ||
      runExecuting ||
      !!runOutput ||
      runError !== null ||
      waitingForInput ||
      testInProgress ||
      testResults !== null)
  const outputMode: "run" | "test-running" | "test-results" = testInProgress
    ? // oxlint-disable-next-line i18next/no-literal-string -- internal mode value (not user-facing text)
      "test-running"
    : lastOutputKind === "test" && testResults !== null
      ? // oxlint-disable-next-line i18next/no-literal-string -- internal mode value (not user-facing text)
        "test-results"
      : // oxlint-disable-next-line i18next/no-literal-string -- internal mode value (not user-facing text)
        "run"

  return (
    <Card>
      {/* A pending grading has no score yet. */}
      {grading !== null && grading !== undefined && grading.grading_progress !== "Pending" && (
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
          {feedbackText !== null && (
            <div
              className={css`
                margin-top: 0.5rem;
              `}
            >
              {feedbackText}
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
            // oxlint-disable-next-line i18next/no-literal-string -- internal state discriminant
            setLastOutputKind("run")
            void runPython(code, filepath)
          }}
          onStop={stopRun}
          onTest={async () => {
            // oxlint-disable-next-line i18next/no-literal-string -- internal state discriminant
            setLastOutputKind("test")
            await runTests(filepath, contents)
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
            resetToStart()
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
