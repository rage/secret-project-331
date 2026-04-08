import { queryOptions } from "@tanstack/react-query"

import {
  addRoleMutation,
  getRolesOptions as getRolesGeneratedOptions,
  removeRoleMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  addRole as addRoleFromApi,
  getRoles as getRolesFromApi,
  removeRole as removeRoleFromApi,
} from "@/generated/api/sdk.generated"
import {
  RoleDomain,
  RoleInfo,
  RoleQuery,
  RoleUser,
  UserRole,
} from "@/shared-module/common/bindings"
import { isRoleUser } from "@/shared-module/common/bindings.guard"
import { isArray } from "@/shared-module/common/utils/fetching"

const validateGeneratedData = <T>(data: unknown, isT: (value: unknown) => value is T): T => {
  if (isT(data)) {
    return data
  }

  throw new Error(`Invalid data from API: ${JSON.stringify(data, undefined, 2)}`)
}

export const fetchRoles = async (query: RoleQuery): Promise<Array<RoleUser>> => {
  const data = await getRolesFromApi({
    query,
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isRoleUser))
}

export const getRolesOptionsForQuery = (query: RoleQuery) =>
  queryOptions({
    ...getRolesGeneratedOptions({
      query,
    }),
    select: (data): RoleUser[] => validateGeneratedData(data, isArray(isRoleUser)),
  })

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
  await addRoleFromApi({
    body: data,
    throwOnError: true,
  })
}

export const giveRoleMutationOptions = () => addRoleMutation()

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
  await removeRoleFromApi({
    body: data,
    throwOnError: true,
  })
}

export const removeRoleMutationOptions = () => removeRoleMutation()
