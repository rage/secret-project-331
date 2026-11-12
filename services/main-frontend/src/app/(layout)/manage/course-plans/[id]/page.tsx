"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { pageTitleCss } from "@/components/credit-registration/styles"
import { getCourseDesignerPlanOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import {
  manageCoursePlanScheduleRoute,
  manageCoursePlanWorkspaceRoute,
} from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Link, QueryResult } from "@/shared-module/components"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

/**
 * Redirects to the schedule wizard or the workspace based on plan status. Archived plans stay
 * here; the layout shows the archived notice and this page links to the workspace.
 */
function CoursePlanHubRedirect() {
  const { t } = useTranslation()
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
    if (plan.status === "InProgress" || plan.status === "Completed") {
      router.replace(manageCoursePlanWorkspaceRoute(planId))
    }
  }, [planQuery.data, planId, router])

  return (
    <QueryResult query={planQuery}>
      {({ plan, stages }) =>
        plan.status === "Archived" ? (
          <>
            <h1 className={pageTitleCss}>{plan.name ?? t("course-plans-untitled-plan")}</h1>
            {stages.length > 0 && (
              <Link href={manageCoursePlanWorkspaceRoute(planId)}>
                {t("course-plans-open-archived-plan")}
              </Link>
            )}
          </>
        ) : null
      }
    </QueryResult>
  )
}

export default withErrorBoundary(withSignedIn(CoursePlanHubRedirect))
