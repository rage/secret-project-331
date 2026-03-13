"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import AnswerExercise from "./AnswerExercise"
import ExerciseEditor from "./ExerciseEditor"
import ViewSubmission, { normalizeSubmission } from "./ViewSubmission"

import { UploadResultMessage } from "@/shared-module/common/exercise-service-protocol-types"
import { EXERCISE_SERVICE_CONTENT_ID } from "@/shared-module/common/utils/constants"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withNoSsr from "@/shared-module/common/utils/withNoSsr"
import { RunResult } from "@/tmc/cli"
import { ExerciseIframeState } from "@/util/stateInterfaces"

interface Props {
  state: ExerciseIframeState | null
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
  testRequestResponse: RunResult | null
  sendFileUploadMessage: (filename: string, file: File) => void
  requestRepositoryExercises: () => void
  fileUploadResponse: UploadResultMessage | null
}

export const StateRenderer: React.FC<React.PropsWithChildren<Props>> = ({
  state,
  setState,
  testRequestResponse,
  requestRepositoryExercises,
  sendFileUploadMessage,
  fileUploadResponse,
}) => {
  const { t } = useTranslation()

  if (!state) {
    return <>{t("waiting-for-content")}</>
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
        <AnswerExercise
          publicSpec={state.public_spec}
          userAnswer={state.user_answer}
          setState={setState}
          testRequestResponse={testRequestResponse}
          sendFileUploadMessage={sendFileUploadMessage}
          fileUploadResponse={fileUploadResponse}
        />
      </div>
    )
  } else if (state.view_type === "view-submission") {
    const submission = normalizeSubmission(state.submission)
    if (submission.type === "browser" && state.public_spec) {
      const setStateForViewSubmission: typeof setState = (updater) => {
        setState((prev) => {
          if (prev?.view_type !== "view-submission") {
            return updater(prev)
          }
          const fakePrev: ExerciseIframeState = {
            // eslint-disable-next-line i18next/no-literal-string -- internal state discriminant (not user-facing)
            view_type: "answer-exercise",
            public_spec: prev.public_spec,
            user_answer: prev.submission,
            previous_submission: null,
          }
          const result = updater(fakePrev)
          if (result?.view_type === "answer-exercise") {
            return { ...prev, submission: result.user_answer }
          }
          return result ?? prev
        })
      }
      return (
        <div id={EXERCISE_SERVICE_CONTENT_ID}>
          <AnswerExercise
            publicSpec={state.public_spec}
            userAnswer={submission}
            setState={setStateForViewSubmission}
            testRequestResponse={null}
            sendFileUploadMessage={sendFileUploadMessage}
            fileUploadResponse={fileUploadResponse}
            grading={state.grading}
          />
        </div>
      )
    }
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID}>
        <ViewSubmission state={state} />
      </div>
    )
  }

  return <>{t("waiting-for-content")}</>
}

export default withErrorBoundary(withNoSsr(StateRenderer))
