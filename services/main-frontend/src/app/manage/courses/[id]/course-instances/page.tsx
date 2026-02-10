"use client"

import { useParams } from "next/navigation"
import React from "react"

import CourseCourseInstances from "./CourseCourseInstances"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function CourseInstancesPage() {
  const params = useParams<{ id: string }>()
  return <CourseCourseInstances courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(CourseInstancesPage))
