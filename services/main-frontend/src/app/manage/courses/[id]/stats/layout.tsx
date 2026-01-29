"use client"

import { css } from "@emotion/css"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import useCourseInstancesQuery from "@/hooks/useCourseInstancesQuery"
import useCourseLanguageVersions from "@/hooks/useCourseLanguageVersions"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import {
  manageCourseStatsAllLanguagesRoute,
  manageCourseStatsCountryStatsRoute,
  manageCourseStatsCourseInstancesRoute,
  manageCourseStatsOverviewRoute,
  manageCourseStatsUserActivityRoute,
  manageCourseStatsVisitorsRoute,
} from "@/shared-module/common/utils/routes"

const KEY_OVERVIEW = "overview"
const KEY_USER_ACTIVITY = "user-activity"
const KEY_VISITORS = "visitors"
const KEY_ALL_LANGUAGES = "all-languages"
const KEY_COUNTRY_STATS = "country-stats"
const KEY_COURSE_INSTANCES = "course-instances"

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()

  const courseLanguageVersions = useCourseLanguageVersions(courseId)
  const courseInstances = useCourseInstancesQuery(courseId)

  const showLanguageVersionsTab = useMemo(
    () => courseLanguageVersions.isSuccess && (courseLanguageVersions.data?.length ?? 0) > 1,
    [courseLanguageVersions.isSuccess, courseLanguageVersions.data],
  )

  const showCourseInstancesTab = useMemo(
    () => courseInstances.isSuccess && (courseInstances.data?.length ?? 0) > 1,
    [courseInstances.isSuccess, courseInstances.data],
  )

  const tabs = useMemo((): RouteTabDefinition[] => {
    const base: RouteTabDefinition[] = [
      {
        key: KEY_OVERVIEW,
        title: t("stats-tab-overview"),
        href: manageCourseStatsOverviewRoute(courseId),
      },
      {
        key: KEY_USER_ACTIVITY,
        title: t("stats-tab-user-activity"),
        href: manageCourseStatsUserActivityRoute(courseId),
      },
      {
        key: KEY_VISITORS,
        title: t("stats-tab-visitors"),
        href: manageCourseStatsVisitorsRoute(courseId),
      },
    ]
    if (showLanguageVersionsTab) {
      base.push({
        key: KEY_ALL_LANGUAGES,
        title: t("stats-tab-all-languages"),
        href: manageCourseStatsAllLanguagesRoute(courseId),
      })
    }
    base.push({
      key: KEY_COUNTRY_STATS,
      title: t("stats-tab-country"),
      href: manageCourseStatsCountryStatsRoute(courseId),
    })
    if (showCourseInstancesTab) {
      base.push({
        key: KEY_COURSE_INSTANCES,
        title: t("stats-tab-course-instances"),
        href: manageCourseStatsCourseInstancesRoute(courseId),
      })
    }
    return base
  }, [courseId, t, showLanguageVersionsTab, showCourseInstancesTab])

  return (
    <>
      <h1
        className={css`
          font-size: clamp(2rem, 3.6vh, 36px);
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("title-statistics")}
      </h1>
      <RouteTabList tabs={tabs} />
      {children}
    </>
  )
}
