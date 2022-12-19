import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../../components/Layout"
import { getAllExerciseStatuses } from "../../../../../services/backend/course-instances"
import Accordion from "../../../../../shared-module/components/Accordion"
import { withSignedIn } from "../../../../../shared-module/contexts/LoginStateContext"
import { respondToOrLarger } from "../../../../../shared-module/styles/respond"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
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

  const exerciseStatusList = useQuery([`${query.id}-exercise-status-${query.user_id}`], () =>
    getAllExerciseStatuses(query.id, query.user_id),
  ).data
  console.log(exerciseStatusList)
  return (
    <Layout navVariant="simple">
      <div
        className={css`
          display: flex;
          flex-direction: column;
          color: #707070;
          font-weight: 600;
          font-family: Josefin Sans, sans-serif;

          margin-top: 40px;
          ${respondToOrLarger.sm} {
            margin-top: 80px;
          }
        `}
      >
        {exerciseStatusList?.map((exercise) => {
          return (
            <Accordion key={exercise.exercise_points.id} variant="detail">
              <details>
                <summary>
                  {t("exercise")}: {exercise.exercise_points.name} ({exercise.submission_ids.length}
                  )
                </summary>
                <div>
                  {exercise.submission_ids.length > 0 ? (
                    <div>
                      {exercise.submission_ids.length > 0 ? (
                        <div>
                          <p>
                            {" "}
                            {t("score-given")}: {exercise.submission_ids[0].score_given}
                          </p>
                          <p>
                            {t("teacher-decision")}: {exercise.submission_ids[0].teacher_decision}
                          </p>
                        </div>
                      ) : null}
                      {exercise.peer_review_queue_entry ? (
                        <p>
                          {`${t("received-enough-peer-reviews")}: ${
                            exercise.peer_review_queue_entry
                          }`}
                        </p>
                      ) : (
                        <p>
                          {t("received-enough-peer-reviews")}: {t("false")}
                        </p>
                      )}

                      {exercise.submission_ids.length > 0 ? (
                        <>
                          <h2>{t("header-submissions")}</h2>
                          {exercise.submission_ids.map((submissionIds) => {
                            return (
                              <div key={submissionIds.submission_id}>
                                <Link
                                  href={{
                                    pathname: "/submissions/[submissionId]",
                                    query: { submissionId: submissionIds.submission_id },
                                  }}
                                >
                                  {submissionIds.submission_id}
                                </Link>
                              </div>
                            )
                          })}
                        </>
                      ) : (
                        <h2>{t("no-submissions")}</h2>
                      )}

                      {exercise.received_peer_review_data.length > 0 ? (
                        <>
                          <h2>{t("peer-reviews-received")}:</h2>
                          {exercise.received_peer_review_data.map((received) => (
                            <div key={received.submission_id}>
                              <Accordion variant="detail">
                                <details>
                                  <summary>
                                    {t("peer-review-submission-id")}: {received.submission_id}
                                  </summary>
                                  {received.data.map((test) => (
                                    <PeerReviewDiv key={test.pr_submission_id}>
                                      <p>
                                        {t("question")}: {test.question}
                                      </p>
                                      <p>
                                        {t("received-number-data")}: {test.number_data}
                                      </p>
                                      <p>
                                        {t("received-text-data")}: {test.text_data}
                                      </p>
                                    </PeerReviewDiv>
                                  ))}
                                </details>
                              </Accordion>
                            </div>
                          ))}
                        </>
                      ) : (
                        <h2> {t("no-peer-reviews-received")} </h2>
                      )}
                      {exercise.given_peer_review_data.length > 0 ? (
                        <>
                          <h2>{t("peer-reviews-given")}:</h2>
                          <Accordion variant="detail">
                            <details>
                              <summary>
                                {t("exercise")}: {exercise.exercise_points.name} (
                                {exercise.submission_ids.length})
                              </summary>
                              {exercise.given_peer_review_data.map((given) =>
                                given.data.map((test) => (
                                  <PeerReviewDiv key={test.pr_submission_id}>
                                    <p>
                                      {t("question")}: {test.question}
                                    </p>
                                    <p>
                                      {t("given-number-data")}: {test.number_data}
                                    </p>
                                    <p>
                                      {t("given-text-data")}: {test.text_data}
                                    </p>
                                  </PeerReviewDiv>
                                )),
                              )}
                            </details>
                          </Accordion>
                        </>
                      ) : (
                        <h2> {t("no-peer-reviews-received")} </h2>
                      )}
                    </div>
                  ) : (
                    <p>{t("no-submissions")}</p>
                  )}
                </div>
              </details>
            </Accordion>
          )
        })}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CourseInstanceExerciseStatusList)),
)
