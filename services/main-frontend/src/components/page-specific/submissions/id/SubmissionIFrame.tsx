import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import {
  CourseMaterialExerciseTask,
  StudentExerciseTaskSubmissionResult,
} from "../../../../shared-module/bindings"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import MessageChannelIFrame from "../../../../shared-module/components/MessageChannelIFrame"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import getGuestPseudonymousUserId from "../../../../shared-module/utils/getGuestPseudonymousUserId"
import { exerciseTaskGradingToExerciseTaskGradingResult } from "../../../../shared-module/utils/typeMappter"

const VIEW_SUBMISSION = "view-submission"
const TITLE = "VIEW SUBMISSION"

interface SubmissionIFrameProps {
  coursematerialExerciseTask: CourseMaterialExerciseTask
}

interface SubmissionState {
  submission_result: StudentExerciseTaskSubmissionResult
  user_answer: unknown
  public_spec: unknown
}

const SubmissionIFrame: React.FC<React.PropsWithChildren<SubmissionIFrameProps>> = ({
  coursematerialExerciseTask,
}) => {
  const loginStateContext = useContext(LoginStateContext)
  const { t } = useTranslation()
  if (
    !coursematerialExerciseTask.exercise_iframe_url ||
    coursematerialExerciseTask.exercise_iframe_url.trim() === ""
  ) {
    return (
      <ErrorBanner error={t("error-cannot-render-exercise-task-missing-url")} variant="readOnly" />
    )
  }
  if (!coursematerialExerciseTask.previous_submission_grading) {
    return (
      <ErrorBanner error={t("error-cannot-render-exercise-task-missing-url")} variant="readOnly" />
    )
  }

  if (!coursematerialExerciseTask.previous_submission) {
    return (
      <ErrorBanner
        error={t("error-cannot-render-exercise-task-missing-submission")}
        variant="readOnly"
      />
    )
  }
  const state: SubmissionState = {
    public_spec: coursematerialExerciseTask.public_spec,
    submission_result: {
      submission: coursematerialExerciseTask.previous_submission,
      grading: coursematerialExerciseTask.previous_submission_grading,
      model_solution_spec: coursematerialExerciseTask.model_solution_spec,
      exercise_task_exercise_service_slug: coursematerialExerciseTask.exercise_service_slug,
    },
    user_answer: coursematerialExerciseTask.previous_submission.data_json,
  }

  return (
    <MessageChannelIFrame
      url={`${coursematerialExerciseTask.exercise_iframe_url}`}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        console.info(messageContainer)
      }}
      postThisStateToIFrame={{
        view_type: VIEW_SUBMISSION,
        exercise_task_id: coursematerialExerciseTask.previous_submission.exercise_task_id,
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
      }}
      title={TITLE}
    />
  )
}

export default SubmissionIFrame
