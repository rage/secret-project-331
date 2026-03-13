"use client"

import { useParams } from "next/navigation"

import CoursePermissions from "./CoursePermissions"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function PermissionsPage() {
  const params = useParams<{ id: string }>()
  return <CoursePermissions courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(PermissionsPage))
