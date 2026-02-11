"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useMemo } from "react"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import { fetchExam, fetchOrganization, fetchOrgExam } from "@/services/backend/exams"
// TODO: Replace 3-query waterfall with a single fetchExamBreadcrumbInfo (exam + org) endpoint.
import { organizationFrontPageRoute } from "@/shared-module/common/utils/routes"

export default function ExamLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>()

  const examQuery = useQuery({ queryKey: ["exam", id], queryFn: () => fetchExam(id) })
  const orgExamQuery = useQuery({
    queryKey: ["org-exam", id],
    queryFn: () => fetchOrgExam(id),
  })
  const orgQuery = useQuery({
    queryKey: ["organization", orgExamQuery.data?.organization_id],
    queryFn: () => fetchOrganization(orgExamQuery.data?.organization_id ?? ""),
    enabled: !!orgExamQuery.data?.organization_id,
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

  return <>{children}</>
}
