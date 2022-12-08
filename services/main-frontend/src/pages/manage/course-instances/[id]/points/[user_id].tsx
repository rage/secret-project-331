/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../../components/Layout"
import { getExerciseStatus } from "../../../../../services/backend/course-instances"
import { User } from "../../../../../shared-module/bindings"
import BreakFromCentered from "../../../../../shared-module/components/Centering/BreakFromCentered"
import ErrorBanner from "../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../shared-module/components/Spinner"
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
              <h2>Exercise name: {exercise.exercise_points.name}</h2>
              <p>Score given: {exercise.exercise_points.score_given}</p>
              <p>Teacher decision: {exercise.exercise_points.teacher_decision}</p>
              <h2>Peer reviews received</h2>
              {exercise.received_peer_review_data.map((received) => {
                return (
                  <div key={received.id}>
                    <p>Received number data: {received.number_data}</p>
                    <p>Received text data: {received.text_data}</p>
                    <p>Received enough peer reviews: {received.received_enough_peer_reviews}</p>
                  </div>
                )
              })}
              <h2>Peer reviews given</h2>
              {exercise.given_peer_review_data.map((given) => {
                return (
                  <div key={given.id}>
                    <p>Given number data: {given.number_data}</p>
                    <p>Given text data: {given.text_data}</p>
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
