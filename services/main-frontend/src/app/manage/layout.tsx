"use client"

import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import BreadcrumbRenderer from "@/components/breadcrumbs/BreadcrumbRenderer"
import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"

const BREADCRUMB_KEY_MANAGE_HOME = "manage:home"

function ManageLayoutContent({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const crumbs = useMemo(() => [{ isLoading: false as const, label: t("home"), href: "/" }], [t])

  useRegisterBreadcrumbs({
    key: BREADCRUMB_KEY_MANAGE_HOME,
    order: 0,
    crumbs,
  })

  return <>{children}</>
}

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbRenderer />
      <ManageLayoutContent>{children}</ManageLayoutContent>
    </>
  )
}
