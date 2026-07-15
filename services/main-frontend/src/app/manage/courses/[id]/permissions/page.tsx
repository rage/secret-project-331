"use client"

import { useParams } from "next/navigation"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import CoursePermissions from "./CoursePermissions"

function PermissionsPage() {
  const params = useParams<{ id: string }>()
  return <CoursePermissions courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(PermissionsPage))
