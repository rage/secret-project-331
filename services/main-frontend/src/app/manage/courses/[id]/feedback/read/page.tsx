"use client"

import { useParams } from "next/navigation"
import React from "react"

import FeedbackList from "@/components/page-specific/manage/courses/id/feedback/FeedbackList"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function FeedbackReadPage() {
  const params = useParams<{ id: string }>()
  return <FeedbackList courseId={params.id} read={true} />
}

export default withErrorBoundary(withSignedIn(FeedbackReadPage))
