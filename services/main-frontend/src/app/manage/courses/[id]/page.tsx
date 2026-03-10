"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import { manageCourseOverviewRoute } from "@/shared-module/common/utils/routes"

export default function CourseManagementIndexPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  useEffect(() => {
    router.replace(manageCourseOverviewRoute(params.id))
  }, [params.id, router])
  return null
}
