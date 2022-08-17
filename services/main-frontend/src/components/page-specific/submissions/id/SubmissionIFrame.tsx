import { Alert } from "@mui/lab"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import {
  CourseMaterialExerciseTask,
  StudentExerciseTaskSubmissionResult,
} from "../../../../shared-module/bindings"
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
    return <Alert severity="error">{t("error-cannot-render-exercise-task-missing-url")}</Alert>
  }
  if (!coursematerialExerciseTask.previous_submission_grading) {
    return <Alert severity="error">{t("error-cannot-render-exercise-task-missing-url")}</Alert>
  }

  if (!coursematerialExerciseTask.previous_submission) {
    return (
      <Alert severity="error">{t("error-cannot-render-exercise-task-missing-submission")}</Alert>
    )
  }
  const state: SubmissionState = {
    public_spec: coursematerialExerciseTask.public_spec,
    submission_result: {
      submission: coursematerialExerciseTask.previous_submission,
      grading: coursematerialExerciseTask.previous_submission_grading,
      model_solution_spec: coursematerialExerciseTask.model_solution_spec,
    },
    user_answer: coursematerialExerciseTask.previous_submission.data_json,
  }

  return (
    <MessageChannelIFrame
      url={`${coursematerialExerciseTask.exercise_iframe_url}?width=700`} // todo: move constants to shared
      onMessageFromIframe={(messageContainer, _responsePort) => {
        console.log(messageContainer)
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
