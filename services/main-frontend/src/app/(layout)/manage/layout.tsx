"use client"

import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import BreadcrumbRenderer from "@/components/breadcrumbs/BreadcrumbRenderer"
import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"

const BREADCRUMB_KEY_MANAGE_HOME = "manage:home"
const CREDIT_REGISTRATION_PATH = "/manage/credit-registration"

function ManageLayoutContent({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const crumbs = useMemo(() => [{ isLoading: false as const, label: t("home"), href: "/" }], [t])

  useRegisterBreadcrumbs({
    key: BREADCRUMB_KEY_MANAGE_HOME,
    order: 0,
    crumbs,
  })

  return children
}

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Credit registration renders its own, lined up with its wider content.
  const ownsBreadcrumb = pathname?.startsWith(CREDIT_REGISTRATION_PATH) ?? false
  return (
    <>
      {!ownsBreadcrumb && <BreadcrumbRenderer />}
      <ManageLayoutContent>{children}</ManageLayoutContent>
    </>
  )
}
