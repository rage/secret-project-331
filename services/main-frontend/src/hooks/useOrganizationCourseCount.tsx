"use client"

import { QueryClient, useQuery } from "@tanstack/react-query"

import { fetchOrganizationCourseCount } from "../services/backend/organizations"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const formatOrganizationCourseCountQueryKey = (organizationId: string) => [
  // eslint-disable-next-line i18next/no-literal-string
  "organization-courses-count",
  organizationId,
]

export const invalidateOrganizationCourseCount = (
  queryClient: QueryClient,
  organizationId: string,
) => {
  queryClient.invalidateQueries({ queryKey: formatOrganizationCourseCountQueryKey(organizationId) })
}

export const useOrganizationCourseCount = (organizationId: string | null) => {
  const getOrgCourseCount = useQuery({
    queryKey: formatOrganizationCourseCountQueryKey(organizationId ?? ""),
    queryFn: () => fetchOrganizationCourseCount(assertNotNullOrUndefined(organizationId)),
    enabled: !!organizationId,
  })

  return getOrgCourseCount
}
