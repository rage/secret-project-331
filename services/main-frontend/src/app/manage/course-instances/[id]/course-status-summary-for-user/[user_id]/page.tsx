"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import React, { useEffect } from "react"

import { fetchCourseInstance } from "@/services/backend/course-instances"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { courseUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const CourseInstanceStatusSummaryRedirect: React.FC = () => {
  const router = useRouter()
  const { id: courseInstanceId, user_id } = useParams<{ id: string; user_id: string }>()
  const courseInstanceQuery = useQuery({
    queryKey: ["course-instance", courseInstanceId],
    queryFn: () => fetchCourseInstance(courseInstanceId),
    enabled: !!courseInstanceId,
  })

  useEffect(() => {
    if (courseInstanceQuery.data?.course_id && user_id) {
      router.replace(courseUserStatusSummaryRoute(courseInstanceQuery.data.course_id, user_id))
    }
  }, [courseInstanceQuery.data?.course_id, user_id, router])

  if (courseInstanceQuery.isError) {
    return <ErrorBanner variant="readOnly" error={courseInstanceQuery.error} />
  }
  if (courseInstanceQuery.isLoading || !courseInstanceQuery.data) {
    return <Spinner variant="medium" />
  }
  return <Spinner variant="medium" />
}

export default withErrorBoundary(withSignedIn(CourseInstanceStatusSummaryRedirect))
