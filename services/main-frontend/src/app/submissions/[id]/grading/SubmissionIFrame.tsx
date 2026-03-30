"use client"

import React, { useCallback, useContext, useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  CourseMaterialExerciseTask,
  StudentExerciseTaskSubmissionResult,
} from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import MessageChannelIFrame from "@/shared-module/common/components/MessageChannelIFrame"
import ThrottledChildRenderer, {
  type ChildFactoryWithCallback,
} from "@/shared-module/common/components/ThrottledChildRenderer"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import getGuestPseudonymousUserId from "@/shared-module/common/utils/getGuestPseudonymousUserId"
import { exerciseTaskGradingToExerciseTaskGradingResult } from "@/shared-module/common/utils/typeMappter"
import {
  EXERCISE_IFRAME_QUEUE_CONFIG,
  EXERCISE_IFRAME_QUEUE_ID,
} from "@/stores/course-material/throttledRendererStore"

const VIEW_SUBMISSION = "view-submission" as const
const TITLE = "VIEW SUBMISSION"

interface SubmissionIFrameProps {
  coursematerialExerciseTask: CourseMaterialExerciseTask
  throttled?: boolean
}

interface SubmissionState {
  submission_result: StudentExerciseTaskSubmissionResult
  user_answer: unknown
  public_spec: unknown
}

const SubmissionIFrame: React.FC<React.PropsWithChildren<SubmissionIFrameProps>> = ({
  coursematerialExerciseTask,
  throttled = false,
}) => {
  const loginStateContext = useContext(LoginStateContext)
  const { t } = useTranslation()
  const handleMessageFromIframe = useCallback(
    (messageContainer: unknown, _responsePort: MessagePort) => {
      console.info(messageContainer)
    },
    [],
  )

  const missingUrl =
    !coursematerialExerciseTask.exercise_iframe_url ||
    coursematerialExerciseTask.exercise_iframe_url.trim() === ""
  const missingGrading = !coursematerialExerciseTask.previous_submission_grading
  const previousSubmission = coursematerialExerciseTask.previous_submission
  const missingSubmission = previousSubmission == null

  const readyForIframe = !missingUrl && !missingGrading && !missingSubmission

  const state = useMemo((): SubmissionState | null => {
    if (!readyForIframe || !previousSubmission) {
      return null
    }
    return {
      public_spec: coursematerialExerciseTask.public_spec,
      submission_result: {
        submission: previousSubmission,
        grading: coursematerialExerciseTask.previous_submission_grading,
        model_solution_spec: coursematerialExerciseTask.model_solution_spec,
        exercise_task_exercise_service_slug: coursematerialExerciseTask.exercise_service_slug,
      },
      user_answer: previousSubmission.data_json,
    }
  }, [readyForIframe, previousSubmission, coursematerialExerciseTask])

  const postThisStateToIFrame = useMemo(() => {
    if (!state || !previousSubmission) {
      return null
    }
    return {
      view_type: VIEW_SUBMISSION,
      exercise_task_id: previousSubmission.exercise_task_id,
      user_information: {
        pseudonymous_id:
          coursematerialExerciseTask.pseudonumous_user_id ?? getGuestPseudonymousUserId(),
        signed_in: Boolean(loginStateContext.signedIn),
      },
      data: {
        public_spec: state.public_spec,
        user_answer: state.user_answer,
        model_solution_spec: state.submission_result.model_solution_spec,
        grading: exerciseTaskGradingToExerciseTaskGradingResult(state.submission_result.grading),
      },
    }
  }, [state, previousSubmission, coursematerialExerciseTask, loginStateContext.signedIn])

  const url = `${coursematerialExerciseTask.exercise_iframe_url ?? ""}`

  const throttledChildFactory = useCallback<ChildFactoryWithCallback>(
    (onReady) => (
      <MessageChannelIFrame
        url={url}
        onMessageFromIframe={handleMessageFromIframe}
        postThisStateToIFrame={postThisStateToIFrame}
        title={TITLE}
        onReady={onReady}
      />
    ),
    [url, handleMessageFromIframe, postThisStateToIFrame],
  )

  if (missingUrl) {
    return (
      <ErrorBanner error={t("error-cannot-render-exercise-task-missing-url")} variant="readOnly" />
    )
  }
  if (missingGrading) {
    return (
      <ErrorBanner error={t("error-cannot-render-exercise-task-missing-url")} variant="readOnly" />
    )
  }
  if (missingSubmission) {
    return (
      <ErrorBanner
        error={t("error-cannot-render-exercise-task-missing-submission")}
        variant="readOnly"
      />
    )
  }

  if (!state || !postThisStateToIFrame) {
    return null
  }

  if (throttled) {
    return (
      <ThrottledChildRenderer
        qid={EXERCISE_IFRAME_QUEUE_ID}
        id={`submission-iframe-${coursematerialExerciseTask.id}`}
        queueConfig={EXERCISE_IFRAME_QUEUE_CONFIG}
      >
        {throttledChildFactory}
      </ThrottledChildRenderer>
    )
  }

  return (
    <MessageChannelIFrame
      url={url}
      onMessageFromIframe={handleMessageFromIframe}
      postThisStateToIFrame={postThisStateToIFrame}
      title={TITLE}
    />
  )
}

export default SubmissionIFrame
