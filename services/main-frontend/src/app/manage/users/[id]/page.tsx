"use client"

import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import ActivityTimeline from "./components/ActivityTimeline"
import CompletionReviewBanner from "./components/CompletionReviewBanner"
import CompletionReviewSection from "./components/CompletionReviewSection"
import CourseEnrollmentsSection from "./components/CourseEnrollmentsSection"
import ExerciseResetLogSection from "./components/ExerciseResetLogSection"
import UserIdentityHeader from "./components/UserIdentityHeader"
import UserStatBar from "./components/UserStatBar"
import { sectionHeadingCss } from "./lib/sectionHeading"

import { getUserCourseEnrollmentsOptions } from "@/generated/api/@tanstack/react-query.generated"
import { extractUserDetail, isUserDetailsNotFound, useUserDetails } from "@/hooks/useUserDetails"
import DataLoadError from "@/shared-module/common/components/DataLoadError"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResults } from "@/shared-module/components"

const COMPLETION_REVIEW_ID = "completion-review"

const Area = styled.div`
  margin: 1.25rem 0;
`

const UserPage: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()

  const courseEnrollmentsQuery = useQuery({
    ...getUserCourseEnrollmentsOptions({ path: { user_id: id } }),
  })

  const courseIds = courseEnrollmentsQuery.data?.course_enrollments.map((e) => e.course_id) ?? null

  const userDetailsQuery = useUserDetails(courseIds, id)
  const userDetail = userDetailsQuery.data ? extractUserDetail(userDetailsQuery.data) : null
  // Use the user's name (not their email) as the title so no PII lands in document.title or the
  // screen-reader route announcement; fall back to a generic label while details load / are absent.
  const userDisplayName = `${userDetail?.first_name ?? ""} ${userDetail?.last_name ?? ""}`.trim()
  usePageTitle(userDisplayName || t("header-user-details"))

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
      renderData={([enrollmentsResult, userDetailsResult]) => {
        const userDetails = extractUserDetail(userDetailsResult)
        const userDetailsNotFound = isUserDetailsNotFound(userDetailsResult)
        const enrollments = enrollmentsResult.course_enrollments
        return (
          <>
            <UserIdentityHeader
              userId={id}
              userDetails={userDetails}
              userDetailsNotFound={userDetailsNotFound}
            />
            <CompletionReviewBanner enrollments={enrollments} targetId={COMPLETION_REVIEW_ID} />
            <UserStatBar enrollments={enrollments} reviewTargetId={COMPLETION_REVIEW_ID} />
            {enrollments.length > 0 ? (
              <Area>
                <h2 className={sectionHeadingCss}>{t("user-activity")}</h2>
                <ActivityTimeline enrollments={enrollments} />
              </Area>
            ) : null}
            <CompletionReviewSection
              userId={id}
              enrollments={enrollments}
              id={COMPLETION_REVIEW_ID}
            />
            <Area>
              <h2 className={sectionHeadingCss}>{t("header-course-enrollments")}</h2>
              <CourseEnrollmentsSection enrollments={enrollments} userId={id} />
            </Area>
            <OnlyRenderIfPermissions
              action={{ type: "teach" }}
              resource={{ type: "global_permissions" }}
            >
              <Area>
                <ExerciseResetLogSection userId={id} />
              </Area>
            </OnlyRenderIfPermissions>
          </>
        )
      }}
    />
  )
}

export default withErrorBoundary(withSignedIn(UserPage))
