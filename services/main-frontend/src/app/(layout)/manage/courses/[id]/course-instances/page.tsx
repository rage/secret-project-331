"use client"

import { useParams } from "next/navigation"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import CourseCourseInstances from "./CourseCourseInstances"

function CourseInstancesPage() {
  const params = useParams<{ id: string }>()
  return <CourseCourseInstances courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(CourseInstancesPage))
