"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import CourseAuditContainer from "./CourseAuditContainer"

import { getCoursesForAuditingOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { QueryResult } from "@/shared-module/components"

const CourseAuditing = () => {
  const { t } = useTranslation()

  const getCoursesForAuditing = useQuery(getCoursesForAuditingOptions())

  const sortedCoursesForAuditing = useMemo(
    () => [...(getCoursesForAuditing.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [getCoursesForAuditing.data],
  )

  const renderCourseAuditing = () => (
    <>
      <CourseAuditContainer
        coursesForAuditing={sortedCoursesForAuditing}
        refetch={getCoursesForAuditing.refetch}
      />
    </>
  )
  return (
    <div>
      <h1>{t("title-course-auditing")}</h1>
      <QueryResult query={getCoursesForAuditing} treatEmptyAsData>
        {() => renderCourseAuditing()}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSuspenseBoundary(withSignedIn(CourseAuditing)))
