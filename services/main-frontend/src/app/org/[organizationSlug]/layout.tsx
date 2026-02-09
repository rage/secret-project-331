"use client"

import { useParams } from "next/navigation"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import BreadcrumbRenderer from "@/components/breadcrumbs/BreadcrumbRenderer"
import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import useOrganizationQueryBySlug from "@/hooks/useOrganizationQueryBySlug"

function OrgLayoutContent({ children }: { children: React.ReactNode }) {
  const { organizationSlug } = useParams<{ organizationSlug: string }>()
  const { t } = useTranslation()
  const organizationQuery = useOrganizationQueryBySlug(organizationSlug ?? null)

  const crumbs = useMemo(
    () => [
      { isLoading: false as const, label: t("home"), href: "/" },
      organizationQuery.data?.name
        ? {
            isLoading: false as const,
            label: organizationQuery.data.name,
          }
        : { isLoading: true as const },
    ],
    [organizationQuery.data?.name, t],
  )

  useRegisterBreadcrumbs({
    key: `org:${organizationSlug ?? ""}`,
    order: 10,
    crumbs,
  })

  return <>{children}</>
}

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbRenderer />
      <OrgLayoutContent>{children}</OrgLayoutContent>
    </>
  )
}
