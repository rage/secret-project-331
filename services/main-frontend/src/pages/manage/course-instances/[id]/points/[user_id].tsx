import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../../components/Layout"
import { getExerciseStatus } from "../../../../../services/backend/course-instances"
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

  const exerciseStatusList = useQuery([`${query.id}-exercise-status-${query.user_id}`], () =>
    getExerciseStatus(query.id, query.user_id),
  ).data
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
            <div key={exercise.exercise_points.id}>
              <h2>
                {t("exercise-name")}: {exercise.exercise_points.name}
              </h2>
              <p>
                {" "}
                {t("score-given")}: {exercise.exercise_points.score_given}
              </p>
              <p>
                {t("teacher-decision")}: {exercise.exercise_points.teacher_decision}
              </p>
              <h2>{t("peer-reviews-received")}:</h2>
              {exercise.received_peer_review_data.map((received) => {
                return (
                  <div key={received.id}>
                    <p>
                      {t("received-number-data")}: {received.number_data}
                    </p>
                    <p>
                      {t("received-text-data")}: {received.text_data}
                    </p>
                    <p>
                      {t("received-enough-peer-reviews")}: {received.received_enough_peer_reviews}
                    </p>
                  </div>
                )
              })}
              <h2>{t("peer-reviews-given")}</h2>
              {exercise.given_peer_review_data.map((given) => {
                return (
                  <div key={given.id}>
                    <p>
                      {t("given-number-data")}: {given.number_data}
                    </p>
                    <p>
                      {t("given-text-data")}: {given.text_data}
                    </p>
                  </div>
                )
              })}
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
