import { useQuery } from "@tanstack/react-query"

import { fetchOrganizationBySlug } from "../services/backend/organizations"
import { assertNotNullOrUndefined } from "../shared-module/utils/nullability"

const useOrganizationBySlug = (organizationSlug: string | null) => {
  return useQuery(
    [`organization-${organizationSlug}`],
    () => fetchOrganizationBySlug(assertNotNullOrUndefined(organizationSlug)),
    { enabled: organizationSlug !== null },
  )
}

export default useOrganizationBySlug
