"use client"

import { useParams } from "next/navigation"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import CourseOverview from "./CourseOverview"

function OverviewPage() {
  const params = useParams<{ id: string }>()
  return <CourseOverview courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(OverviewPage))
