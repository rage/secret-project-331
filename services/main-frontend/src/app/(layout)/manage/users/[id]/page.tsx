"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import { headingCss, sectionCss, sectionsCss } from "@/components/credit-registration/styles"
import { getUserCourseEnrollmentsOptions } from "@/generated/api/@tanstack/react-query.generated"
import {
  extractUserDetail,
  formatUserName,
  isUserDetailsNotFound,
  useUserDetails,
} from "@/hooks/useUserDetails"
import DataLoadError from "@/shared-module/common/components/DataLoadError"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { searchUsersRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResults } from "@/shared-module/components"

import ActivityTimeline from "./components/ActivityTimeline"
import CompletionReviewBanner from "./components/CompletionReviewBanner"
import CompletionReviewSection from "./components/CompletionReviewSection"
import CourseEnrollmentsSection from "./components/CourseEnrollmentsSection"
import ExerciseResetLogSection from "./components/ExerciseResetLogSection"
import UserIdentityHeader from "./components/UserIdentityHeader"
import UserStatBar from "./components/UserStatBar"

const COMPLETION_REVIEW_ID = "completion-review"

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
  const userDisplayName = formatUserName(userDetail)
  usePageTitle(userDisplayName || t("header-user-details"))

  const crumbs = useMemo(
    () => [
      { isLoading: false as const, label: t("users"), href: searchUsersRoute() },
      { isLoading: false as const, label: userDisplayName || t("header-user-details") },
    ],
    [t, userDisplayName],
  )
  useRegisterBreadcrumbs({ key: `user:${id}`, order: 20, crumbs })

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
          <div className={sectionsCss}>
            <UserIdentityHeader
              userId={id}
              userDetails={userDetails}
              userDetailsNotFound={userDetailsNotFound}
            />
            <CompletionReviewBanner enrollments={enrollments} targetId={COMPLETION_REVIEW_ID} />
            <UserStatBar enrollments={enrollments} reviewTargetId={COMPLETION_REVIEW_ID} />
            {enrollments.length > 0 ? (
              <section className={sectionCss}>
                <h2 className={headingCss}>{t("user-activity")}</h2>
                <ActivityTimeline enrollments={enrollments} />
              </section>
            ) : null}
            <CompletionReviewSection
              userId={id}
              enrollments={enrollments}
              id={COMPLETION_REVIEW_ID}
            />
            <section className={sectionCss}>
              <h2 className={headingCss}>{t("header-course-enrollments")}</h2>
              <CourseEnrollmentsSection enrollments={enrollments} userId={id} />
            </section>
            <OnlyRenderIfPermissions
              action={{ type: "teach" }}
              resource={{ type: "global_permissions" }}
            >
              <section className={sectionCss}>
                <ExerciseResetLogSection userId={id} />
              </section>
            </OnlyRenderIfPermissions>
          </div>
        )
      }}
    />
  )
}

export default withErrorBoundary(withSignedIn(UserPage))
