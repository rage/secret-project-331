"use client"

import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabListProvider } from "@/components/Navigation/RouteTabList/RouteTabListContext"
import { RouteTabPanel } from "@/components/Navigation/RouteTabList/RouteTabPanel"
import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import useCountAnswersRequiringAttentionHook from "@/hooks/count/useCountAnswersRequiringAttentionHook"
import createPendingChangeRequestCountHook from "@/hooks/count/usePendingChangeRequestCount"
import createUnreadFeedbackCountHook from "@/hooks/count/useUnreadFeedbackCount"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"
import {
  manageCourseChangeRequestsRoute,
  manageCourseExercisesRoute,
  manageCourseFeedbackRoute,
  manageCourseInstancesRoute,
  manageCourseLanguageVersionsRoute,
  manageCourseModulesRoute,
  manageCourseOtherReferencesRoute,
  manageCourseOverviewRoute,
  manageCoursePagesRoute,
  manageCoursePermissionsRoute,
  manageCourseRoute,
  manageCourseStatsOverviewRoute,
  manageCourseStudentsRoute,
  organizationFrontPageRoute,
} from "@/shared-module/common/utils/routes"

const KEY_OVERVIEW = "overview"
const KEY_PAGES = "pages"
const KEY_MODULES = "modules"
const KEY_FEEDBACK = "feedback"
const KEY_CHANGE_REQUESTS = "change-requests"
const KEY_EXERCISES = "exercises"
const KEY_COURSE_INSTANCES = "course-instances"
const KEY_STUDENTS = "students"
const KEY_LANGUAGE_VERSIONS = "language-versions"
const KEY_PERMISSIONS = "permissions"
const KEY_STATS = "stats"
const KEY_OTHER = "other"

export default function CourseManagementLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()

  const isGlobalAdminQuery = useAuthorizeMultiple([
    { action: { type: "administrate" }, resource: { type: "global_permissions" } },
  ])
  const isGlobalAdmin = (isGlobalAdminQuery.isSuccess && isGlobalAdminQuery.data?.[0]) ?? false

  const courseBreadcrumbInfo = useCourseBreadcrumbInfoQuery(courseId)

  const crumbs = useMemo(
    () => [
      courseBreadcrumbInfo.data?.organization_name
        ? {
            isLoading: false as const,
            label: courseBreadcrumbInfo.data.organization_name,
            href: organizationFrontPageRoute(courseBreadcrumbInfo.data?.organization_slug ?? ""),
          }
        : { isLoading: true as const },
      courseBreadcrumbInfo.data?.course_name
        ? {
            isLoading: false as const,
            label: courseBreadcrumbInfo.data.course_name,
            href: manageCourseRoute(courseId),
          }
        : { isLoading: true as const },
    ],
    [
      courseBreadcrumbInfo.data?.organization_slug,
      courseBreadcrumbInfo.data?.organization_name,
      courseBreadcrumbInfo.data?.course_name,
      courseId,
    ],
  )

  useRegisterBreadcrumbs({ key: `course:${courseId}`, order: 20, crumbs })

  const feedbackCountHook = createUnreadFeedbackCountHook(courseId)
  const changeRequestCountHook = createPendingChangeRequestCountHook(courseId)
  const answersCountHook = useCountAnswersRequiringAttentionHook(courseId)

  const tabs = useMemo((): RouteTabDefinition[] => {
    const base: RouteTabDefinition[] = [
      {
        key: KEY_OVERVIEW,
        title: t("link-overview"),
        href: manageCourseOverviewRoute(courseId),
      },
      {
        key: KEY_PAGES,
        title: t("link-pages"),
        href: manageCoursePagesRoute(courseId),
      },
      {
        key: KEY_MODULES,
        title: t("link-modules"),
        href: manageCourseModulesRoute(courseId),
      },
      {
        key: KEY_FEEDBACK,
        title: t("link-feedback"),
        href: manageCourseFeedbackRoute(courseId),
        countHook: feedbackCountHook,
      },
      {
        key: KEY_CHANGE_REQUESTS,
        title: t("link-change-requests"),
        href: manageCourseChangeRequestsRoute(courseId),
        countHook: changeRequestCountHook,
      },
      {
        key: KEY_EXERCISES,
        title: t("link-exercises"),
        href: manageCourseExercisesRoute(courseId),
        countHook: answersCountHook,
      },
      {
        key: KEY_COURSE_INSTANCES,
        title: t("link-course-instances"),
        href: manageCourseInstancesRoute(courseId),
      },
    ]
    if (isGlobalAdmin) {
      base.push({
        key: KEY_STUDENTS,
        title: t("label-students"),
        href: manageCourseStudentsRoute(courseId, "users"),
        pathPrefix: manageCourseStudentsRoute(courseId),
      })
    }
    base.push(
      {
        key: KEY_LANGUAGE_VERSIONS,
        title: t("link-language-versions"),
        href: manageCourseLanguageVersionsRoute(courseId),
      },
      {
        key: KEY_PERMISSIONS,
        title: t("link-permissions"),
        href: manageCoursePermissionsRoute(courseId),
      },
      {
        key: KEY_STATS,
        title: t("link-stats"),
        href: manageCourseStatsOverviewRoute(courseId),
      },
      {
        key: KEY_OTHER,
        title: t("title-other"),
        href: manageCourseOtherReferencesRoute(courseId),
        // eslint-disable-next-line i18next/no-literal-string
        pathPrefix: `/manage/courses/${courseId}/other`,
      },
    )
    return base
  }, [courseId, t, isGlobalAdmin, feedbackCountHook, changeRequestCountHook, answersCountHook])

  return (
    <RouteTabListProvider tabs={tabs}>
      <RouteTabList tabs={tabs} />
      <RouteTabPanel>{children}</RouteTabPanel>
    </RouteTabListProvider>
  )
}
