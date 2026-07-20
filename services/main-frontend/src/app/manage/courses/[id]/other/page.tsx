"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import { manageCourseOtherReferencesRoute } from "@/shared-module/common/utils/routes"

export default function OtherIndexPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  useEffect(() => {
    router.replace(manageCourseOtherReferencesRoute(params.id))
  }, [params.id, router])
  return null
}
