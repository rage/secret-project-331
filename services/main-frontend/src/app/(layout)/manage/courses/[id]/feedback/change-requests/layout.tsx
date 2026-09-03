"use client"

import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabPageTitle } from "@/components/Navigation/RouteTabList/RouteTabPageTitle"
import createPendingChangeRequestCountHook from "@/hooks/count/usePendingChangeRequestCount"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import {
  manageCourseChangeRequestsRoute,
  manageCourseFeedbackChangeRequestsRoute,
} from "@/shared-module/common/utils/routes"

const KEY_PENDING = "pending"
const KEY_OLD = "old"

export default function FeedbackChangeRequestsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()
  const pendingCountHook = createPendingChangeRequestCountHook(courseId)
  const courseBreadcrumbInfo = useCourseBreadcrumbInfoQuery(courseId)

  const crumbs = useMemo(
    () => [
      {
        isLoading: false as const,
        label: t("title-change-requests"),
        href: manageCourseChangeRequestsRoute(courseId),
      },
    ],
    [courseId, t],
  )

  useRegisterBreadcrumbs({ key: `course:${courseId}:change-requests`, order: 30, crumbs })

  const tabs = useMemo((): RouteTabDefinition[] => {
    return [
      {
        key: KEY_PENDING,
        title: t("pending"),
        href: manageCourseFeedbackChangeRequestsRoute(params.id, "pending"),
        countHook: pendingCountHook,
      },
      {
        key: KEY_OLD,
        title: t("old"),
        href: manageCourseFeedbackChangeRequestsRoute(params.id, "old"),
      },
    ]
  }, [courseId, t, pendingCountHook])

  return (
    <>
      <RouteTabPageTitle
        tabs={tabs}
        entityName={courseBreadcrumbInfo.data?.course_name}
        order={20}
      />
      <RouteTabList tabs={tabs} />
      {children}
    </>
  )
}
