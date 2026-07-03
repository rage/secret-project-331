"use client"

import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import CheatersThresholdConfig from "./CheatersThresholdConfig"

import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabPageTitle } from "@/components/Navigation/RouteTabList/RouteTabPageTitle"
import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import { useCourseQuery } from "@/hooks/useCourseQuery"
import {
  manageCourseOtherCheatersConfirmedRoute,
  manageCourseOtherCheatersDismissedRoute,
  manageCourseOtherCheatersSuspectedRoute,
} from "@/shared-module/common/utils/routes"

const KEY_SUSPECTED = "suspected"
const KEY_CONFIRMED = "confirmed"
const KEY_DISMISSED = "dismissed"

export default function CheatersLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()
  // Reuse the same course query as the parent `other/layout.tsx` (shared React Query cache) instead
  // of fetching the course name again through a different endpoint.
  const courseQuery = useCourseQuery(courseId)

  const crumbs = useMemo(
    () => [
      {
        isLoading: false as const,
        label: t("link-cheaters"),
        href: manageCourseOtherCheatersSuspectedRoute(courseId),
      },
    ],
    [courseId, t],
  )

  useRegisterBreadcrumbs({ key: `course:${courseId}:other:cheaters`, order: 40, crumbs })

  const tabs = useMemo((): RouteTabDefinition[] => {
    return [
      {
        key: KEY_SUSPECTED,
        title: t("suspected-students"),
        href: manageCourseOtherCheatersSuspectedRoute(courseId),
      },
      {
        key: KEY_CONFIRMED,
        title: t("confirmed-cheaters"),
        href: manageCourseOtherCheatersConfirmedRoute(courseId),
      },
      {
        key: KEY_DISMISSED,
        title: t("dismissed"),
        href: manageCourseOtherCheatersDismissedRoute(courseId),
      },
    ]
  }, [courseId, t])

  return (
    <>
      <CheatersThresholdConfig courseId={courseId} />
      <RouteTabPageTitle tabs={tabs} entityName={courseQuery.data?.name} order={21} />
      <RouteTabList tabs={tabs} />
      {children}
    </>
  )
}
