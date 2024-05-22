import { mainFrontendClient } from "../mainFrontendClient"

import {
  RoleDomain,
  RoleInfo,
  RoleQuery,
  RoleUser,
  UserRole,
} from "@/shared-module/common/bindings"
import { isRoleUser } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchRoles = async (query: RoleQuery): Promise<Array<RoleUser>> => {
  const response = await mainFrontendClient.get(`/roles`, {
    params: query,
  })
  return validateResponse(response, isArray(isRoleUser))
}

export const giveRole = async (
  email: string,
  role: UserRole,
  domain: RoleDomain,
): Promise<void> => {
  const data: RoleInfo = {
    email,
    role,
    domain,
  }
  await mainFrontendClient.post(`/roles/add`, data)
}

export const removeRole = async (
  email: string,
  role: UserRole,
  domain: RoleDomain,
): Promise<void> => {
  const data: RoleInfo = {
    email,
    role,
    domain,
  }
  await mainFrontendClient.post(`/roles/remove`, data)
}
