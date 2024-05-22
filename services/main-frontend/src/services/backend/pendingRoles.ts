import { mainFrontendClient } from "../mainFrontendClient"

import { PendingRole, RoleQuery } from "@/shared-module/common/bindings"
import { isPendingRole } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchPendingRoles = async (query: RoleQuery): Promise<PendingRole[]> => {
  const response = await mainFrontendClient.get(`/roles/pending`, {
    params: query,
  })
  return validateResponse(response, isArray(isPendingRole))
}
