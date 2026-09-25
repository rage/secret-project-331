"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { manageCourseFeedbackChangeRequestsRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function ChangeRequestsPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  useEffect(() => {
    // oxlint-disable-next-line i18next/no-literal-string
    router.replace(manageCourseFeedbackChangeRequestsRoute(params.id, "pending"))
  }, [params.id, router])
  return null
}

export default withErrorBoundary(withSignedIn(ChangeRequestsPage))
