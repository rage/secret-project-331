import { css } from "@emotion/css"
import { InfoCircle } from "@vectopus/atlas-icons-react"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer from "../.."
import { Block } from "../../../../services/backend"
import { CourseMaterialExerciseTask } from "../../../../shared-module/bindings"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import { IframeState } from "../../../../shared-module/exercise-service-protocol-types"
import { baseTheme, headingFont } from "../../../../shared-module/styles"

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentExerciseTaskAssignment = exerciseTask.assignment as Block<any>[]
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

  const areAllParagraphsEmpty = () =>
    currentExerciseTaskAssignment?.every(
      (paragraph) =>
        paragraph.name === "core/paragraph" && paragraph.attributes?.content.trim() == "",
    )

  const isEmpty = currentExerciseTaskAssignment.length > 0 && areAllParagraphsEmpty()

  return (
    <div>
      {currentExerciseTaskAssignment && !isEmpty && (
        <div
          className={css`
            font-family: ${headingFont};
            color: #4c5868;
            p {
              margin-top: 0 !important;
              opacity: 0.9;
              font-size: 1.125rem !important;
              font-weight: 500;
            }

            span {
              font-size: 1.25rem !important;
              line-height: 140%;
              font-weight: 600;
            }
          `}
        >
          <span>{t("title-instructions")}</span>
          <ContentRenderer
            data={currentExerciseTaskAssignment}
            editing={false}
            selectedBlockId={null}
            setEdits={(map) => map}
            isExam={isExam}
          />
        </div>
      )}
      {cannotAnswerButNoSubmission && <div>{t("no-submission-received-for-this-exercise")}</div>}
      {!cannotAnswerButNoSubmission &&
        (url ? (
          <ExerciseTaskIframe
            exerciseServiceSlug={exerciseTask.exercise_service_slug}
            postThisStateToIFrame={postThisStateToIFrame}
            url={url}
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
          <InfoCircle size={20} />
          {feedbackText}
        </div>
      )}
    </div>
  )
}

export default ExerciseTask
