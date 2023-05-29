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
import {
  getAllCourseModuleCompletionsForUserAndCourseInstance,
  getAllExerciseStatusSummariesForUserAndCourseInstance,
  getUserProgressForCourseInstance,
} from "../../../../../services/backend/course-instances"
import { ExerciseStatusSummaryForUser } from "../../../../../shared-module/bindings"
import Accordion from "../../../../../shared-module/components/Accordion"
import BooleanAsText from "../../../../../shared-module/components/BooleanAsText"
import DebugModal from "../../../../../shared-module/components/DebugModal"
import ErrorBanner from "../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../shared-module/components/Spinner"
import HideTextInSystemTests from "../../../../../shared-module/components/system-tests/HideTextInSystemTests"
import { withSignedIn } from "../../../../../shared-module/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import { dateToString } from "../../../../../shared-module/utils/time"
import withErrorBoundary from "../../../../../shared-module/utils/withErrorBoundary"

export interface CourseInstancePointsListProps {
  query: SimplifiedUrlQuery<string>
}

const Section = styled.section`
  margin: 2rem 0;
`

const CourseInstanceExerciseStatusList: React.FC<
  React.PropsWithChildren<CourseInstancePointsListProps>
> = ({ query }) => {
  const { t } = useTranslation()

  const exerciseStatusSummariesQuery = useQuery(
    [`${query.id}-status-for-all-exercises-${query.user_id}`],
    () => getAllExerciseStatusSummariesForUserAndCourseInstance(query.id, query.user_id),
  )
  const courseModuleCompletionsQuery = useQuery(
    [`${query.id}-course-module-completions-${query.user_id}`],
    () => getAllCourseModuleCompletionsForUserAndCourseInstance(query.id, query.user_id),
  )
  const courseId = getCourseId(exerciseStatusSummariesQuery.data)
  const courseStructure = useCourseStructure(courseId)
  const courseInstanceProgresses = useQuery(
    [`course-instance-${query.id}-progress-${query.user_id}`],
    () => getUserProgressForCourseInstance(query.id, query.user_id),
  )

  if (
    exerciseStatusSummariesQuery.isError ||
    courseStructure.isError ||
    courseModuleCompletionsQuery.isError ||
    courseInstanceProgresses.isError
  ) {
    return (
      <Layout>
        <ErrorBanner
          variant={"readOnly"}
          error={
            exerciseStatusSummariesQuery.error ||
            courseStructure.error ||
            courseModuleCompletionsQuery.error ||
            courseInstanceProgresses.error
          }
        />
      </Layout>
    )
  }

  if (
    exerciseStatusSummariesQuery.isLoading ||
    courseStructure.isLoading ||
    courseModuleCompletionsQuery.isLoading ||
    !exerciseStatusSummariesQuery.data ||
    courseInstanceProgresses.isLoading
  ) {
    return (
      <Layout>
        <Spinner variant="medium" />
      </Layout>
    )
  }

  const groupedByChapter = Object.entries(
    groupBy(
      exerciseStatusSummariesQuery.data,
      (exerciseStatus) => exerciseStatus.exercise.chapter_id,
    ),
  )

  return (
    <Layout navVariant="simple">
      <h1>{t("exercise-status-summary")}</h1>
      <Section>
        <h2
          className={css`
            margin-bottom: 0.5rem;
          `}
        >
          {t("label-course-module-completions")}
        </h2>
        {courseModuleCompletionsQuery.data?.length === 0 && <p>{t("no-data")}</p>}
        {courseModuleCompletionsQuery.data?.map((courseModuleCompletion) => {
          const courseModule = courseStructure.data.modules.find(
            (cm) => cm.id === courseModuleCompletion.course_module_id,
          )
          return (
            <Accordion
              key={courseModuleCompletion.id}
              variant="detail"
              className={css`
                margin-bottom: 1rem;
              `}
            >
              <details>
                <summary>
                  {courseModule?.name ?? t("default-module")}{" "}
                  <HideTextInSystemTests
                    text={dateToString(courseModuleCompletion.completion_date)}
                    testPlaceholder={dateToString(new Date(0))}
                  />
                </summary>
                <div>
                  <p>
                    {t("label-course-module")}: {courseModule?.name ?? t("default-module")}{" "}
                    {courseModule?.uh_course_code && `(${courseModule.uh_course_code})`}
                  </p>
                  <p>
                    {t("label-passed")}: <BooleanAsText value={courseModuleCompletion.passed} />
                  </p>
                  <p>
                    {t("label-grade")}: {courseModuleCompletion.grade}
                  </p>
                  <p>
                    {t("label-prerequisite-modules-completed")}:{" "}
                    <BooleanAsText value={courseModuleCompletion.prerequisite_modules_completed} />
                  </p>
                  <p>
                    {t("label-completion-language")}: {courseModuleCompletion.completion_language}
                  </p>
                  <p>
                    {t("label-created-at")}: {dateToString(courseModuleCompletion.created_at)}
                  </p>
                  <p>
                    {t("label-completion-date-short")}:{" "}
                    {dateToString(courseModuleCompletion.completion_date)}
                  </p>
                  <p>
                    {t("label-completion-registration-attempt-date")}:{" "}
                    {courseModuleCompletion.completion_registration_attempt_date
                      ? dateToString(courseModuleCompletion.completion_registration_attempt_date)
                      : t("label-null")}
                  </p>
                  {courseModuleCompletion.completion_granter_user_id && (
                    <p>
                      {t("label-completion-granter-user-id")}:{" "}
                      {courseModuleCompletion.completion_granter_user_id}
                    </p>
                  )}
                  <DebugModal data={courseModuleCompletion} />
                </div>
              </details>
            </Accordion>
          )
        })}
      </Section>
      <Section>
        <h2
          className={css`
            margin-bottom: 0.5rem;
          `}
        >
          {t("label-progressing")}
        </h2>
        {courseInstanceProgresses.data?.length === 0 && <p>{t("no-data")}</p>}
        {courseInstanceProgresses.data?.map((courseInstanceProgress) => {
          const courseModule = courseStructure.data.modules.find(
            (cm) => cm.id === courseInstanceProgress.course_module_id,
          )
          return (
            <Accordion
              key={courseInstanceProgress.course_module_id}
              variant="detail"
              className={css`
                margin-bottom: 1rem;
              `}
            >
              <details>
                <summary>{courseModule?.name ?? t("default-module")}</summary>
                <div>
                  {courseInstanceProgress.attempted_exercises_required !== null && (
                    <p>
                      {t("label-attempted-exercises-required")}{" "}
                      {courseInstanceProgress.attempted_exercises_required}
                    </p>
                  )}
                  {courseInstanceProgress.score_required !== null && (
                    <p>
                      {t("label-points-required")} {courseInstanceProgress.score_required}
                    </p>
                  )}
                  <p>
                    {t("label-points")}: {courseInstanceProgress.score_given} /{" "}
                    {courseInstanceProgress.score_maximum ?? 0}
                  </p>
                  <p>
                    {t("label-attempted-exercises")}:{" "}
                    {courseInstanceProgress.attempted_exercises ?? 0} /{" "}
                    {courseInstanceProgress.total_exercises ?? 0}
                  </p>
                  <DebugModal data={courseInstanceProgress} />
                </div>
              </details>
            </Accordion>
          )
        })}
      </Section>
      <Section>
        <h2
          className={css`
            margin-bottom: -2rem;
          `}
        >
          {t("link-exercises")}
        </h2>
        <div
          className={css`
            display: flex;
            flex-direction: column;
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
                  <h3
                    className={css`
                      margin-bottom: 1rem;
                    `}
                  >
                    {t("title-chapter", {
                      "chapter-number": chapter?.chapter_number,
                      "chapter-name": chapter?.name,
                    })}
                  </h3>
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
                                                  <HideTextInSystemTests
                                                    text={exerciseSlideSubmission.id}
                                                    testPlaceholder="00000000-0000-0000-0000-000000000000"
                                                  />
                                                </Link>{" "}
                                                (
                                                <HideTextInSystemTests
                                                  text={dateToString(
                                                    exerciseSlideSubmission.created_at,
                                                  )}
                                                  testPlaceholder={dateToString(new Date(0))}
                                                />
                                                )
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
                                                exerciseStatus.peer_review_queue_entry
                                                  .received_enough_peer_reviews
                                              }
                                            />
                                          </p>
                                          <p>
                                            {t("label-entered-peer-review-queue")}:{" "}
                                            <HideTextInSystemTests
                                              text={dateToString(
                                                exerciseStatus.peer_review_queue_entry.created_at,
                                              )}
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
                                            {
                                              exerciseStatus.peer_review_queue_entry
                                                .peer_review_priority
                                            }
                                          </p>
                                        </>
                                      ) : (
                                        <p>
                                          {t("given-enough-peer-reviews")}: {t("label-false")}
                                        </p>
                                      )}

                                      {exerciseStatus.received_peer_review_submissions.length >
                                      0 ? (
                                        <>
                                          <h3>
                                            {/* eslint-disable-next-line i18next/no-literal-string */}
                                            {t("peer-reviews-received")}: (
                                            {exerciseStatus.received_peer_review_submissions.length}
                                            )
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
                                                  peerReviewQuestions={
                                                    exerciseStatus.peer_review_questions
                                                  }
                                                  showSubmissionBeingReviewed={
                                                    exerciseStatus.exercise_slide_submissions
                                                      .length > 1
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
                                            {/* eslint-disable-next-line i18next/no-literal-string */}
                                            {t("peer-reviews-given")}: (
                                            {exerciseStatus.given_peer_review_submissions.length})
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
                                                  peerReviewQuestions={
                                                    exerciseStatus.peer_review_questions
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
                          <div>
                            <DebugModal data={exerciseStatus} />
                          </div>
                        </details>
                      </Accordion>
                    )
                  })}
                </div>
              )
            })}
        </div>
      </Section>
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
