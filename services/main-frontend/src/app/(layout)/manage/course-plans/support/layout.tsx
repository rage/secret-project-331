"use client"

import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"

/** Registers the MOOC support breadcrumb. */
export default function CoursePlansSupportLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const crumbs = useMemo(
    () => [{ isLoading: false as const, label: t("course-plans-support-title") }],
    [t],
  )

  useRegisterBreadcrumbs({ key: "course-plans:support", order: 20, crumbs })

  return children
}
