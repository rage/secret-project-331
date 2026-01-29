"use client"

import { useParams } from "next/navigation"
import React from "react"

import CoursePermissions from "@/components/page-specific/manage/courses/id/permissions/CoursePermissions"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function PermissionsPage() {
  const params = useParams<{ id: string }>()
  return <CoursePermissions courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(PermissionsPage))
