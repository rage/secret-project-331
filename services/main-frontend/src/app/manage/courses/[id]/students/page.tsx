"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import { manageCourseStudentsRoute } from "@/shared-module/common/utils/routes"

const STUDENTS_SUBTAB_USERS = "users"

export default function StudentsIndexPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  useEffect(() => {
    router.replace(manageCourseStudentsRoute(params.id, STUDENTS_SUBTAB_USERS))
  }, [params.id, router])
  return null
}
