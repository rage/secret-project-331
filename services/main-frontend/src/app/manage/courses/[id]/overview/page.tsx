"use client"

import { useParams } from "next/navigation"

import CourseOverview from "./CourseOverview"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function OverviewPage() {
  const params = useParams<{ id: string }>()
  return <CourseOverview courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(OverviewPage))
