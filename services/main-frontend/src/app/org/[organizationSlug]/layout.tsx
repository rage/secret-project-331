"use client"

import { useAtomValue } from "jotai"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import BreadcrumbRenderer from "@/components/breadcrumbs/BreadcrumbRenderer"
import { isCourseMaterialAtom } from "@/components/breadcrumbs/breadcrumbAtoms"
import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import useOrganizationQueryBySlug from "@/hooks/useOrganizationQueryBySlug"

function OrgLayoutContent({
  children,
  isCourseMaterial,
}: {
  children: React.ReactNode
  isCourseMaterial: boolean
}) {
  const { organizationSlug } = useParams<{ organizationSlug: string }>()
  const { t } = useTranslation()
  const organizationQuery = useOrganizationQueryBySlug(organizationSlug ?? null)

  const crumbs = useMemo(
    () => [
      { isLoading: false as const, label: t("home"), href: "/" },
      organizationQuery.data?.name && organizationSlug
        ? {
            isLoading: false as const,
            label: organizationQuery.data.name,
            href: `/org/${organizationSlug}`,
          }
        : { isLoading: true as const },
    ],
    [organizationQuery.data?.name, organizationSlug, t],
  )

  useRegisterBreadcrumbs({
    key: `org:${organizationSlug ?? ""}`,
    order: 10,
    crumbs,
    disabled: isCourseMaterial,
  })

  return <>{children}</>
}

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const isCourseMaterial = useAtomValue(isCourseMaterialAtom)

  return (
    <>
      {!isCourseMaterial && <BreadcrumbRenderer />}
      <OrgLayoutContent isCourseMaterial={isCourseMaterial}>{children}</OrgLayoutContent>
    </>
  )
}
