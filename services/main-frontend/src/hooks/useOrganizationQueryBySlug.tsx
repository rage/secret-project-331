import { useQuery } from "@tanstack/react-query"

import { fetchOrganizationBySlug } from "../services/backend/organizations"
import { assertNotNullOrUndefined } from "../shared-module/common/utils/nullability"

const useOrganizationBySlug = (organizationSlug: string | null) => {
  return useQuery({
    queryKey: [`organization-${organizationSlug}`],
    queryFn: () => fetchOrganizationBySlug(assertNotNullOrUndefined(organizationSlug)),
    enabled: organizationSlug !== null,
  })
}

export default useOrganizationBySlug
