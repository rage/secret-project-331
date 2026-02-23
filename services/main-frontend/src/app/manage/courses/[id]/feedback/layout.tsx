"use client"

import { css } from "@emotion/css"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import createUnreadFeedbackCountHook from "@/hooks/count/useUnreadFeedbackCount"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import {
  manageCourseFeedbackReadRoute,
  manageCourseFeedbackRoute,
  manageCourseFeedbackUnreadRoute,
} from "@/shared-module/common/utils/routes"

const KEY_UNREAD = "unread"
const KEY_READ = "read"

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()
  const unreadCountHook = createUnreadFeedbackCountHook(courseId)

  const crumbs = useMemo(
    () => [
      {
        isLoading: false as const,
        label: t("title-feedback"),
        href: manageCourseFeedbackRoute(courseId),
      },
    ],
    [courseId, t],
  )

  useRegisterBreadcrumbs({ key: `course:${courseId}:feedback`, order: 30, crumbs })

  const tabs = useMemo((): RouteTabDefinition[] => {
    return [
      {
        key: KEY_UNREAD,
        title: t("unread"),
        href: manageCourseFeedbackUnreadRoute(courseId),
        countHook: unreadCountHook,
      },
      {
        key: KEY_READ,
        title: t("read"),
        href: manageCourseFeedbackReadRoute(courseId),
      },
    ]
  }, [courseId, t, unreadCountHook])

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
        {t("title-feedback")}
      </h3>
      <RouteTabList tabs={tabs} />
      {children}
    </>
  )
}
