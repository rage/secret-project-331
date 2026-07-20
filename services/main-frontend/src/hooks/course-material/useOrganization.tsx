"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialOrganizationOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const useOrganization = (organizationId: string | undefined | null) => {
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: organizationId,
      isReady: (orgId): orgId is string => Boolean(orgId),
      build: (orgId) =>
        getCourseMaterialOrganizationOptions({
          path: {
            organization_id: orgId,
          },
        }),
    }),
  )
  return query
}

export default useOrganization
