"use client"

import { css } from "@emotion/css"
import { InfoCircle } from "@vectopus/atlas-icons-react"
import React, { useContext, useImperativeHandle, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"

import type { CourseMaterialExerciseTask } from "@/generated/course-material-api/types.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import type {
  IframeConnectionState,
  MessageChannelIFrameHandle,
} from "@/shared-module/exercise-iframe-host/MessageChannelIFrame"
import type { ExerciseIframeState } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import type { Block } from "@/types/courseMaterialBlock"
import type { CapturedExerciseTaskAnswer } from "@/utils/course-material/exerciseTaskAnswer"

import ContentRenderer from "../.."
import ExerciseTaskIframe from "./ExerciseTaskIframe"

/** Imperative API of `ExerciseTask`, passed through its `ref` prop. */
export interface ExerciseTaskHandle {
  /**
   * Scrolls to the task and focuses what keeps it from being submitted: the first invalid field
   * when the iframe supports it, else the iframe, its reload button or the task itself.
   */
  focusFirstInvalid: () => void
}

interface ExerciseTaskProps {
  canPostSubmission: boolean
  exerciseTask: CourseMaterialExerciseTask
  isExam: boolean
  postThisStateToIFrame: ExerciseIframeState | undefined
  setAnswer: (answer: CapturedExerciseTaskAnswer) => void
  exerciseNumber: number
  exerciseName?: string | null | undefined
  isChapterLocked: boolean
  onConnectionStateChange?: (state: IframeConnectionState) => void
  ref?: React.Ref<ExerciseTaskHandle>
}

interface TaskAnswerability {
  exerciseTask: CourseMaterialExerciseTask
  canPostSubmission: boolean
  isChapterLocked: boolean
  signedIn: boolean | null | undefined
}

const isUnanswerableWithoutSubmission = ({
  exerciseTask,
  canPostSubmission,
  isChapterLocked,
  signedIn,
}: TaskAnswerability): boolean =>
  Boolean(
    (!canPostSubmission && !exerciseTask.previous_submission && signedIn) ||
    (isChapterLocked && !exerciseTask.previous_submission),
  )

/** Whether the task shows its exercise iframe; a task that doesn't never reports an answer. */
export const showsExerciseTaskIframe = (answerability: TaskAnswerability): boolean =>
  !isUnanswerableWithoutSubmission(answerability) &&
  Boolean(answerability.exerciseTask.exercise_iframe_url)

const ExerciseTask: React.FC<React.PropsWithChildren<ExerciseTaskProps>> = ({
  canPostSubmission,
  exerciseTask,
  isExam,
  postThisStateToIFrame,
  setAnswer,
  exerciseNumber,
  exerciseName,
  isChapterLocked,
  onConnectionStateChange,
  ref,
}) => {
  const { signedIn } = useContext(LoginStateContext)
  const { t } = useTranslation()
  // oxlint-disable-next-line typescript/no-explicit-any
  const currentExerciseTaskAssignment = exerciseTask.assignment as Block<any>[]
  const url = exerciseTask.exercise_iframe_url

  const areAllParagraphsEmpty = useMemo(
    () =>
      currentExerciseTaskAssignment?.every(
        (paragraph) =>
          paragraph.name === "core/paragraph" && paragraph.attributes?.content.trim() === "",
      ),
    [currentExerciseTaskAssignment],
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<MessageChannelIFrameHandle>(null)
  useImperativeHandle(
    ref,
    () => ({
      focusFirstInvalid: () => {
        // oxlint-disable-next-line i18next/no-literal-string
        containerRef.current?.scrollIntoView({ block: "start" })
        if (iframeRef.current) {
          iframeRef.current.focusFirstInvalid()
        } else {
          containerRef.current?.focus({ preventScroll: true })
        }
      },
    }),
    [],
  )

  if (!postThisStateToIFrame) {
    return null
  }

  const feedbackText =
    postThisStateToIFrame.view_type === "view-submission"
      ? (postThisStateToIFrame.data.grading?.feedback_text ?? null)
      : null
  const cannotAnswerButNoSubmission = isUnanswerableWithoutSubmission({
    exerciseTask,
    canPostSubmission,
    isChapterLocked,
    signedIn,
  })

  const isEmpty = currentExerciseTaskAssignment.length === 0 || areAllParagraphsEmpty

  return (
    <div ref={containerRef} tabIndex={-1}>
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
              display: block;
              margin: 0;
              font-size: 1.25rem !important;
              line-height: 140%;
              font-weight: 600;
            }
          `}
        >
          {exerciseTask.order_number === 0 && (
            <h3 className="instructions-title">{t("title-instructions")}</h3>
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
              postThisStateToIFrame={postThisStateToIFrame}
              url={url}
              setAnswer={setAnswer}
              detectLoadFailure
              ref={iframeRef}
              {...omitUndefined({ onConnectionStateChange })}
              title={
                exerciseName
                  ? // oxlint-disable-next-line i18next/no-literal-string
                    `${exerciseName}${exerciseTask.order_number > 0 ? ` ${exerciseTask.order_number + 1}` : ""}`
                  : t("exercise-task-content", {
                      "exercise-number": exerciseNumber + 1,
                      "task-number": exerciseTask.order_number + 1,
                    })
              }
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
