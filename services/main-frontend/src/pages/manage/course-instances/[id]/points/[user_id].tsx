import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { groupBy } from "lodash"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../../components/Layout"
import PeerReviewSubmissionSummaryAccordion from "../../../../../components/page-specific/manage/course-instances/id/points/user_id/PeerReviewSubmissionSummaryAccordion"
import { useCourseStructure } from "../../../../../hooks/useCourseStructure"
import { getAllExerciseStatuses } from "../../../../../services/backend/course-instances"
import { ExerciseDataForUser } from "../../../../../shared-module/bindings"
import Accordion from "../../../../../shared-module/components/Accordion"
import ErrorBanner from "../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../../shared-module/contexts/LoginStateContext"
import { baseTheme } from "../../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../../shared-module/styles/respond"
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

  const PeerReviewDiv = styled.div`
    margin-bottom: 0.5rem;
  `

  const exerciseStatusListQuery = useQuery(
    [`${query.id}-status-for-all-exercises-${query.user_id}`],
    () => getAllExerciseStatuses(query.id, query.user_id),
  )
  const exerciseStatusList = exerciseStatusListQuery.data
  const courseId = getCourseId(exerciseStatusList)
  const courseStructure = useCourseStructure(courseId)

  if (exerciseStatusListQuery.isError || courseStructure.isError) {
    return (
      <ErrorBanner
        variant={"readOnly"}
        error={exerciseStatusListQuery.error || courseStructure.error}
      />
    )
  }

  if (exerciseStatusListQuery.isLoading || courseStructure.isLoading || !exerciseStatusList) {
    return <Spinner variant="medium" />
  }

  const groupedByChapter = Object.entries(
    groupBy(exerciseStatusList, (exercise) => exercise.exercise_points.chapter_id),
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
              (a, b) => a.exercise_points.order_number - b.exercise_points.order_number,
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
                {exerciseStatusList?.map((exercise) => {
                  const exerciseGradingStatus = exercise.submission_ids.find(
                    (gs) => gs.exercise_id === exercise.exercise_points.id,
                  )

                  return (
                    <Accordion
                      key={exercise.exercise_points.id}
                      variant="detail"
                      className={css`
                        margin-bottom: 1rem;
                        ${exerciseGradingStatus === undefined &&
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
                          {t("exercise")}: {exercise.exercise_points.name} (
                          {t("header-n-submissions", { n: exercise.submission_ids.length })})
                          {exerciseGradingStatus && (
                            <span
                              className={css`
                                float: right;
                                margin-right: 64px;
                              `}
                            >
                              {exerciseGradingStatus.score_given ?? 0}/
                              {exerciseGradingStatus.score_maximum}
                            </span>
                          )}
                        </summary>
                        {exerciseGradingStatus && (
                          <div>
                            {exercise.submission_ids.length > 0 ? (
                              <div>
                                {exercise.submission_ids.length > 0 ? (
                                  <div>
                                    <p>
                                      {t("score-given")}: {exerciseGradingStatus.score_given ?? 0}/
                                      {exerciseGradingStatus.score_maximum}
                                    </p>
                                    {exerciseGradingStatus.teacher_decision && (
                                      <p>
                                        {t("teacher-has-graded-this-manually")} (
                                        {exerciseGradingStatus.teacher_decision})
                                      </p>
                                    )}
                                  </div>
                                ) : null}

                                {exercise.submission_ids.length > 0 ? (
                                  <>
                                    <h2>{t("header-submissions")}</h2>
                                    <div>
                                      {exercise.submission_ids.map((submissionIds) => {
                                        return (
                                          <div key={submissionIds.submission_id}>
                                            <Link
                                              href={{
                                                pathname: "/submissions/[submissionId]",
                                                query: {
                                                  submissionId: submissionIds.submission_id,
                                                },
                                              }}
                                            >
                                              {submissionIds.submission_id}
                                            </Link>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </>
                                ) : (
                                  <h2>{t("no-submissions")}</h2>
                                )}

                                {exercise.exercise_points.needs_peer_review && (
                                  <>
                                    <h2>Peer review</h2>

                                    {exercise.peer_review_queue_entry ? (
                                      <>
                                        <p>Given enough peer reviews: {true.toString()}</p>
                                        <p>{`${t("received-enough-peer-reviews")}: ${
                                          exercise.peer_review_queue_entry
                                            .received_enough_peer_reviews
                                        }`}</p>
                                        <p>
                                          Entered the peer review queue:{" "}
                                          {dateToString(
                                            exercise.peer_review_queue_entry.created_at,
                                          )}
                                        </p>
                                        <p>
                                          Submission being peer reviewed:{" "}
                                          {
                                            exercise.peer_review_queue_entry
                                              .receiving_peer_reviews_exercise_slide_submission_id
                                          }
                                        </p>
                                        <p>
                                          Priority:{" "}
                                          {exercise.peer_review_queue_entry.peer_review_priority}
                                        </p>
                                      </>
                                    ) : (
                                      <p>Given enough peer reviews: {false.toString()}</p>
                                    )}

                                    {exercise.received_peer_review_data.length > 0 ? (
                                      <>
                                        <h3>
                                          {t("peer-reviews-received")}: (
                                          {exercise.received_peer_review_data.length})
                                        </h3>
                                        {exercise.received_peer_review_data.map((received) => (
                                          <PeerReviewSubmissionSummaryAccordion
                                            key={received.submission_id}
                                            peerReviewSubmission={received}
                                          />
                                        ))}
                                      </>
                                    ) : (
                                      <h3> {t("no-peer-reviews-received")} </h3>
                                    )}
                                    {exercise.given_peer_review_data.length > 0 ? (
                                      <>
                                        <h3>
                                          {t("peer-reviews-given")}: (
                                          {exercise.submission_ids.length})
                                        </h3>

                                        {exercise.given_peer_review_data.map((given) => (
                                          <PeerReviewSubmissionSummaryAccordion
                                            key={given.submission_id}
                                            peerReviewSubmission={given}
                                            submissionBeingreviewedId={given.submission_id}
                                          />
                                        ))}
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

const getCourseId = (input: ExerciseDataForUser[] | undefined): string | null => {
  if (!input) {
    return null
  }
  const first = input[0]
  if (!first) {
    return null
  }
  return first.exercise_points.course_id
}
