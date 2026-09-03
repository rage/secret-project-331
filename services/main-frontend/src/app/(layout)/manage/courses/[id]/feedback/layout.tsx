"use client"

import { css } from "@emotion/css"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabPageTitle } from "@/components/Navigation/RouteTabList/RouteTabPageTitle"
import createPendingChangeRequestCountHook from "@/hooks/count/usePendingChangeRequestCount"
import createUnreadFeedbackCountHook from "@/hooks/count/useUnreadFeedbackCount"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import {
  manageCourseChangeRequestsRoute,
  manageCourseFeedbackFeedbackRoute,
  manageCourseFeedbackChangeRequestsRoute,
} from "@/shared-module/common/utils/routes"

const KEY_CHANGE_REQUESTS = "change-requests"
const KEY_FEEDBACK = "feedback"

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()
  const feedbackCountHook = createUnreadFeedbackCountHook(courseId)
  const changeRequestCountHook = createPendingChangeRequestCountHook(courseId)
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
        key: KEY_FEEDBACK,
        title: t("link-feedback"),
        href: manageCourseFeedbackFeedbackRoute(courseId),
        countHook: feedbackCountHook,
      },
      {
        key: KEY_CHANGE_REQUESTS,
        title: t("link-change-requests"),
        href: manageCourseFeedbackChangeRequestsRoute(courseId),
        countHook: changeRequestCountHook,
      },
    ]
  }, [courseId, t, feedbackCountHook, changeRequestCountHook])

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
