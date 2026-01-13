"use client"
import { QueryClient, useQuery } from "@tanstack/react-query"

import { fetchOrganizationCourses } from "../services/backend/organizations"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const QUERY_KEY_PREFIX = "organization-courses"

export const invalidateOrganizationCourses = (queryClient: QueryClient, organizationId: string) => {
  queryClient.invalidateQueries({
    queryKey: [QUERY_KEY_PREFIX, organizationId],
  })
}

export const useOrganizationCourses = (
  organizationId: string | null,
  page: number,
  limit: number,
) => {
  const getOrgCourses = useQuery({
    queryKey: [QUERY_KEY_PREFIX, organizationId, page, limit],
    queryFn: () => fetchOrganizationCourses(assertNotNullOrUndefined(organizationId), page, limit),
    enabled: !!organizationId,
  })

  return getOrgCourses
}
