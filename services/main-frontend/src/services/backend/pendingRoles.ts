import { PendingRole, RoleQuery } from "../../shared-module/bindings"
import { isPendingRole } from "../../shared-module/bindings.guard"
import { isArray, validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchPendingRoles = async (query: RoleQuery): Promise<PendingRole[]> => {
  const response = await mainFrontendClient.get(`/roles/pending`, {
    params: query,
    responseType: "json",
  })
  return validateResponse(response, isArray(isPendingRole))
}
