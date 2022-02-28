import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer from "../.."
import { Block } from "../../../../services/backend"
import { CourseMaterialExerciseTask } from "../../../../shared-module/bindings"
import { IframeState } from "../../../../shared-module/iframe-protocol-types"
import { narrowContainerWidthPx } from "../../../../shared-module/styles/constants"

import ExerciseTaskIframe from "./ExerciseTaskIframe"

interface ExerciseTaskProps {
  cannotAnswerButNoSubmission: boolean
  exerciseTask: CourseMaterialExerciseTask
  isExam: boolean
  postThisStateToIFrame: IframeState | undefined
  setAnswer: (answer: { valid: boolean; data: unknown }) => void
}

const ExerciseTask: React.FC<ExerciseTaskProps> = ({
  cannotAnswerButNoSubmission,
  exerciseTask,
  isExam,
  postThisStateToIFrame,
  setAnswer,
}) => {
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
            postThisStateToIFrame={postThisStateToIFrame}
            url={`${url}?width=${narrowContainerWidthPx}`}
            setAnswer={setAnswer}
          />
        ) : (
          t("dont-know-how-to-render-this-assignment")
        ))}
      <div
        className={css`
          margin: 1rem 0;
        `}
      >
        {feedbackText}
      </div>
    </div>
  )
}

export default ExerciseTask
