"use client"

import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import CheatersThresholdConfig from "./CheatersThresholdConfig"

import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import {
  manageCourseOtherCheatersArchivedRoute,
  manageCourseOtherCheatersSuspectedRoute,
} from "@/shared-module/common/utils/routes"

const KEY_SUSPECTED = "suspected"
const KEY_ARCHIVED = "archived"

export default function CheatersLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()

  const tabs = useMemo((): RouteTabDefinition[] => {
    return [
      {
        key: KEY_SUSPECTED,
        title: t("suspected-students"),
        href: manageCourseOtherCheatersSuspectedRoute(courseId),
      },
      {
        key: KEY_ARCHIVED,
        title: t("archived"),
        href: manageCourseOtherCheatersArchivedRoute(courseId),
      },
    ]
  }, [courseId, t])

  return (
    <>
      <CheatersThresholdConfig courseId={courseId} />
      <RouteTabList tabs={tabs} />
      {children}
    </>
  )
}
