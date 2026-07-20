"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import { manageCourseOtherCheatersSuspectedRoute } from "@/shared-module/common/utils/routes"

export default function CheatersIndexPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  useEffect(() => {
    router.replace(manageCourseOtherCheatersSuspectedRoute(params.id))
  }, [params.id, router])
  return null
}
