"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import { getCourseDesignerPlanOptions } from "@/generated/api/@tanstack/react-query.generated"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import {
  manageCoursePlanScheduleRoute,
  manageCoursePlanWorkspaceRoute,
} from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

function CoursePlanHubRedirect() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const planId = params.id

  const planQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: planId,
      isReady: (value): value is string => Boolean(value),
      build: (value) =>
        getCourseDesignerPlanOptions({
          path: {
            plan_id: value,
          },
        }),
    }),
  )

  useEffect(() => {
    if (!planQuery.data) {
      return
    }
    const { plan } = planQuery.data
    if (plan.status === "Draft" || plan.status === "Scheduling") {
      router.replace(manageCoursePlanScheduleRoute(planId))
      return
    }
    if (
      plan.status === "ReadyToStart" ||
      plan.status === "InProgress" ||
      plan.status === "Completed"
    ) {
      router.replace(manageCoursePlanWorkspaceRoute(planId))
    }
  }, [planQuery.data, planId, router])

  if (planQuery.isLoading || planQuery.isError) {
    return <Spinner variant="medium" />
  }
  return <Spinner variant="medium" />
}

export default withErrorBoundary(withSignedIn(CoursePlanHubRedirect))
