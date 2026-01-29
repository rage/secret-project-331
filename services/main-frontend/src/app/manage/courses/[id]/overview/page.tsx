"use client"

import { useParams } from "next/navigation"
import React from "react"

import CourseOverview from "@/components/page-specific/manage/courses/id/index/CourseOverview"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function OverviewPage() {
  const params = useParams<{ id: string }>()
  return <CourseOverview courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(OverviewPage))
