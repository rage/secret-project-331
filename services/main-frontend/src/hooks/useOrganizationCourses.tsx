"use client"

import { QueryClient, useQuery } from "@tanstack/react-query"

import { getOrganizationCoursesOptions } from "@/generated/api/@tanstack/react-query.generated"

export const invalidateOrganizationCourses = (queryClient: QueryClient, organizationId: string) => {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0]
      if (
        typeof key !== "object" ||
        key === null ||
        !("_id" in key) ||
        key._id !== "getOrganizationCourses"
      ) {
        return false
      }

      return (
        "path" in key &&
        typeof key.path === "object" &&
        key.path !== null &&
        "organization_id" in key.path &&
        key.path.organization_id === organizationId
      )
    },
  })
}

export const useOrganizationCourses = (
  organizationId: string | null,
  page: number,
  limit: number,
) => {
  const getOrgCourses = useQuery({
    ...getOrganizationCoursesOptions({
      path: {
        organization_id: organizationId!,
      },
      query: {
        page,
        limit,
      },
    }),
    enabled: !!organizationId,
  })

  return getOrgCourses
}
