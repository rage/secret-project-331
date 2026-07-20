"use client"

/* oxlint-disable i18next/no-literal-string */
import type { UseQueryResult } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"

import type { ActionOnResource } from "../authApiTypes"
import { postAuthAuthorizeMultiple } from "../generated/auth-api/sdk.generated"
import "../init/registerAuthApiClients"

/**
 * Can be used to authorize multiple actions at once. Use this only for optimization purposes. If you wish to authorize only one action, use `OnlyRenderIfPermissions` instead.
 *
 * Returns an array of booleans in the same order as the actions passed in indicating whether the action is authorized.
 */
export default function useAuthorizeMultiple(
  requests: ActionOnResource[],
): UseQueryResult<boolean[], unknown> {
  let key = "authorize-multiple"
  requests.forEach((request) => {
    key += `-action-${JSON.stringify(request.action)}-on-resource-${JSON.stringify(
      request.resource,
    )}`
  })

  const res = useQuery({
    queryKey: [key, requests],
    queryFn: () => {
      return postAuthAuthorizeMultiple({ body: requests })
    },
    gcTime: 15 * 60 * 1000,
    enabled: requests.length > 0,
  })

  return res
}
