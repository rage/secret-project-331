"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import React, { useEffect } from "react"

import { getCourseInstanceOptions } from "@/generated/api/@tanstack/react-query.generated"
import DataLoadError from "@/shared-module/common/components/DataLoadError"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { courseUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { LoadingRegion } from "@/shared-module/components"

const CourseInstanceStatusSummaryRedirect: React.FC = () => {
  const router = useRouter()
  const { id: courseInstanceId, user_id } = useParams<{ id: string; user_id: string }>()
  const courseInstanceQuery = useQuery({
    ...getCourseInstanceOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
  })

  useEffect(() => {
    if (courseInstanceQuery.data?.course_id && user_id) {
      router.replace(courseUserStatusSummaryRoute(courseInstanceQuery.data.course_id, user_id))
    }
  }, [courseInstanceQuery.data?.course_id, user_id, router])

  if (courseInstanceQuery.isError) {
    return <ErrorBanner variant="readOnly" error={courseInstanceQuery.error} />
  }
  if (courseInstanceQuery.isLoading) {
    return <LoadingRegion />
  }
  if (!courseInstanceQuery.data) {
    return (
      <DataLoadError
        onRetry={() => {
          void courseInstanceQuery.refetch()
        }}
      />
    )
  }
  return <LoadingRegion />
}

export default withErrorBoundary(withSignedIn(CourseInstanceStatusSummaryRedirect))
