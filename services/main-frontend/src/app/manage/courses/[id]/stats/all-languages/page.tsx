"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import AllLanguagesTab from "../tabs/AllLanguagesTab"

import useCourseLanguageVersions from "@/hooks/useCourseLanguageVersions"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { manageCourseStatsOverviewRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function StatsAllLanguagesPage() {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const router = useRouter()
  const courseLanguageVersions = useCourseLanguageVersions(courseId)

  const shouldRedirect =
    courseLanguageVersions.isSuccess && (courseLanguageVersions.data?.length ?? 0) <= 1

  useEffect(() => {
    if (shouldRedirect) {
      router.replace(manageCourseStatsOverviewRoute(courseId))
    }
  }, [shouldRedirect, courseId, router])

  if (shouldRedirect) {
    return null
  }

  return <AllLanguagesTab courseId={courseId} />
}

export default withErrorBoundary(withSignedIn(StatsAllLanguagesPage))
