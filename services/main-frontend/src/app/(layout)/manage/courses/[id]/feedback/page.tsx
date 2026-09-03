"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import { manageCourseFeedbackFeedbackRoute } from "@/shared-module/common/utils/routes"

export default function FeedbackIndexPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  useEffect(() => {
    router.replace(manageCourseFeedbackFeedbackRoute(params.id))
  }, [params.id, router])
  return null
}
