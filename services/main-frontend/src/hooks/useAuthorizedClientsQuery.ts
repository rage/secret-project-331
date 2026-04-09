import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useContext } from "react"

import { getOauthAuthorizedClientsOptions } from "@/generated/api/@tanstack/react-query.generated"
import { deleteOauthAuthorizedClient } from "@/generated/api/sdk.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"

const useAuthorizedClientsQuery = () => {
  const loginStateContext = useContext(LoginStateContext)
  const queryClient = useQueryClient()
  const authorizedClientsQueryKey = getOauthAuthorizedClientsOptions().queryKey

  const listQuery = useQuery({
    ...getOauthAuthorizedClientsOptions(),
    enabled: loginStateContext.signedIn === true,
  })

  const revokeMutation = useMutation({
    mutationFn: async (clientId: string) =>
      deleteOauthAuthorizedClient({
        path: {
          client_id: clientId,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authorizedClientsQueryKey })
    },
  })

  return { listQuery, revokeMutation }
}

export default useAuthorizedClientsQuery
