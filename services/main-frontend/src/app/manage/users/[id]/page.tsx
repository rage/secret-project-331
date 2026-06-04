"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import CourseEnrollmentsList from "./CourseEnrollmentsList"
import ExerciseResetLogList from "./ExerciseResetLogList"

import DeletedUserNotice from "@/components/DeletedUserNotice"
import { getUserCourseEnrollmentsOptions } from "@/generated/api/@tanstack/react-query.generated"
import { extractUserDetail, isUserDetailsNotFound, useUserDetails } from "@/hooks/useUserDetails"
import DataLoadError from "@/shared-module/common/components/DataLoadError"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResults } from "@/shared-module/components"

const Area = styled.div`
  margin: 2rem 0;
`

const UserPage: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()

  const courseEnrollmentsQuery = useQuery({
    ...getUserCourseEnrollmentsOptions({
      path: {
        user_id: id,
      },
    }),
  })

  const courseIds = courseEnrollmentsQuery.data?.course_enrollments.map((e) => e.course_id) ?? null

  const userDetailsQuery = useUserDetails(courseIds, id)

  return (
    <QueryResults
      queries={[courseEnrollmentsQuery, userDetailsQuery] as const}
      emptyFallback={
        <DataLoadError
          contextMessage={t("label-user-details-query-returned-no-data")}
          onRetry={() => {
            void userDetailsQuery.refetch()
          }}
        />
      }
      renderData={([, userDetailsResult]) => {
        const userDetails = extractUserDetail(userDetailsResult)
        const userDetailsNotFound = isUserDetailsNotFound(userDetailsResult)
        return (
          <>
            <Area>
              <h1>{t("header-user-details")}</h1>
              <p>
                {t("label-user-id")}: {id}
              </p>
              {userDetailsNotFound ? (
                <DeletedUserNotice userId={id} />
              ) : (
                <>
                  <p>
                    {t("label-email")}: {userDetails?.email}
                  </p>
                  <p>
                    {t("first-name")}: {userDetails?.first_name}
                  </p>
                  <p>
                    {t("last-name")}: {userDetails?.last_name}
                  </p>
                </>
              )}
            </Area>
            <Area>
              <h2>{t("header-course-enrollments")}</h2>
              <CourseEnrollmentsList userId={id} />
            </Area>
            <OnlyRenderIfPermissions
              action={{ type: "teach" }}
              resource={{ type: "global_permissions" }}
            >
              <Area>
                <p
                  className={css`
                    font-size: ${baseTheme.fontSizes[3]}px;
                    font-weight: ${fontWeights.medium};
                  `}
                >
                  {t("label-exercise-reset-log")}
                </p>
                <ExerciseResetLogList userId={id} />
              </Area>
            </OnlyRenderIfPermissions>
          </>
        )
      }}
    />
  )
}

export default withErrorBoundary(withSignedIn(UserPage))
