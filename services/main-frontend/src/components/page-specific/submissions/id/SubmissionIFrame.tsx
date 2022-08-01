import { Alert } from "@mui/lab"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  ExerciseTaskGrading,
  ExerciseTaskSubmission,
  StudentExerciseTaskSubmissionResult,
} from "../../../../shared-module/bindings"
import MessageChannelIFrame from "../../../../shared-module/components/MessageChannelIFrame"
import { exerciseTaskGradingToExerciseTaskGradingResult } from "../../../../shared-module/utils/typeMappter"

const VIEW_SUBMISSION = "view-submission"
const TITLE = "VIEW SUBMISSION"

interface SubmissionIFrameProps {
  url: string
  public_spec: unknown
  submission: ExerciseTaskSubmission | null
  model_solution_spec: unknown
  grading: ExerciseTaskGrading | null
}

interface SubmissionState {
  submission_result: StudentExerciseTaskSubmissionResult
  user_answer: unknown
  public_spec: unknown
}

const SubmissionIFrame: React.FC<React.PropsWithChildren<SubmissionIFrameProps>> = ({
  url,
  public_spec,
  submission,
  model_solution_spec,
  grading,
}) => {
  const { t } = useTranslation()
  if (!url || url.trim() === "") {
    return <Alert severity="error">{t("error-cannot-render-exercise-task-missing-url")}</Alert>
  }
  if (!grading) {
    return <Alert severity="error">{t("error-cannot-render-exercise-task-missing-url")}</Alert>
  }

  if (!submission) {
    return (
      <Alert severity="error">{t("error-cannot-render-exercise-task-missing-submission")}</Alert>
    )
  }
  const state: SubmissionState = {
    public_spec,
    submission_result: {
      submission,
      grading,
      model_solution_spec,
    },
    user_answer: submission.data_json,
  }

  return (
    <MessageChannelIFrame
      url={url}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        console.log(messageContainer)
      }}
      postThisStateToIFrame={{
        view_type: VIEW_SUBMISSION,
        exercise_task_id: submission.exercise_task_id,
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
