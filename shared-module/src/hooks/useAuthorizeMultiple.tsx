/* eslint-disable i18next/no-literal-string */
import { useQuery, UseQueryResult } from "@tanstack/react-query"

import { ActionOnResource } from "../bindings"
import { authorizeMultiple } from "../services/backend/auth"

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

  const res = useQuery([key], () => {
    return authorizeMultiple(requests)
  }, // 15 minutes
  { cacheTime: 15 * 60 * 1000, enabled: requests.length > 0 })

  return res
}
