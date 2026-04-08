import { queryOptions } from "@tanstack/react-query"

import { getPendingRolesOptions as getPendingRolesGeneratedOptions } from "@/generated/api/@tanstack/react-query.generated"
import { getPendingRoles as getPendingRolesFromApi } from "@/generated/api/sdk.generated"
import { PendingRole, RoleQuery } from "@/shared-module/common/bindings"
import { isPendingRole } from "@/shared-module/common/bindings.guard"
import { isArray } from "@/shared-module/common/utils/fetching"

const validateGeneratedData = <T>(data: unknown, isT: (value: unknown) => value is T): T => {
  if (isT(data)) {
    return data
  }

  throw new Error(`Invalid data from API: ${JSON.stringify(data, undefined, 2)}`)
}

export const fetchPendingRoles = async (query: RoleQuery): Promise<PendingRole[]> => {
  const data = await getPendingRolesFromApi({
    query,
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isPendingRole))
}

export const getPendingRolesOptionsForQuery = (query: RoleQuery) =>
  queryOptions({
    ...getPendingRolesGeneratedOptions({
      query,
    }),
    select: (data): PendingRole[] => validateGeneratedData(data, isArray(isPendingRole)),
  })
