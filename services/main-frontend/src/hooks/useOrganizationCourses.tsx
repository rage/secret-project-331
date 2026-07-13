"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"

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
        // oxlint-disable-next-line typescript/no-non-null-assertion -- enabled: !!organizationId guards this query, so organizationId is set when it runs
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
