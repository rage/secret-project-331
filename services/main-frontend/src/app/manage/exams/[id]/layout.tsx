"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useMemo } from "react"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import {
  getExamOptions,
  getOrganizationExamByExamIdOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { getOrganization } from "@/generated/api/sdk.generated"
// TODO: Replace 3-query waterfall with a single fetchExamBreadcrumbInfo (exam + org) endpoint.
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { organizationFrontPageRoute } from "@/shared-module/common/utils/routes"

export default function ExamLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>()

  const examQuery = useQuery({
    ...getExamOptions({
      path: {
        id,
      },
    }),
  })
  const orgExamQuery = useQuery({
    ...getOrganizationExamByExamIdOptions({
      path: {
        exam_id: id,
      },
    }),
  })
  const organizationId = orgExamQuery.data?.organization_id
  const orgQuery = useQuery({
    queryKey: [{ _id: "getOrganization", path: { organization_id: organizationId } }] as const,
    // oxlint-disable-next-line require-await -- kept async so the assertNotNullOrUndefined throw surfaces as a query rejection
    queryFn: async () =>
      getOrganization({
        path: {
          organization_id: assertNotNullOrUndefined(organizationId),
        },
      }),
    enabled: organizationId != null,
  })

  usePageTitle(examQuery.data?.name ?? null)

  const crumbs = useMemo(
    () => [
      orgQuery.data?.name
        ? {
            isLoading: false as const,
            label: orgQuery.data.name,
            href: organizationFrontPageRoute(orgQuery.data?.slug ?? ""),
          }
        : { isLoading: true as const },
      examQuery.data?.name
        ? {
            isLoading: false as const,
            label: examQuery.data.name,
            href: `/manage/exams/${id}`,
          }
        : { isLoading: true as const },
    ],
    [orgQuery.data?.slug, orgQuery.data?.name, examQuery.data?.name, id],
  )

  useRegisterBreadcrumbs({ key: `exam:${id}`, order: 20, crumbs })

  return children
}
