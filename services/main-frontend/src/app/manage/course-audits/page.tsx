"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import CourseAuditContainer from "./CourseAuditContainer"

import { getCourseAuditsOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { QueryResult } from "@/shared-module/components"

const CourseAudits = () => {
  const { t } = useTranslation()

  const getCourseAudits = useQuery(getCourseAuditsOptions())

  const sortedCourseAudits = useMemo(
    () => [...(getCourseAudits.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [getCourseAudits.data],
  )

  const renderCourseAudits = () => (
    <>
      <CourseAuditContainer courseAudits={sortedCourseAudits} refetch={getCourseAudits.refetch} />
    </>
  )
  return (
    <div>
      <h1>{t("title-course-audits")}</h1>
      <QueryResult query={getCourseAudits} treatEmptyAsData>
        {() => renderCourseAudits()}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSuspenseBoundary(withSignedIn(CourseAudits)))
