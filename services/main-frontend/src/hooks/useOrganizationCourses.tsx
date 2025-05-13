import { QueryClient, useQuery } from "@tanstack/react-query"

import { fetchOrganizationCourses } from "../services/backend/organizations"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const formatOrganizationCoursesQueryKey = (
  organizationId: string,
  page: number,
  limit: number,
  // eslint-disable-next-line i18next/no-literal-string
) => ["organization-courses", page, limit, organizationId]

export const invalidateOrganizationCourses = (queryClient: QueryClient, organizationId: string) => {
  queryClient.invalidateQueries({
    queryKey: formatOrganizationCoursesQueryKey(organizationId, 1, 10),
  })
}

export const useOrganizationCourses = (
  organizationId: string | null,
  page: number,
  limit: number,
) => {
  const getOrgCourses = useQuery({
    queryKey: formatOrganizationCoursesQueryKey(organizationId ?? "", page, limit),
    queryFn: () => fetchOrganizationCourses(assertNotNullOrUndefined(organizationId), page, limit),
    enabled: !!organizationId,
  })

  return getOrgCourses
}
