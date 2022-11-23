import { css } from "@emotion/css"
import { faCircleInfo as infoIcon } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer from "../.."
import { Block } from "../../../../services/backend"
import { CourseMaterialExerciseTask } from "../../../../shared-module/bindings"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import { IframeState } from "../../../../shared-module/exercise-service-protocol-types"
import { baseTheme } from "../../../../shared-module/styles"
import { narrowContainerWidthPx } from "../../../../shared-module/styles/constants"

import ExerciseTaskIframe from "./ExerciseTaskIframe"

interface ExerciseTaskProps {
  canPostSubmission: boolean
  exerciseTask: CourseMaterialExerciseTask
  isExam: boolean
  postThisStateToIFrame: IframeState | undefined
  setAnswer: (answer: { valid: boolean; data: unknown }) => void
  exerciseNumber: number
}

const ExerciseTask: React.FC<React.PropsWithChildren<ExerciseTaskProps>> = ({
  canPostSubmission,
  exerciseTask,
  isExam,
  postThisStateToIFrame,
  setAnswer,
  exerciseNumber,
}) => {
  const { signedIn } = useContext(LoginStateContext)
  const { t } = useTranslation()
  const currentExerciseTaskAssignment = exerciseTask.assignment as Block<unknown>[]
  const url = exerciseTask.exercise_iframe_url

  if (!postThisStateToIFrame) {
    return null
  }

  const feedbackText =
    postThisStateToIFrame.view_type === "view-submission"
      ? postThisStateToIFrame.data.grading?.feedback_text ?? null
      : null
  const cannotAnswerButNoSubmission =
    !canPostSubmission && !exerciseTask.previous_submission && signedIn

  return (
    <div>
      {currentExerciseTaskAssignment && (
        <ContentRenderer
          data={currentExerciseTaskAssignment}
          editing={false}
          selectedBlockId={null}
          setEdits={(map) => map}
          isExam={isExam}
        />
      )}
      {cannotAnswerButNoSubmission && <div>{t("no-submission-received-for-this-exercise")}</div>}
      {!cannotAnswerButNoSubmission &&
        (url ? (
          <ExerciseTaskIframe
            exerciseServiceSlug={exerciseTask.exercise_service_slug}
            postThisStateToIFrame={postThisStateToIFrame}
            url={`${url}?width=${narrowContainerWidthPx}`}
            setAnswer={setAnswer}
            title={t("exercise-task-content", {
              "exercise-number": exerciseNumber + 1,
              "task-number": exerciseTask.order_number + 1,
            })}
          />
        ) : (
          t("dont-know-how-to-render-this-assignment")
        ))}
      {feedbackText && (
        <div
          className={css`
            margin: 1rem 0;
            margin-top: -1rem;
            background: white;
            font-weight: 400;
            color: ${baseTheme.colors.gray[500]};
            padding: 0.75rem 1rem;

            svg {
              margin-right: 0.5rem;
              color: ${baseTheme.colors.blue[500]};
            }
          `}
        >
          <FontAwesomeIcon icon={infoIcon} />
          {feedbackText}
        </div>
      )}
    </div>
  )
}

export default ExerciseTask
