"use client"

import { useParams, useRouter } from "next/navigation"
import React, { useEffect } from "react"

import CourseInstancesTab from "../tabs/CourseInstancesTab"

import useCourseInstancesQuery from "@/hooks/useCourseInstancesQuery"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { manageCourseStatsOverviewRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function StatsCourseInstancesPage() {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const router = useRouter()
  const courseInstances = useCourseInstancesQuery(courseId)

  const shouldRedirect = courseInstances.isSuccess && (courseInstances.data?.length ?? 0) <= 1

  useEffect(() => {
    if (shouldRedirect) {
      router.replace(manageCourseStatsOverviewRoute(courseId))
    }
  }, [shouldRedirect, courseId, router])

  if (shouldRedirect) {
    return null
  }

  return <CourseInstancesTab courseId={courseId} />
}

export default withErrorBoundary(withSignedIn(StatsCourseInstancesPage))
