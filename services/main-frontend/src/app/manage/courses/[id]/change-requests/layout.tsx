"use client"

import { css } from "@emotion/css"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import createPendingChangeRequestCountHook from "@/hooks/count/usePendingChangeRequestCount"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import {
  manageCourseChangeRequestsOldRoute,
  manageCourseChangeRequestsPendingRoute,
} from "@/shared-module/common/utils/routes"

const KEY_PENDING = "pending"
const KEY_OLD = "old"

export default function ChangeRequestsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()
  const pendingCountHook = createPendingChangeRequestCountHook(courseId)

  const tabs = useMemo((): RouteTabDefinition[] => {
    return [
      {
        key: KEY_PENDING,
        title: t("pending"),
        href: manageCourseChangeRequestsPendingRoute(courseId),
        countHook: pendingCountHook,
      },
      {
        key: KEY_OLD,
        title: t("old"),
        href: manageCourseChangeRequestsOldRoute(courseId),
      },
    ]
  }, [courseId, t, pendingCountHook])

  return (
    <>
      <h3
        className={css`
          font-size: clamp(2rem, 3.6vh, 36px);
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("title-change-requests")}
      </h3>
      <RouteTabList tabs={tabs} />
      {children}
    </>
  )
}
