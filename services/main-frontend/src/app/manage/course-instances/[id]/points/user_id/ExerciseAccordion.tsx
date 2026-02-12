"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import PeerOrSelfReviewSubmissionSummaryAccordion from "./PeerOrSelfReviewSubmissionSummaryAccordion"

import CustomPointsPopup from "@/app/manage/exercises/[id]/submissions/CustomPointsPopup"
import { createTeacherGradingDecision } from "@/services/backend/teacher-grading-decisions"
import {
  ExerciseStatusSummaryForUser,
  NewTeacherGradingDecision,
} from "@/shared-module/common/bindings"
import BooleanAsText from "@/shared-module/common/components/BooleanAsText"
import DebugModal from "@/shared-module/common/components/DebugModal"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"

interface ExerciseAccordionProps {
  exerciseStatus: ExerciseStatusSummaryForUser
  onPointsUpdate: () => void
}

const ExerciseAccordion: React.FC<ExerciseAccordionProps> = ({
  exerciseStatus,
  onPointsUpdate,
}) => {
  const { t } = useTranslation()
  const userExerciseState = exerciseStatus.user_exercise_state
  const [isExpanded, setIsExpanded] = useState(false)

  const submitMutation = useToastMutation(
    (update: NewTeacherGradingDecision) => {
      return createTeacherGradingDecision(update)
    },
    {
      notify: true,
      method: "PUT",
    },
    {
      onSuccess: (_data) => {
        onPointsUpdate()
      },
    },
  )

  const handleCustomPoints = useCallback(
    (points: number) => {
      if (!userExerciseState) {
        throw new Error("User exercise state not found")
      }
      submitMutation.mutate({
        user_exercise_state_id: userExerciseState.id,
        exercise_id: exerciseStatus.exercise.id,
        // eslint-disable-next-line i18next/no-literal-string
        action: "CustomPoints",
        manual_points: points,
        justification: null,
        hidden: false,
      })
    },
    [exerciseStatus.exercise.id, submitMutation, userExerciseState],
  )

  return (
    <div
      className={css`
        margin-bottom: 1rem;
        border: 1px solid ${baseTheme.colors.clear[300]};
        border-radius: 6px;
        background-color: ${baseTheme.colors.primary[100]};
        box-shadow: 0 1px 4px ${baseTheme.colors.clear[300]};
        transition:
          border-color 0.2s ease,
          box-shadow 0.2s ease;
        ${isExpanded &&
        `
          border-color: ${baseTheme.colors.green[400]};
          box-shadow: 0 4px 12px ${baseTheme.colors.clear[400]};
        `}
        ${userExerciseState === undefined &&
        `opacity: 0.5;
         cursor: not-allowed;
        `}
      `}
      data-testid={"exercise-status"}
    >
      <div
        className={css`
          padding: 0.75rem 1rem;
          border-bottom: 1px solid ${baseTheme.colors.clear[200]};
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        `}
      >
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 1rem;
            flex: 1;
            min-width: 0;
          `}
        >
          <h2
            className={css`
              color: ${baseTheme.colors.gray[700]};
              margin: 0;
              font-size: 1rem;
              font-weight: 600;
              line-height: 1.3;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            `}
          >
            {exerciseStatus.exercise.name}
          </h2>
          <span
            className={css`
              color: ${baseTheme.colors.gray[500]};
              font-size: 0.85rem;
              white-space: nowrap;
            `}
          >
            {t("header-n-submissions", {
              n: exerciseStatus.exercise_slide_submissions.length,
            })}
          </span>
        </div>
        <div
          className={css`
            padding: 0.35rem 0.75rem;
            border-radius: 4px;
            border: 1px solid ${baseTheme.colors.clear[200]};
            text-align: center;
            min-width: 70px;
            white-space: nowrap;
          `}
        >
          <div
            className={css`
              color: ${userExerciseState
                ? baseTheme.colors.green[700]
                : baseTheme.colors.gray[500]};
              font-size: 1rem;
              font-weight: 600;
              line-height: 1;
            `}
          >
            <HideTextInSystemTests
              text={(userExerciseState?.score_given ?? 0).toString()}
              testPlaceholder="X"
            />
            <span
              className={css`
                font-size: 0.85rem;
                color: ${baseTheme.colors.gray[500]};
              `}
            >
              /{exerciseStatus.exercise.score_maximum || 0}
            </span>
          </div>
        </div>
      </div>

      {userExerciseState && (
        <div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={css`
              width: 100%;
              padding: 1rem 1.5rem;
              display: flex;
              align-items: center;
              justify-content: space-between;
              background: none;
              border: none;
              border-bottom: 1px solid ${baseTheme.colors.clear[200]};
              color: ${baseTheme.colors.gray[700]};
              font-weight: 500;
              cursor: pointer;
              transition: background-color 0.2s ease;

              &:hover {
                background-color: ${baseTheme.colors.clear[100]};
              }

              &:focus {
                outline: none;
                background-color: ${baseTheme.colors.clear[100]};
              }
            `}
          >
            <span>{t("view-details")}</span>
            <span
              className={css`
                display: inline-block;
                transition: transform 0.2s ease;
                transform: ${isExpanded ? "rotate(180deg)" : "rotate(0)"};
              `}
              // eslint-disable-next-line i18next/no-literal-string
            >
              ▼
            </span>
          </button>
          <div
            className={css`
              max-height: ${isExpanded ? "3000px" : "0"};
              overflow: hidden;
              transition: max-height 0.3s ease-out;
              background-color: ${baseTheme.colors.primary[100]};
            `}
          >
            <div>
              {exerciseStatus.exercise_slide_submissions.length > 0 ? (
                <div>
                  {exerciseStatus.teacher_grading_decision && (
                    <div
                      className={css`
                        background-color: ${baseTheme.colors.green[100]};
                        padding: 0.6rem 1.25rem;
                        border-left: 3px solid ${baseTheme.colors.green[600]};
                        font-size: 0.9rem;
                        color: ${baseTheme.colors.green[700]};
                      `}
                    >
                      {t("teacher-has-graded-this-manually")} (
                      <strong>{exerciseStatus.teacher_grading_decision.teacher_decision}</strong>{" "}
                      {exerciseStatus.teacher_grading_decision.score_given})
                    </div>
                  )}

                  <div
                    className={css`
                      border-bottom: 1px solid ${baseTheme.colors.clear[200]};
                    `}
                  >
                    <h3
                      className={css`
                        color: ${baseTheme.colors.gray[700]};
                        margin: 0;
                        font-size: 0.85rem;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.03em;
                        padding: 0.5rem 1.25rem;
                      `}
                    >
                      {t("header-submissions")}
                    </h3>
                    <div
                      className={css`
                        padding: 0.75rem 1.25rem;
                        display: flex;
                        flex-direction: column;
                        gap: 0.25rem;
                      `}
                    >
                      {exerciseStatus.exercise_slide_submissions.map((exerciseSlideSubmission) => (
                        <div
                          key={exerciseSlideSubmission.id}
                          className={css`
                            display: flex;
                            align-items: center;
                            gap: 0.75rem;
                            font-size: 0.85rem;
                          `}
                        >
                          <Link
                            href={`/submissions/${exerciseSlideSubmission.id}`}
                            className={css`
                              color: ${baseTheme.colors.blue[600]};
                              text-decoration: none;
                              &:hover {
                                text-decoration: underline;
                              }
                            `}
                          >
                            <HideTextInSystemTests
                              text={exerciseSlideSubmission.id}
                              testPlaceholder="00000000-0000-0000-0000-000000000000"
                            />
                          </Link>
                          <span
                            className={css`
                              color: ${baseTheme.colors.gray[600]};
                              font-size: 0.8rem;
                            `}
                          >
                            {dateToString(exerciseSlideSubmission.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {exerciseStatus.exercise.needs_peer_review && (
                    <div
                      className={css`
                        border-bottom: 1px solid ${baseTheme.colors.clear[200]};
                        margin-top: 0.75rem;
                      `}
                    >
                      <h3
                        className={css`
                          color: ${baseTheme.colors.gray[700]};
                          margin: 0;
                          font-size: 0.85rem;
                          font-weight: 700;
                          text-transform: uppercase;
                          letter-spacing: 0.03em;
                          padding: 0.5rem 1.25rem;
                        `}
                      >
                        {t("peer-reviews")}
                      </h3>

                      <div
                        className={css`
                          padding: 0.75rem 1.25rem;
                        `}
                      >
                        {exerciseStatus.peer_review_queue_entry ? (
                          <div
                            className={css`
                              display: grid;
                              grid-template-columns: auto 1fr;
                              gap: 0.15rem 1rem;
                              align-items: baseline;
                              margin-bottom: 0.75rem;
                              font-size: 0.85rem;
                              color: ${baseTheme.colors.gray[700]};
                            `}
                          >
                            <span>{t("given-enough-peer-reviews")}:</span>
                            <span
                              className={css`
                                color: ${baseTheme.colors.green[600]};
                                font-weight: 500;
                              `}
                            >
                              {t("label-true")}
                            </span>
                            <span>{t("received-enough-peer-reviews")}:</span>
                            <span
                              className={css`
                                color: ${baseTheme.colors.green[600]};
                                font-weight: 500;
                              `}
                            >
                              <BooleanAsText
                                value={
                                  exerciseStatus.peer_review_queue_entry
                                    .received_enough_peer_reviews
                                }
                              />
                            </span>
                            <span>{t("label-entered-peer-review-queue")}:</span>
                            <span>
                              <HideTextInSystemTests
                                text={dateToString(
                                  exerciseStatus.peer_review_queue_entry.created_at,
                                )}
                                testPlaceholder={dateToString(new Date(0))}
                              />
                            </span>
                            <span>{t("label-submission-being-reviewed")}:</span>
                            <span>
                              <HideTextInSystemTests
                                text={
                                  exerciseStatus.peer_review_queue_entry
                                    .receiving_peer_reviews_exercise_slide_submission_id
                                }
                                testPlaceholder="00000000-0000-0000-0000-000000000000"
                              />
                            </span>
                            <span>{t("label-priority")}:</span>
                            <span
                              className={css`
                                color: ${baseTheme.colors.green[600]};
                                font-weight: 500;
                              `}
                            >
                              {exerciseStatus.peer_review_queue_entry.peer_review_priority}
                            </span>
                          </div>
                        ) : (
                          <p
                            className={css`
                              margin: 0 0 0.75rem;
                              font-size: 0.85rem;
                              color: ${baseTheme.colors.gray[600]};
                            `}
                          >
                            {t("given-enough-peer-reviews")}:{" "}
                            <strong
                              className={css`
                                color: ${baseTheme.colors.gray[700]};
                              `}
                            >
                              {t("label-false")}
                            </strong>
                          </p>
                        )}

                        {exerciseStatus.received_peer_or_self_review_submissions.length > 0 ? (
                          <div
                            className={css`
                              margin-bottom: 0.75rem;
                              padding-bottom: 0.75rem;
                              border-bottom: 1px solid ${baseTheme.colors.clear[200]};
                            `}
                          >
                            <h4
                              className={css`
                                color: ${baseTheme.colors.gray[700]};
                                margin: 0 0 0.35rem;
                                font-size: 0.8rem;
                                font-weight: 600;
                                display: flex;
                                align-items: center;
                                gap: 0.35rem;
                              `}
                            >
                              {t("peer-reviews-received")}
                              <span
                                className={css`
                                  display: inline-flex;
                                  align-items: center;
                                  padding: 0.05rem 0.45rem;
                                  border-radius: 9999px;
                                  background-color: ${baseTheme.colors.green[100]};
                                  color: ${baseTheme.colors.green[700]};
                                  font-size: 0.7rem;
                                  font-weight: 700;
                                `}
                              >
                                {exerciseStatus.received_peer_or_self_review_submissions.length}
                              </span>
                            </h4>
                            {exerciseStatus.received_peer_or_self_review_submissions.map(
                              (received) => {
                                const peerOrSelfReviewQuestionSubmissions =
                                  exerciseStatus.received_peer_or_self_review_question_submissions.filter(
                                    (prqs) =>
                                      prqs.peer_or_self_review_submission_id === received.id,
                                  )
                                return (
                                  <PeerOrSelfReviewSubmissionSummaryAccordion
                                    key={received.id}
                                    peerOrSelfReviewSubmission={received}
                                    peerOrSelfReviewQuestionSubmissions={
                                      peerOrSelfReviewQuestionSubmissions
                                    }
                                    peerOrSelfReviewQuestions={
                                      exerciseStatus.peer_or_self_review_questions
                                    }
                                    showSubmissionBeingReviewed={
                                      exerciseStatus.exercise_slide_submissions.length > 1
                                    }
                                  />
                                )
                              },
                            )}
                          </div>
                        ) : (
                          <p
                            className={css`
                              color: ${baseTheme.colors.gray[600]};
                              font-style: italic;
                              margin: 0 0 0.75rem;
                              font-size: 0.85rem;
                            `}
                          >
                            {t("no-peer-reviews-received")}
                          </p>
                        )}

                        {exerciseStatus.given_peer_or_self_review_submissions.length > 0 ? (
                          <div>
                            <h4
                              className={css`
                                color: ${baseTheme.colors.gray[700]};
                                margin: 0 0 0.35rem;
                                font-size: 0.8rem;
                                font-weight: 600;
                                display: flex;
                                align-items: center;
                                gap: 0.35rem;
                              `}
                            >
                              {t("peer-reviews-given")}
                              <span
                                className={css`
                                  display: inline-flex;
                                  align-items: center;
                                  padding: 0.05rem 0.45rem;
                                  border-radius: 9999px;
                                  background-color: ${baseTheme.colors.green[100]};
                                  color: ${baseTheme.colors.green[700]};
                                  font-size: 0.7rem;
                                  font-weight: 700;
                                `}
                              >
                                {exerciseStatus.given_peer_or_self_review_submissions.length}
                              </span>
                            </h4>
                            {exerciseStatus.given_peer_or_self_review_submissions.map((given) => {
                              const peerOrSelfReviewQuestionSubmissions =
                                exerciseStatus.given_peer_or_self_review_question_submissions.filter(
                                  (prqs) => prqs.peer_or_self_review_submission_id === given.id,
                                )
                              return (
                                <PeerOrSelfReviewSubmissionSummaryAccordion
                                  key={given.id}
                                  peerOrSelfReviewSubmission={given}
                                  showSubmissionBeingReviewed
                                  peerOrSelfReviewQuestionSubmissions={
                                    peerOrSelfReviewQuestionSubmissions
                                  }
                                  peerOrSelfReviewQuestions={
                                    exerciseStatus.peer_or_self_review_questions
                                  }
                                />
                              )
                            })}
                          </div>
                        ) : (
                          <p
                            className={css`
                              color: ${baseTheme.colors.gray[600]};
                              font-style: italic;
                              margin: 0;
                              font-size: 0.85rem;
                            `}
                          >
                            {t("no-peer-reviews-given")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p
                  className={css`
                    color: ${baseTheme.colors.gray[600]};
                    font-style: italic;
                    margin: 0;
                    padding: 1.25rem;
                    font-size: 0.9rem;
                  `}
                >
                  {t("no-submissions")}
                </p>
              )}
            </div>
            <div
              className={css`
                padding: 0.75rem 1.25rem;
                background-color: ${baseTheme.colors.primary[100]};
                border-top: 1px solid ${baseTheme.colors.clear[300]};
                display: flex;
                gap: 1rem;
                align-items: center;
              `}
            >
              <DebugModal data={exerciseStatus} />
              <CustomPointsPopup
                exerciseMaxPoints={exerciseStatus.exercise.score_maximum || 0}
                onSubmit={handleCustomPoints}
                longButtonName
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExerciseAccordion
