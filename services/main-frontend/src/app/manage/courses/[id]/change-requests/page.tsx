"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import { manageCourseChangeRequestsPendingRoute } from "@/shared-module/common/utils/routes"

export default function ChangeRequestsIndexPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  useEffect(() => {
    router.replace(manageCourseChangeRequestsPendingRoute(params.id))
  }, [params.id, router])
  return null
}
