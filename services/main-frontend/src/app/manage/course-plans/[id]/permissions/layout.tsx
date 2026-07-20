"use client"

import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"

/** Registers the permissions breadcrumb for a course plan. */
export default function CoursePlanPermissionsLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const planId = params.id ?? ""

  const crumbs = useMemo(
    () => [{ isLoading: false as const, label: t("course-plan-permissions-title") }],
    [t],
  )

  useRegisterBreadcrumbs({
    key: `course-plan:${planId}:permissions`,
    order: 30,
    crumbs,
    disabled: planId === "",
  })

  return children
}
