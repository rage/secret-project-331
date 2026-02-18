"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import CourseEnrollmentsList from "./CourseEnrollmentsList"
import ExerciseResetLogList from "./ExerciseResetLogList"

import { useUserDetails } from "@/hooks/useUserDetails"
import { getCourseEnrollmentsInfo } from "@/services/backend/users"
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

  const courseEnrollmentsQuery = useQuery({
    queryKey: ["course-enrollments", id],
    queryFn: () => getCourseEnrollmentsInfo(id),
  })

  const courseIds = courseEnrollmentsQuery.data?.course_enrollments.map((e) => e.course_id) ?? []

  const userDetailsQuery = useUserDetails(courseIds, id)

  if (courseEnrollmentsQuery.isError) {
    return <ErrorBanner error={courseEnrollmentsQuery.error} variant="readOnly" />
  }
  if (courseEnrollmentsQuery.isLoading) {
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
        <h2>{t("header-course-enrollments")}</h2>
        <CourseEnrollmentsList userId={id} />
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
