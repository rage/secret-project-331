"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, usePathname } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import { getCourseDesignerPlanOptions } from "@/generated/api/@tanstack/react-query.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import {
  manageCoursePlanRoute,
  manageCoursePlanScheduleRoute,
  manageCoursePlanWorkspaceRoute,
} from "@/shared-module/common/utils/routes"

/** Registers the breadcrumb for an individual course plan, using its name once loaded. */
export default function CoursePlanLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const pathname = usePathname()
  const planId = params.id ?? ""

  const planQuery = useQuery({
    ...getCourseDesignerPlanOptions({ path: { plan_id: planId } }),
    enabled: planId !== "",
  })

  const planName = planQuery.data?.plan.name ?? null

  usePageTitle(planName)

  const planHref = useMemo(() => {
    if (pathname.includes("/permissions") || pathname.includes("/workspace")) {
      return manageCoursePlanWorkspaceRoute(planId)
    }
    if (pathname.includes("/schedule")) {
      return manageCoursePlanScheduleRoute(planId)
    }
    return manageCoursePlanRoute(planId)
  }, [pathname, planId])

  const crumbs = useMemo(() => {
    if (planQuery.isPending) {
      return [{ isLoading: true as const }]
    }
    return [
      {
        isLoading: false as const,
        label: planName ?? t("course-plans-untitled-plan"),
        href: planHref,
      },
    ]
  }, [planQuery.isPending, planName, planHref, t])

  useRegisterBreadcrumbs({
    key: `course-plan:${planId}`,
    order: 20,
    crumbs,
    disabled: planId === "",
  })

  return <>{children}</>
}
