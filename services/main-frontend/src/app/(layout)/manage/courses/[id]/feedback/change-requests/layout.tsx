"use client"

import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabPageTitle } from "@/components/Navigation/RouteTabList/RouteTabPageTitle"
import createFeedbackEditProposalCountsHook from "@/hooks/count/useUnreadFeedbackCount"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import { manageCourseFeedbackChangeRequestsRoute } from "@/shared-module/common/utils/routes"

const KEY_PENDING = "pending"
const KEY_HANDLED = "handled"

export default function FeedbackChangeRequestsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()
  // oxlint-disable-next-line i18next/no-literal-string
  const pendingCountHook = createFeedbackEditProposalCountsHook(courseId, "change_requests")
  const courseBreadcrumbInfo = useCourseBreadcrumbInfoQuery(courseId)

  const tabs = useMemo((): RouteTabDefinition[] => {
    return [
      {
        key: KEY_PENDING,
        title: t("pending"),
        href: manageCourseFeedbackChangeRequestsRoute(courseId, "pending"),
        countHook: pendingCountHook,
      },
      {
        key: KEY_HANDLED,
        title: t("handled"),
        href: manageCourseFeedbackChangeRequestsRoute(courseId, "handled"),
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
