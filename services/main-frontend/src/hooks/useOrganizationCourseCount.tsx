"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"

import { getOrganizationCourseCountOptions } from "@/generated/api/@tanstack/react-query.generated"

export const invalidateOrganizationCourseCount = (
  queryClient: QueryClient,
  organizationId: string,
) => {
  queryClient.invalidateQueries({
    queryKey: getOrganizationCourseCountOptions({
      path: {
        organization_id: organizationId,
      },
    }).queryKey,
  })
}

export const useOrganizationCourseCount = (organizationId: string | null) => {
  const getOrgCourseCount = useQuery({
    ...getOrganizationCourseCountOptions({
      path: {
        // oxlint-disable-next-line typescript/no-non-null-assertion -- enabled: !!organizationId guards this query, so organizationId is set when it runs
        organization_id: organizationId!,
      },
    }),
    enabled: !!organizationId,
  })

  return getOrgCourseCount
}
