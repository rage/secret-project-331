"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import CourseInstanceEnrollmentsList from "./CourseInstanceEnrollmentsList"
import ExerciseResetLogList from "./ExerciseResetLogList"

import { useUserDetails } from "@/hooks/useUserDetails"
import { getCourseInstanceEnrollmentsInfo } from "@/services/backend/users"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const Area = styled.div`
  margin: 2rem 0;
`

const UserPage: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()

  // Get course enrollments to find course contexts for user details
  const courseInstanceEnrollmentsQuery = useQuery({
    queryKey: ["course-instance-enrollments", id],
    queryFn: () => getCourseInstanceEnrollmentsInfo(id),
  })

  // Get all course IDs from enrollments to use for user details
  const courseIds =
    courseInstanceEnrollmentsQuery.data?.course_instance_enrollments.map(
      (enrollment) => enrollment.course_id,
    ) ?? []

  const userDetailsQuery = useUserDetails(courseIds, id)

  if (courseInstanceEnrollmentsQuery.isError) {
    return <ErrorBanner error={courseInstanceEnrollmentsQuery.error} variant="readOnly" />
  }
  if (courseInstanceEnrollmentsQuery.isLoading) {
    return <Spinner variant="medium" />
  }

  if (userDetailsQuery.isError) {
    return <ErrorBanner error={userDetailsQuery.error} variant="readOnly" />
  }
  if (userDetailsQuery.isLoading || !userDetailsQuery.data) {
    return <Spinner variant="medium" />
  }

  return (
    <>
      <Area>
        <h1>{t("header-user-details")}</h1>
        <p>
          {t("label-user-id")}: {id}
        </p>
        <p>
          {t("label-email")}: {userDetailsQuery.data.email}
        </p>
        <p>
          {t("first-name")}: {userDetailsQuery.data.first_name}
        </p>
        <p>
          {t("last-name")}: {userDetailsQuery.data.last_name}
        </p>
      </Area>
      <Area>
        <h2>{t("header-course-instance-enrollments")}</h2>
        <CourseInstanceEnrollmentsList userId={id} />
      </Area>
      <OnlyRenderIfPermissions action={{ type: "teach" }} resource={{ type: "global_permissions" }}>
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
}

export default withErrorBoundary(withSignedIn(UserPage))
