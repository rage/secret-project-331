"use client"

import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import { manageCoursePlansListRoute } from "@/shared-module/common/utils/routes"

const BREADCRUMB_KEY_COURSE_PLANS = "course-plans:list"

/** Registers the "Course Plans" breadcrumb for any page under /manage/course-plans. */
export default function CoursePlansLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()

  const crumbs = useMemo(
    () => [
      {
        isLoading: false as const,
        label: t("course-plans-title"),
        href: manageCoursePlansListRoute(),
      },
    ],
    [t],
  )

  useRegisterBreadcrumbs({ key: BREADCRUMB_KEY_COURSE_PLANS, order: 10, crumbs })

  return children
}
