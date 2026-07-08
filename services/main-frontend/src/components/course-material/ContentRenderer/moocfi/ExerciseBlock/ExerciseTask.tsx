"use client"

import { css } from "@emotion/css"
import { InfoCircle } from "@vectopus/atlas-icons-react"
import React, { useContext, useMemo } from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer from "../.."

import ExerciseTaskIframe from "./ExerciseTaskIframe"

import type { CourseMaterialExerciseTask } from "@/generated/course-material-api/types.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { ExerciseIframeState } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { Block } from "@/types/courseMaterialBlock"

interface ExerciseTaskProps {
  canPostSubmission: boolean
  exerciseTask: CourseMaterialExerciseTask
  isExam: boolean
  postThisStateToIFrame: ExerciseIframeState | undefined
  setAnswer: (answer: { valid: boolean; data: unknown }) => void
  exerciseNumber: number
  isChapterLocked: boolean
}

const ExerciseTask: React.FC<React.PropsWithChildren<ExerciseTaskProps>> = ({
  canPostSubmission,
  exerciseTask,
  isExam,
  postThisStateToIFrame,
  setAnswer,
  exerciseNumber,
  isChapterLocked,
}) => {
  const { signedIn } = useContext(LoginStateContext)
  const { t } = useTranslation()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentExerciseTaskAssignment = exerciseTask.assignment as Block<any>[]
  const url = exerciseTask.exercise_iframe_url

  const areAllParagraphsEmpty = useMemo(
    () =>
      currentExerciseTaskAssignment?.every(
        (paragraph) =>
          paragraph.name === "core/paragraph" && paragraph.attributes?.content.trim() == "",
      ),
    [currentExerciseTaskAssignment],
  )

  if (!postThisStateToIFrame) {
    return null
  }

  const feedbackText =
    postThisStateToIFrame.view_type === "view-submission"
      ? (postThisStateToIFrame.data.grading?.feedback_text ?? null)
      : null
  const cannotAnswerButNoSubmission =
    (!canPostSubmission && !exerciseTask.previous_submission && signedIn) ||
    (isChapterLocked && !exerciseTask.previous_submission)

  const isEmpty = currentExerciseTaskAssignment.length === 0 || areAllParagraphsEmpty

  return (
    <div>
      {currentExerciseTaskAssignment && !isEmpty && (
        <div
          className={css`
            font-family: ${headingFont};
            color: #4c5868;
            p,
            li {
              opacity: 0.9;
              font-size: 1.125rem !important;
              font-weight: 500;
            }

            .instructions-title {
              font-size: 1.25rem !important;
              line-height: 140%;
              font-weight: 600;
            }
          `}
        >
          {exerciseTask.order_number === 0 && (
            <span className="instructions-title">{t("title-instructions")}</span>
          )}
          <ContentRenderer
            data={currentExerciseTaskAssignment}
            isExam={isExam}
            dontAllowBlockToBeWiderThanContainerWidth={true}
          />
        </div>
      )}
      <div
        className={css`
          margin-top: 2rem;
        `}
      >
        {cannotAnswerButNoSubmission && <div>{t("no-submission-received-for-this-exercise")}</div>}
        {!cannotAnswerButNoSubmission &&
          (url ? (
            <ExerciseTaskIframe
              exerciseTaskId={exerciseTask.id}
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
              align-items: center;
              display: flex;
              font-size: 1rem;

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
    </div>
  )
}

export default ExerciseTask
