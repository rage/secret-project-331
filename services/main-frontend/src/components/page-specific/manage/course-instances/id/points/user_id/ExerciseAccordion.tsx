import { css } from "@emotion/css"
import Link from "next/link"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import PeerOrSelfReviewSubmissionSummaryAccordion from "./PeerOrSelfReviewSubmissionSummaryAccordion"

import { ExerciseStatusSummaryForUser } from "@/shared-module/common/bindings"
import BooleanAsText from "@/shared-module/common/components/BooleanAsText"
import DebugModal from "@/shared-module/common/components/DebugModal"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { baseTheme } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"

interface ExerciseAccordionProps {
  exerciseStatus: ExerciseStatusSummaryForUser
}

const ExerciseAccordion: React.FC<ExerciseAccordionProps> = ({ exerciseStatus }) => {
  const { t } = useTranslation()
  const userExerciseState = exerciseStatus.user_exercise_state
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      className={css`
        margin-bottom: 1rem;
        border: 1px solid ${baseTheme.colors.clear[200]};
        border-radius: 6px;
        background-color: ${baseTheme.colors.primary[100]};
        box-shadow: 0 1px 3px ${baseTheme.colors.clear[100]};
        ${userExerciseState === undefined &&
        `opacity: 0.5;
         cursor: not-allowed;
        `}
      `}
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
              max-height: ${isExpanded ? "2000px" : "0"};
              overflow: hidden;
              transition: max-height 0.3s ease-out;
              background-color: ${baseTheme.colors.clear[100]};
            `}
          >
            <div
              className={css`
                padding: 1.5rem;
              `}
            >
              {exerciseStatus.exercise_slide_submissions.length > 0 ? (
                <div>
                  {exerciseStatus.teacher_grading_decision && (
                    <div
                      className={css`
                        background-color: ${baseTheme.colors.green[100]};
                        padding: 1rem;
                        border-radius: 4px;
                        margin-bottom: 1.5rem;
                        border: 1px solid ${baseTheme.colors.green[200]};
                      `}
                    >
                      <p
                        className={css`
                          margin: 0;
                          color: ${baseTheme.colors.green[700]};
                        `}
                      >
                        {t("teacher-has-graded-this-manually")} (
                        <strong>{exerciseStatus.teacher_grading_decision.teacher_decision}</strong>{" "}
                        {exerciseStatus.teacher_grading_decision.score_given})
                      </p>
                    </div>
                  )}

                  <div
                    className={css`
                      margin-bottom: 2rem;
                    `}
                  >
                    <h3
                      className={css`
                        color: ${baseTheme.colors.gray[700]};
                        margin: 0 0 1rem;
                        font-size: 1.1rem;
                        border-bottom: 1px solid ${baseTheme.colors.clear[200]};
                        padding-bottom: 0.5rem;
                      `}
                    >
                      {t("header-submissions")}
                    </h3>
                    <div
                      className={css`
                        display: grid;
                        gap: 0.75rem;
                      `}
                    >
                      {exerciseStatus.exercise_slide_submissions.map((exerciseSlideSubmission) => (
                        <div
                          key={exerciseSlideSubmission.id}
                          className={css`
                            display: flex;
                            align-items: center;
                            gap: 1rem;
                            padding: 0.75rem;
                            border-radius: 4px;
                            border: 1px solid ${baseTheme.colors.clear[200]};
                            background-color: ${baseTheme.colors.primary[100]};
                            &:hover {
                              background-color: ${baseTheme.colors.clear[100]};
                            }
                          `}
                        >
                          <Link
                            href={{
                              pathname: "/submissions/[submissionId]",
                              query: {
                                submissionId: exerciseSlideSubmission.id,
                              },
                            }}
                            className={css`
                              color: ${baseTheme.colors.blue[600]};
                              text-decoration: none;
                              font-weight: 500;
                              &:hover {
                                color: ${baseTheme.colors.blue[700]};
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
                              color: ${baseTheme.colors.gray[500]};
                              font-size: 0.9rem;
                            `}
                          >
                            {dateToString(exerciseSlideSubmission.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {exerciseStatus.exercise.needs_peer_review && (
                    <div>
                      <h3
                        className={css`
                          color: ${baseTheme.colors.gray[700]};
                          margin: 0 0 1rem;
                          font-size: 1.1rem;
                          border-bottom: 1px solid ${baseTheme.colors.clear[200]};
                          padding-bottom: 0.5rem;
                        `}
                      >
                        {t("peer-reviews")}
                      </h3>

                      {exerciseStatus.peer_review_queue_entry ? (
                        <div
                          className={css`
                            background-color: ${baseTheme.colors.primary[100]};
                            padding: 1rem;
                            border-radius: 4px;
                            margin-bottom: 1.5rem;
                            border: 1px solid ${baseTheme.colors.clear[200]};
                          `}
                        >
                          <div
                            className={css`
                              display: grid;
                              gap: 0.5rem;
                            `}
                          >
                            <p
                              className={css`
                                margin: 0;
                                color: ${baseTheme.colors.gray[700]};
                              `}
                            >
                              {t("given-enough-peer-reviews")}:{" "}
                              <span
                                className={css`
                                  color: ${baseTheme.colors.green[600]};
                                  font-weight: 500;
                                `}
                              >
                                {t("label-true")}
                              </span>
                            </p>
                            <p
                              className={css`
                                margin: 0;
                                color: ${baseTheme.colors.gray[700]};
                              `}
                            >
                              {`${t("received-enough-peer-reviews")}: `}{" "}
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
                            </p>
                            <p
                              className={css`
                                margin: 0;
                                color: ${baseTheme.colors.gray[700]};
                              `}
                            >
                              {t("label-entered-peer-review-queue")}:{" "}
                              <HideTextInSystemTests
                                text={dateToString(
                                  exerciseStatus.peer_review_queue_entry.created_at,
                                )}
                                testPlaceholder={dateToString(new Date(0))}
                              />
                            </p>
                            <p
                              className={css`
                                margin: 0;
                                color: ${baseTheme.colors.gray[700]};
                              `}
                            >
                              {t("label-submission-being-reviewed")}:{" "}
                              <HideTextInSystemTests
                                text={
                                  exerciseStatus.peer_review_queue_entry
                                    .receiving_peer_reviews_exercise_slide_submission_id
                                }
                                testPlaceholder="00000000-0000-0000-0000-000000000000"
                              />
                            </p>
                            <p
                              className={css`
                                margin: 0;
                                color: ${baseTheme.colors.gray[700]};
                              `}
                            >
                              {t("label-priority")}:{" "}
                              <span
                                className={css`
                                  color: ${baseTheme.colors.green[600]};
                                  font-weight: 500;
                                `}
                              >
                                {exerciseStatus.peer_review_queue_entry.peer_review_priority}
                              </span>
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p
                          className={css`
                            margin: 0;
                            color: ${baseTheme.colors.gray[700]};
                          `}
                        >
                          {t("given-enough-peer-reviews")}:{" "}
                          <span
                            className={css`
                              color: ${baseTheme.colors.gray[500]};
                            `}
                          >
                            {t("label-false")}
                          </span>
                        </p>
                      )}

                      {exerciseStatus.received_peer_or_self_review_submissions.length > 0 ? (
                        <div
                          className={css`
                            margin-bottom: 2rem;
                          `}
                        >
                          <h4
                            className={css`
                              color: ${baseTheme.colors.gray[700]};
                              margin: 0 0 1rem;
                              font-size: 1rem;
                              border-bottom: 1px solid ${baseTheme.colors.clear[200]};
                              padding-bottom: 0.25rem;
                            `}
                          >
                            {t("peer-reviews-received")} (
                            {exerciseStatus.received_peer_or_self_review_submissions.length})
                          </h4>
                          {exerciseStatus.received_peer_or_self_review_submissions.map(
                            (received) => {
                              const peerOrSelfReviewQuestionSubmissions =
                                exerciseStatus.received_peer_or_self_review_question_submissions.filter(
                                  (prqs) => prqs.peer_or_self_review_submission_id === received.id,
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
                            color: ${baseTheme.colors.gray[500]};
                            font-style: italic;
                            margin: 0 0 1.5rem;
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
                              margin: 0 0 1rem;
                              font-size: 1rem;
                              border-bottom: 1px solid ${baseTheme.colors.clear[200]};
                              padding-bottom: 0.25rem;
                            `}
                          >
                            {t("peer-reviews-given")} (
                            {exerciseStatus.given_peer_or_self_review_submissions.length})
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
                            color: ${baseTheme.colors.gray[500]};
                            font-style: italic;
                            margin: 0;
                          `}
                        >
                          {t("no-peer-reviews-given")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p
                  className={css`
                    color: ${baseTheme.colors.gray[500]};
                    font-style: italic;
                    margin: 0;
                  `}
                >
                  {t("no-submissions")}
                </p>
              )}
              <div
                className={css`
                  margin-top: 1.5rem;
                  padding-top: 1.5rem;
                  border-top: 1px solid ${baseTheme.colors.clear[200]};
                `}
              >
                <DebugModal data={exerciseStatus} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExerciseAccordion
