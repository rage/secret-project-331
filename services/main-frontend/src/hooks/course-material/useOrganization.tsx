"use client"

import { skipToken, useQuery } from "@tanstack/react-query"

import { getCourseMaterialOrganization } from "@/generated/course-material-api/sdk.generated"

const COURSE_MATERIAL_ORGANIZATION_QUERY_KEY = "courseMaterialOrganization"

const useOrganization = (organizationId: string | undefined | null) => {
  const query = useQuery({
    queryKey: [COURSE_MATERIAL_ORGANIZATION_QUERY_KEY, organizationId] as const,
    queryFn: organizationId
      ? () =>
          getCourseMaterialOrganization({
            path: {
              organization_id: organizationId,
            },
            throwOnError: true,
          })
      : skipToken,
    enabled: !!organizationId,
  })
  return query
}

export default useOrganization
