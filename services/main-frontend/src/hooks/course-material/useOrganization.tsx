"use client"
import { useQuery } from "@tanstack/react-query"

import { fetchOrganization } from "@/services/course-material/backend"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const useOrganization = (organizationId: string | undefined | null) => {
  const query = useQuery({
    queryKey: ["organization", organizationId],
    queryFn: () => fetchOrganization(assertNotNullOrUndefined(organizationId)),
    enabled: !!organizationId,
  })
  return query
}

export default useOrganization
