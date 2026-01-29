"use client"

import { useParams, useRouter } from "next/navigation"
import React, { useEffect } from "react"

import ChatbotPage from "./ChatbotPage"

import { useCourseQuery } from "@/hooks/useCourseQuery"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { manageCourseOtherReferencesRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function OtherChatbotPage() {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const router = useRouter()
  const courseQuery = useCourseQuery(courseId)

  const shouldRedirect = courseQuery.isSuccess && courseQuery.data?.can_add_chatbot !== true

  useEffect(() => {
    if (shouldRedirect) {
      router.replace(manageCourseOtherReferencesRoute(courseId))
    }
  }, [shouldRedirect, courseId, router])

  if (shouldRedirect) {
    return null
  }

  return <ChatbotPage courseId={courseId} />
}

export default withErrorBoundary(withSignedIn(OtherChatbotPage))
