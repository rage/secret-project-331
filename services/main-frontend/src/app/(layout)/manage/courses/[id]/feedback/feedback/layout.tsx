"use client"

import { useParams } from "next/navigation"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabPageTitle } from "@/components/Navigation/RouteTabList/RouteTabPageTitle"
import createFeedbackEditProposalCountsHook from "@/hooks/count/useUnreadFeedbackCount"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { manageCourseFeedbackFeedbackRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const KEY_UNREAD = "unread"
const KEY_READ = "read"

function FeedbackFeedbackLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()
  // oxlint-disable-next-line i18next/no-literal-string
  const unreadCountHook = createFeedbackEditProposalCountsHook(courseId, "feedback")
  const courseBreadcrumbInfo = useCourseBreadcrumbInfoQuery(courseId)

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

export default withErrorBoundary(withSignedIn(FeedbackFeedbackLayout))
