import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { AnswerArchiveError } from "@/hooks/useIframeProtocol"
import Button from "@/shared-module/common/components/Button"
import { EXERCISE_SERVICE_CONTENT_ID } from "@/shared-module/exercise-protocol/core/constants"
import type { UploadResultMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import withErrorBoundary from "@/shared-module/exercise-react/react/components/withErrorBoundary"
import withNoSsr from "@/shared-module/exercise-react/react/components/withNoSsr"
import type { RunResult } from "@/tmc/cli"
import type { ExerciseFile, ExerciseIframeState } from "@/util/stateInterfaces"

import AnswerExercise from "./AnswerExercise"
import ExerciseEditor from "./ExerciseEditor"
import ViewSubmission from "./ViewSubmission"

interface Props {
  state: ExerciseIframeState | null
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
  setAnswerFiles: (files: ExerciseFile[]) => void
  testRequestResponse: RunResult | null
  sendFileUploadMessage: (file: File) => void
  requestRepositoryExercises: () => void
  fileUploadResponse: UploadResultMessage | null
  archiveError: AnswerArchiveError | null
  retryArchiveOperation: () => void
}

const ArchiveErrorNotice: React.FC<{ error: AnswerArchiveError; onRetry: () => void }> = ({
  error,
  onRetry,
}) => {
  const { t } = useTranslation()
  return (
    <div
      role="alert"
      className={css`
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        background-color: #fef3c7;
        color: #92400e;
        font-size: 0.9375rem;
      `}
    >
      <span>{error === "load" ? t("answer-load-failed") : t("answer-save-failed")}</span>
      <Button variant="secondary" size="small" onClick={onRetry}>
        {t("try-again")}
      </Button>
    </div>
  )
}

export const StateRenderer: React.FC<React.PropsWithChildren<Props>> = ({
  state,
  setState,
  setAnswerFiles,
  testRequestResponse,
  requestRepositoryExercises,
  sendFileUploadMessage,
  fileUploadResponse,
  archiveError,
  retryArchiveOperation,
}) => {
  const { t } = useTranslation()

  if (!state) {
    return archiveError === null ? (
      <>{t("waiting-for-content")}</>
    ) : (
      <ArchiveErrorNotice error={archiveError} onRetry={retryArchiveOperation} />
    )
  }

  if (state.view_type === "exercise-editor") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID}>
        <ExerciseEditor
          state={state}
          setState={setState}
          requestRepositoryExercises={requestRepositoryExercises}
        />
      </div>
    )
  } else if (state.view_type === "answer-exercise") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID}>
        {/* Only the browser editor packs and uploads on its own; an editor-mode upload is manual
            and AnswerEditorExercise reports its own result. */}
        {archiveError !== null && state.public_spec.type === "browser" && (
          <ArchiveErrorNotice error={archiveError} onRetry={retryArchiveOperation} />
        )}
        <AnswerExercise
          publicSpec={state.public_spec}
          files={state.editor_files}
          onFilesChange={setAnswerFiles}
          testRequestResponse={testRequestResponse}
          sendFileUploadMessage={sendFileUploadMessage}
          fileUploadResponse={fileUploadResponse}
        />
      </div>
    )
  } else if (state.view_type === "view-submission") {
    if (state.public_spec.type === "browser" && state.submitted_files.length > 0) {
      return (
        <div id={EXERCISE_SERVICE_CONTENT_ID}>
          <AnswerExercise
            publicSpec={state.public_spec}
            files={state.submitted_files}
            testRequestResponse={null}
            sendFileUploadMessage={sendFileUploadMessage}
            fileUploadResponse={fileUploadResponse}
            grading={state.grading}
          />
        </div>
      )
    }
    // An editor-mode answer, or one whose archive could not be read.
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID}>
        <ViewSubmission state={state} />
      </div>
    )
  }

  return <>{t("waiting-for-content")}</>
}

export default withErrorBoundary(withNoSsr(StateRenderer))
