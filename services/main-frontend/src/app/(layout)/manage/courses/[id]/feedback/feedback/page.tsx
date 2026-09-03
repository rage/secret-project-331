"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { manageCourseFeedbackFeedbackRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

/*
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabPageTitle } from "@/components/Navigation/RouteTabList/RouteTabPageTitle"
import createUnreadFeedbackCountHook from "@/hooks/count/useUnreadFeedbackCount"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import {
  manageCourseFeedbackFeedbackRoute,
  manageCourseFeedbackReadRoute,
  manageCourseFeedbackRoute,
  manageCourseFeedbackUnreadRoute,
} from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import FeedbackList from "../FeedbackList"

const KEY_UNREAD = "unread"
const KEY_READ = "read"

function FeedbackPage() {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()
  const unreadCountHook = createUnreadFeedbackCountHook(courseId)
  const courseBreadcrumbInfo = useCourseBreadcrumbInfoQuery(courseId)

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
        href: manageCourseFeedbackFeedbackRoute(courseId, "unread"),
        countHook: unreadCountHook,
      },
      {
        key: KEY_READ,
        title: t("read"),
        href: manageCourseFeedbackFeedbackRoute(courseId, "read"),
      },
    ]
  }, [courseId, t, unreadCountHook])
  return <FeedbackList courseId={params.id} read={true} />
}

export default withErrorBoundary(withSignedIn(FeedbackPage))
 */

function FeedbackPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  useEffect(() => {
    // oxlint-disable-next-line i18next/no-literal-string
    router.replace(manageCourseFeedbackFeedbackRoute(params.id, "unread"))
  }, [params.id, router])
  return null
}

export default withErrorBoundary(withSignedIn(FeedbackPage))
