"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import { fetchOrganization } from "@/services/backend/organizations"
import { organizationFrontPageRoute } from "@/shared-module/common/utils/routes"

export default function OrganizationLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()

  const orgQuery = useQuery({
    queryKey: ["organization", id],
    queryFn: () => fetchOrganization(id),
  })

  const crumbs = useMemo(
    () => [
      orgQuery.data?.name
        ? {
            isLoading: false as const,
            label: orgQuery.data.name,
            href: organizationFrontPageRoute(orgQuery.data?.slug ?? ""),
          }
        : { isLoading: true as const },
      orgQuery.data?.name
        ? {
            isLoading: false as const,
            label: t("manage"),
            href: `/manage/organizations/${id}`,
          }
        : { isLoading: true as const },
    ],
    [orgQuery.data?.slug, orgQuery.data?.name, id, t],
  )

  useRegisterBreadcrumbs({ key: `organization:${id}`, order: 20, crumbs })

  return <>{children}</>
}
