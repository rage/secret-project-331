import { css } from "@emotion/css"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import PeerOrSelfReviewSubmissionSummaryAccordion from "./PeerOrSelfReviewSubmissionSummaryAccordion"

import { ExerciseStatusSummaryForUser } from "@/shared-module/common/bindings"
import Accordion from "@/shared-module/common/components/Accordion"
import BooleanAsText from "@/shared-module/common/components/BooleanAsText"
import DebugModal from "@/shared-module/common/components/DebugModal"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { dateToString } from "@/shared-module/common/utils/time"

interface ExerciseAccordionProps {
  exerciseStatus: ExerciseStatusSummaryForUser
}

const ExerciseAccordion: React.FC<ExerciseAccordionProps> = ({ exerciseStatus }) => {
  const { t } = useTranslation()
  const userExerciseState = exerciseStatus.user_exercise_state

  return (
    <Accordion
      key={exerciseStatus.exercise.id}
      className={css`
        margin-bottom: 1rem;
        ${userExerciseState === undefined &&
        `opacity: 0.5;
         cursor: not-allowed;

         details summary {
           cursor: not-allowed;
         }
        `}
      `}
    >
      <details>
        <summary>
          {t("exercise")}: {exerciseStatus.exercise.name} (
          <HideTextInSystemTests
            text={t("header-n-submissions", {
              n: exerciseStatus.exercise_slide_submissions.length,
            })}
            testPlaceholder={t("header-n-submissions", {
              n: "X",
            })}
          />
          )
          {userExerciseState && (
            <span
              className={css`
                float: right;
                margin-right: 64px;
              `}
            >
              (
              <HideTextInSystemTests
                text={(userExerciseState.score_given ?? 0).toString()}
                testPlaceholder="X"
              />
              /{exerciseStatus.exercise.score_maximum})
            </span>
          )}
        </summary>
        {userExerciseState && (
          <div>
            {exerciseStatus.exercise_slide_submissions.length > 0 ? (
              <div>
                <div>
                  <p>
                    {t("score-given")}: {userExerciseState.score_given ?? 0}/
                    {exerciseStatus.exercise.score_maximum}
                  </p>
                  {exerciseStatus.teacher_grading_decision && (
                    <p>
                      {t("teacher-has-graded-this-manually")} (
                      {exerciseStatus.teacher_grading_decision.teacher_decision}{" "}
                      {exerciseStatus.teacher_grading_decision.score_given})
                    </p>
                  )}
                </div>

                <>
                  <h2>{t("header-submissions")}</h2>
                  <div>
                    {exerciseStatus.exercise_slide_submissions.map((exerciseSlideSubmission) => {
                      return (
                        <div key={exerciseSlideSubmission.id}>
                          <Link
                            href={{
                              pathname: "/submissions/[submissionId]",
                              query: {
                                submissionId: exerciseSlideSubmission.id,
                              },
                            }}
                          >
                            <HideTextInSystemTests
                              text={exerciseSlideSubmission.id}
                              testPlaceholder="00000000-0000-0000-0000-000000000000"
                            />
                          </Link>{" "}
                          (
                          <HideTextInSystemTests
                            text={dateToString(exerciseSlideSubmission.created_at)}
                            testPlaceholder={dateToString(new Date(0))}
                          />
                          )
                        </div>
                      )
                    })}
                  </div>
                </>

                {exerciseStatus.exercise.needs_peer_review && (
                  <>
                    <h2>{t("peer-reviews")}</h2>

                    {exerciseStatus.peer_review_queue_entry ? (
                      <>
                        <p>
                          {t("given-enough-peer-reviews")}: {t("label-true")}
                        </p>
                        <p>
                          {`${t("received-enough-peer-reviews")}: `}{" "}
                          <BooleanAsText
                            value={
                              exerciseStatus.peer_review_queue_entry.received_enough_peer_reviews
                            }
                          />
                        </p>
                        <p>
                          {t("label-entered-peer-review-queue")}:{" "}
                          <HideTextInSystemTests
                            text={dateToString(exerciseStatus.peer_review_queue_entry.created_at)}
                            testPlaceholder={dateToString(new Date(0))}
                          />
                        </p>
                        <p>
                          {t("label-submission-being-reviewed")}:{" "}
                          <HideTextInSystemTests
                            text={
                              exerciseStatus.peer_review_queue_entry
                                .receiving_peer_reviews_exercise_slide_submission_id
                            }
                            testPlaceholder="00000000-0000-0000-0000-000000000000"
                          />
                        </p>
                        <p>
                          {t("label-priority")}:{" "}
                          {exerciseStatus.peer_review_queue_entry.peer_review_priority}
                        </p>
                      </>
                    ) : (
                      <p>
                        {t("given-enough-peer-reviews")}: {t("label-false")}
                      </p>
                    )}

                    {exerciseStatus.received_peer_or_self_review_submissions.length > 0 ? (
                      <>
                        <h3>
                          {t("peer-reviews-received")} (
                          {exerciseStatus.received_peer_or_self_review_submissions.length})
                        </h3>
                        {exerciseStatus.received_peer_or_self_review_submissions.map((received) => {
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
                        })}
                      </>
                    ) : (
                      <h3> {t("no-peer-reviews-received")} </h3>
                    )}
                    {exerciseStatus.given_peer_or_self_review_submissions.length > 0 ? (
                      <>
                        <h3>
                          {t("peer-reviews-given")} (
                          {exerciseStatus.given_peer_or_self_review_submissions.length})
                        </h3>

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
                      </>
                    ) : (
                      <h3> {t("no-peer-reviews-given")} </h3>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p>{t("no-submissions")}</p>
            )}
          </div>
        )}
        <div>
          <DebugModal data={exerciseStatus} />
        </div>
      </details>
    </Accordion>
  )
}

export default ExerciseAccordion
