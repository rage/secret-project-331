import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { groupBy } from "lodash"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../../components/Layout"
import PeerReviewSubmissionSummaryAccordion from "../../../../../components/page-specific/manage/course-instances/id/points/user_id/PeerReviewSubmissionSummaryAccordion"
import { useCourseStructure } from "../../../../../hooks/useCourseStructure"
import { getAllExerciseStatusSummariesForUserAndCourseInstance } from "../../../../../services/backend/course-instances"
import { ExerciseStatusSummaryForUser } from "../../../../../shared-module/bindings"
import Accordion from "../../../../../shared-module/components/Accordion"
import ErrorBanner from "../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../../shared-module/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import { dateToString } from "../../../../../shared-module/utils/time"
import withErrorBoundary from "../../../../../shared-module/utils/withErrorBoundary"

export interface CourseInstancePointsListProps {
  query: SimplifiedUrlQuery<string>
}

const CourseInstanceExerciseStatusList: React.FC<
  React.PropsWithChildren<CourseInstancePointsListProps>
> = ({ query }) => {
  const { t } = useTranslation()

  const exerciseStatusSummariesQuery = useQuery(
    [`${query.id}-status-for-all-exercises-${query.user_id}`],
    () => getAllExerciseStatusSummariesForUserAndCourseInstance(query.id, query.user_id),
  )
  const courseId = getCourseId(exerciseStatusSummariesQuery.data)
  const courseStructure = useCourseStructure(courseId)

  if (exerciseStatusSummariesQuery.isError || courseStructure.isError) {
    return (
      <ErrorBanner
        variant={"readOnly"}
        error={exerciseStatusSummariesQuery.error || courseStructure.error}
      />
    )
  }

  if (
    exerciseStatusSummariesQuery.isLoading ||
    courseStructure.isLoading ||
    !exerciseStatusSummariesQuery.data
  ) {
    return <Spinner variant="medium" />
  }

  const groupedByChapter = Object.entries(
    groupBy(
      exerciseStatusSummariesQuery.data,
      (exerciseStatus) => exerciseStatus.exercise.chapter_id,
    ),
  )

  return (
    <Layout navVariant="simple">
      <h1>Breakdown for a user by exercise</h1>
      <div
        className={css`
          display: flex;
          flex-direction: column;
          color: #707070;
          font-weight: 600;
          font-family: Josefin Sans, sans-serif;
        `}
      >
        {groupedByChapter
          .sort(([c1Id, _list1], [c2Id, _list2]) => {
            const chapter1 = courseStructure.data.chapters.find((ch) => ch.id === c1Id)
            const chapter2 = courseStructure.data.chapters.find((ch) => ch.id === c2Id)
            return (chapter1?.chapter_number ?? Infinity) - (chapter2?.chapter_number ?? Infinity)
          })
          .map(([chapterId, exerciseStatusListUnsorted]) => {
            const chapter = courseStructure.data.chapters.find((ch) => ch.id === chapterId)
            const exerciseStatusList = exerciseStatusListUnsorted.sort(
              (a, b) => a.exercise.order_number - b.exercise.order_number,
            )
            return (
              <div
                key={chapterId}
                className={css`
                  margin: 2rem 0;
                `}
              >
                <h2
                  className={css`
                    margin-bottom: 1rem;
                  `}
                >
                  Chapter {chapter?.chapter_number}: {chapter?.name}
                </h2>
                {exerciseStatusList?.map((exerciseStatus) => {
                  const userExerciseState = exerciseStatus.user_exercise_state

                  return (
                    <Accordion
                      key={exerciseStatus.exercise.id}
                      variant="detail"
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
                          {t("header-n-submissions", {
                            n: exerciseStatus.exercise_slide_submissions.length,
                          })}
                          )
                          {userExerciseState && (
                            <span
                              className={css`
                                float: right;
                                margin-right: 64px;
                              `}
                            >
                              {userExerciseState.score_given ?? 0}/
                              {exerciseStatus.exercise.score_maximum}
                            </span>
                          )}
                        </summary>
                        {userExerciseState && (
                          <div>
                            {exerciseStatus.exercise_slide_submissions.length > 0 ? (
                              <div>
                                {exerciseStatus.exercise_slide_submissions.length > 0 ? (
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
                                ) : null}

                                {exerciseStatus.exercise_slide_submissions.length > 0 ? (
                                  <>
                                    <h2>{t("header-submissions")}</h2>
                                    <div>
                                      {exerciseStatus.exercise_slide_submissions.map(
                                        (exerciseSlideSubmission) => {
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
                                                {exerciseSlideSubmission.id}
                                              </Link>
                                            </div>
                                          )
                                        },
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <h2>{t("no-submissions")}</h2>
                                )}

                                {exerciseStatus.exercise.needs_peer_review && (
                                  <>
                                    <h2>Peer review</h2>

                                    {exerciseStatus.peer_review_queue_entry ? (
                                      <>
                                        <p>Given enough peer reviews: {true.toString()}</p>
                                        <p>{`${t("received-enough-peer-reviews")}: ${
                                          exerciseStatus.peer_review_queue_entry
                                            .received_enough_peer_reviews
                                        }`}</p>
                                        <p>
                                          Entered the peer review queue:{" "}
                                          {dateToString(
                                            exerciseStatus.peer_review_queue_entry.created_at,
                                          )}
                                        </p>
                                        <p>
                                          Submission being peer reviewed:{" "}
                                          {
                                            exerciseStatus.peer_review_queue_entry
                                              .receiving_peer_reviews_exercise_slide_submission_id
                                          }
                                        </p>
                                        <p>
                                          Priority:{" "}
                                          {
                                            exerciseStatus.peer_review_queue_entry
                                              .peer_review_priority
                                          }
                                        </p>
                                      </>
                                    ) : (
                                      <p>Given enough peer reviews: {false.toString()}</p>
                                    )}

                                    {exerciseStatus.received_peer_review_submissions.length > 0 ? (
                                      <>
                                        <h3>
                                          {t("peer-reviews-received")}: (
                                          {exerciseStatus.received_peer_review_submissions.length})
                                        </h3>
                                        {exerciseStatus.received_peer_review_submissions.map(
                                          (received) => {
                                            const peerReviewQuestionSubmissions =
                                              exerciseStatus.received_peer_review_question_submissions.filter(
                                                (prqs) =>
                                                  prqs.peer_review_submission_id === received.id,
                                              )
                                            return (
                                              <PeerReviewSubmissionSummaryAccordion
                                                key={received.id}
                                                peerReviewSubmission={received}
                                                peerReviewQuestionSubmissions={
                                                  peerReviewQuestionSubmissions
                                                }
                                              />
                                            )
                                          },
                                        )}
                                      </>
                                    ) : (
                                      <h3> {t("no-peer-reviews-received")} </h3>
                                    )}
                                    {exerciseStatus.given_peer_review_submissions.length > 0 ? (
                                      <>
                                        <h3>
                                          {t("peer-reviews-given")}: (
                                          {exerciseStatus.exercise_slide_submissions.length})
                                        </h3>

                                        {exerciseStatus.given_peer_review_submissions.map(
                                          (given) => {
                                            const peerReviewQuestionSubmissions =
                                              exerciseStatus.given_peer_review_question_submissions.filter(
                                                (prqs) =>
                                                  prqs.peer_review_submission_id === given.id,
                                              )
                                            return (
                                              <PeerReviewSubmissionSummaryAccordion
                                                key={given.id}
                                                peerReviewSubmission={given}
                                                showSubmissionBeingReviewed
                                                peerReviewQuestionSubmissions={
                                                  peerReviewQuestionSubmissions
                                                }
                                              />
                                            )
                                          },
                                        )}
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
                      </details>
                    </Accordion>
                  )
                })}
              </div>
            )
          })}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CourseInstanceExerciseStatusList)),
)

const getCourseId = (input: ExerciseStatusSummaryForUser[] | undefined): string | null => {
  if (!input) {
    return null
  }
  const first = input[0]
  if (!first) {
    return null
  }
  return first.exercise.course_id
}
