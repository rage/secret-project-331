"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import CourseAuditingContainer from "./CourseAuditingContainer"

import { getCoursesForAuditingOptions } from "@/generated/api/@tanstack/react-query.generated"
import { showErrorNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { QueryResult } from "@/shared-module/components"

// TODO: can save and prepare for backend ??

const CourseAuditing = () => {
  const { t } = useTranslation()
  const getCoursesForAuditing = useQuery(getCoursesForAuditingOptions())

  const sortedCoursesForAuditing = useMemo(
    () => [...(getCoursesForAuditing.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [getCoursesForAuditing.data],
  )

  return (
    <div>
      <h1>{t("title-course-auditing")}</h1>
      <QueryResult query={getCoursesForAuditing} treatEmptyAsData>
        {() => (
          <CourseAuditingContainer
            coursesForAuditing={sortedCoursesForAuditing}
            refetch={getCoursesForAuditing.refetch}
          />
        )}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSuspenseBoundary(withSignedIn(CourseAuditing)))
