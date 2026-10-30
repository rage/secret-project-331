"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabListProvider } from "@/components/Navigation/RouteTabList/RouteTabListContext"
import { RouteTabPageTitle } from "@/components/Navigation/RouteTabList/RouteTabPageTitle"
import { RouteTabPanel } from "@/components/Navigation/RouteTabList/RouteTabPanel"
import { getAgentChangesetCountsOptions } from "@/generated/api/@tanstack/react-query.generated"
import useCountAnswersRequiringAttentionHook from "@/hooks/count/useCountAnswersRequiringAttentionHook"
import createFeedbackEditProposalCountsHook from "@/hooks/count/useFeedbackEditProposalCounts"
import createFlaggedSuspectedCheaterCountHook from "@/hooks/count/useFlaggedSuspectedCheaterCount"
import createOpenAgentChangeCountHook from "@/hooks/count/useOpenAgentChangeCount"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"
import {
  courseStatsRoute,
  manageCourseAgentChangesetsRoute,
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
const KEY_FEEDBACK_CHANGE_REQUESTS = "feedback-change-requests"
const KEY_EXERCISES = "exercises"
const KEY_COURSE_INSTANCES = "course-instances"
const KEY_STUDENTS = "students"
const KEY_LANGUAGE_VERSIONS = "language-versions"
const KEY_PERMISSIONS = "permissions"
const KEY_STATS = "stats"
const KEY_OTHER = "other"
const KEY_AGENT_CHANGESETS = "agent-changesets"

export default function CourseManagementLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()

  const permissionsQuery = useAuthorizeMultiple([
    { action: { type: "administrate" }, resource: { type: "global_permissions" } },
    { action: { type: "teach" }, resource: { type: "course", id: courseId } },
    { action: { type: "edit" }, resource: { type: "course", id: courseId } },
  ])
  const [isGlobalAdmin = false, canTeach = false, canEdit = false] = permissionsQuery.data ?? []
  const canViewStudents = isGlobalAdmin || canTeach

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

  // oxlint-disable-next-line i18next/no-literal-string
  const feedbackCountHook = createFeedbackEditProposalCountsHook(courseId, "both")
  const answersCountHook = useCountAnswersRequiringAttentionHook(courseId)
  const flaggedCheaterCountHook = createFlaggedSuspectedCheaterCountHook(courseId)
  const openAgentChangeCountHook = createOpenAgentChangeCountHook(courseId)
  // Only teachers whose AI agent has staged changes in the course get the tab.
  const { data: hasAgentChangesets = false } = useQuery({
    ...getAgentChangesetCountsOptions({ query: { course_id: courseId } }),
    select: (counts) => counts.has_changesets,
    enabled: canEdit,
  })

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
        key: KEY_FEEDBACK_CHANGE_REQUESTS,
        title: t("link-feedback"),
        href: manageCourseFeedbackRoute(courseId),
        countHook: feedbackCountHook,
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
    if (canViewStudents) {
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
        pathPrefix: courseStatsRoute(courseId),
      },
      {
        key: KEY_OTHER,
        title: t("title-other"),
        href: manageCourseOtherReferencesRoute(courseId),
        // oxlint-disable-next-line i18next/no-literal-string
        pathPrefix: `/manage/courses/${courseId}/other`,
        countHook: flaggedCheaterCountHook,
      },
    )
    if (hasAgentChangesets) {
      base.push({
        key: KEY_AGENT_CHANGESETS,
        title: t("link-agent-changes"),
        href: manageCourseAgentChangesetsRoute(courseId),
        countHook: openAgentChangeCountHook,
      })
    }
    return base
  }, [
    courseId,
    t,
    canViewStudents,
    feedbackCountHook,
    answersCountHook,
    flaggedCheaterCountHook,
    hasAgentChangesets,
    openAgentChangeCountHook,
  ])

  return (
    <RouteTabListProvider tabs={tabs}>
      <RouteTabPageTitle
        tabs={tabs}
        entityName={courseBreadcrumbInfo.data?.course_name}
        order={10}
      />
      <RouteTabList tabs={tabs} />
      <RouteTabPanel>{children}</RouteTabPanel>
    </RouteTabListProvider>
  )
}
