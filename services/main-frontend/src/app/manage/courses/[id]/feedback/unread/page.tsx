"use client"

import { useParams } from "next/navigation"

import FeedbackList from "../FeedbackList"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function FeedbackUnreadPage() {
  const params = useParams<{ id: string }>()
  return <FeedbackList courseId={params.id} read={false} />
}

export default withErrorBoundary(withSignedIn(FeedbackUnreadPage))
